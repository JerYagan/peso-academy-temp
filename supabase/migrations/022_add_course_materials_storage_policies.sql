-- Storage policies for course-materials bucket (course/module file uploads)
-- Role is read via public.get_user_role() (from auth.users.raw_user_meta_data).
-- Run this after creating the bucket "course-materials" in Supabase Dashboard → Storage.

-- Allow authenticated users to view course materials (public bucket)
DROP POLICY IF EXISTS "Users can view course materials" ON storage.objects;
CREATE POLICY "Users can view course materials"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'course-materials');

-- Allow training officers and admins to upload (role from get_user_role())
DROP POLICY IF EXISTS "Trainers can upload course materials" ON storage.objects;
CREATE POLICY "Trainers can upload course materials"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'course-materials'
  AND public.get_user_role() IN ('training_officer', 'admin')
);

-- Allow training officers and admins to update/delete their uploads (optional: restrict by path if needed)
DROP POLICY IF EXISTS "Trainers can update course materials" ON storage.objects;
CREATE POLICY "Trainers can update course materials"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'course-materials'
  AND public.get_user_role() IN ('training_officer', 'admin')
);

DROP POLICY IF EXISTS "Trainers can delete course materials" ON storage.objects;
CREATE POLICY "Trainers can delete course materials"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'course-materials'
  AND public.get_user_role() IN ('training_officer', 'admin')
);
