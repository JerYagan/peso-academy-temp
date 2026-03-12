-- Fix enrollment history logging so enrollment deletes do not violate
-- enrollment_history_enrollment_id_fkey during cascades such as course removal.

ALTER TABLE public.enrollment_history
  DROP CONSTRAINT IF EXISTS enrollment_history_enrollment_id_fkey;

ALTER TABLE public.enrollment_history
  ADD CONSTRAINT enrollment_history_enrollment_id_fkey
  FOREIGN KEY (enrollment_id)
  REFERENCES public.enrollments(id)
  ON DELETE SET NULL;

ALTER TABLE public.enrollment_history
  DROP CONSTRAINT IF EXISTS enrollment_history_course_id_fkey;

ALTER TABLE public.enrollment_history
  ADD CONSTRAINT enrollment_history_course_id_fkey
  FOREIGN KEY (course_id)
  REFERENCES public.courses(id)
  ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.log_enrollment_history()
RETURNS TRIGGER AS $$
DECLARE
  action_type VARCHAR(50);
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.enrollment_history (
      enrollment_id,
      user_id,
      course_id,
      action,
      new_status,
      new_progress,
      performed_by
    ) VALUES (
      NEW.id,
      NEW.user_id,
      NEW.course_id,
      'enrolled',
      NEW.status,
      NEW.progress,
      auth.uid()
    );

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status != NEW.status THEN
      IF NEW.status = 'dropped' THEN
        action_type := 'unenrolled';
      ELSIF NEW.status = 'in-progress' AND OLD.status = 'enrolled' THEN
        action_type := 'resumed';
      ELSIF NEW.status = 'completed' THEN
        action_type := 'completed';
      ELSE
        action_type := 'status_changed';
      END IF;
    ELSIF OLD.progress != NEW.progress AND NEW.progress > OLD.progress THEN
      action_type := 'progress_updated';
    ELSE
      action_type := 'updated';
    END IF;

    INSERT INTO public.enrollment_history (
      enrollment_id,
      user_id,
      course_id,
      action,
      old_status,
      new_status,
      old_progress,
      new_progress,
      performed_by
    ) VALUES (
      NEW.id,
      NEW.user_id,
      NEW.course_id,
      action_type,
      OLD.status,
      NEW.status,
      OLD.progress,
      NEW.progress,
      auth.uid()
    );

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.enrollment_history (
      enrollment_id,
      user_id,
      course_id,
      action,
      old_status,
      old_progress,
      performed_by
    ) VALUES (
      OLD.id,
      OLD.user_id,
      CASE
        WHEN EXISTS (SELECT 1 FROM public.courses WHERE id = OLD.course_id) THEN OLD.course_id
        ELSE NULL
      END,
      'unenrolled',
      OLD.status,
      OLD.progress,
      auth.uid()
    );

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enrollment_history_trigger ON public.enrollments;
DROP TRIGGER IF EXISTS enrollment_history_upsert_trigger ON public.enrollments;
DROP TRIGGER IF EXISTS enrollment_history_delete_trigger ON public.enrollments;

CREATE TRIGGER enrollment_history_upsert_trigger
  AFTER INSERT OR UPDATE ON public.enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.log_enrollment_history();

CREATE TRIGGER enrollment_history_delete_trigger
  BEFORE DELETE ON public.enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.log_enrollment_history();