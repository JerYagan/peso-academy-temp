-- Add functions for enrollment count management
-- Check if increment function exists and update it to support increment_by parameter
CREATE OR REPLACE FUNCTION increment_enrolled_count(course_id UUID, increment_by INTEGER DEFAULT 1)
RETURNS void AS $$
BEGIN
  UPDATE public.courses
  SET enrolled_count = enrolled_count + increment_by
  WHERE id = course_id;
END;
$$ LANGUAGE plpgsql;

-- Add function to decrement enrolled count
CREATE OR REPLACE FUNCTION decrement_enrolled_count(course_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.courses
  SET enrolled_count = GREATEST(enrolled_count - 1, 0)
  WHERE id = course_id;
END;
$$ LANGUAGE plpgsql;

-- Add enrollment_history table for tracking enrollment changes
CREATE TABLE IF NOT EXISTS public.enrollment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID REFERENCES public.enrollments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL, -- enrolled, unenrolled, status_changed, paused, resumed, completed
  old_status VARCHAR(50),
  new_status VARCHAR(50),
  old_progress INTEGER,
  new_progress INTEGER,
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Who performed the action (admin/trainer)
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_enrollment_history_enrollment_id ON public.enrollment_history(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_history_user_id ON public.enrollment_history(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_history_course_id ON public.enrollment_history(course_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_history_created_at ON public.enrollment_history(created_at DESC);

-- Enable RLS
ALTER TABLE public.enrollment_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for enrollment_history
-- Users can view their own enrollment history
CREATE POLICY "Users can view own enrollment history"
  ON public.enrollment_history
  FOR SELECT
  USING (user_id = auth.uid());

-- Admins and trainers can view all enrollment history
CREATE POLICY "Admins and trainers can view all enrollment history"
  ON public.enrollment_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() 
      AND (users.role = 'admin' OR users.role = 'trainer' OR users.role = 'spd')
    )
  );

-- Only admins and trainers can insert enrollment history
CREATE POLICY "Admins and trainers can insert enrollment history"
  ON public.enrollment_history
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() 
      AND (users.role = 'admin' OR users.role = 'trainer' OR users.role = 'spd')
    )
  );

-- Function to log enrollment history automatically
CREATE OR REPLACE FUNCTION log_enrollment_history()
RETURNS TRIGGER AS $$
BEGIN
  -- Log enrollment creation
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

  -- Log enrollment updates
  IF TG_OP = 'UPDATE' THEN
    -- Determine action type based on changes
    DECLARE
      action_type VARCHAR(50);
    BEGIN
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
    END;
    RETURN NEW;
  END IF;

  -- Log enrollment deletion
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
      OLD.course_id,
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

-- Create trigger to automatically log enrollment history
DROP TRIGGER IF EXISTS enrollment_history_trigger ON public.enrollments;
CREATE TRIGGER enrollment_history_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.enrollments
  FOR EACH ROW
  EXECUTE FUNCTION log_enrollment_history();

-- Grant permissions
GRANT SELECT, INSERT ON public.enrollment_history TO authenticated;

-- Comments
COMMENT ON TABLE public.enrollment_history IS 'Tracks all enrollment changes and history';
COMMENT ON FUNCTION log_enrollment_history() IS 'Automatically logs enrollment history on changes';

