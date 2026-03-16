-- Ensure learner submission uploads work against the private submissions bucket
-- and allow course managers to view learner submission records for their courses.

INSERT INTO storage.buckets (id, name, public)
VALUES ('submissions', 'submissions', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload submissions" ON storage.objects;
CREATE POLICY "Users can upload submissions"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'submissions'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can view own submission files" ON storage.objects;
CREATE POLICY "Users can view own submission files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'submissions'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Course managers and validators can view submissions bucket" ON storage.objects;
CREATE POLICY "Course managers and validators can view submissions bucket"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'submissions'
  AND public.get_user_role() IN ('admin', 'trainer', 'spd', 'training_officer', 'validator')
);

DROP POLICY IF EXISTS "Users can delete own submissions" ON storage.objects;
CREATE POLICY "Users can delete own submissions"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'submissions'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Course managers can view course submissions" ON public.submissions;
CREATE POLICY "Course managers can view course submissions" ON public.submissions
FOR SELECT
TO authenticated
USING (public.course_manager_can_manage_enrollment(enrollment_id));