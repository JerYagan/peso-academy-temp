-- Storage policies for course-materials bucket (course/module file uploads)
-- Role is read via public.get_user_role(). In current setups, that function should
-- prefer public.users.role and fall back to auth metadata only when needed.
-- Run this after creating the bucket "course-materials" in Supabase Dashboard → Storage.

-- Allow authenticated users to view course materials (public bucket)
DROP POLICY IF EXISTS "Users can view course materials" ON storage.objects;
CREATE POLICY "Users can view course materials"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'course-materials');

-- Allow course managers to upload course materials and thumbnails.
DROP POLICY IF EXISTS "Trainers can upload course materials" ON storage.objects;
DROP POLICY IF EXISTS "Course managers can upload course materials" ON storage.objects;
CREATE POLICY "Course managers can upload course materials"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'course-materials'
  AND public.get_user_role() IN ('admin', 'trainer', 'spd', 'training_officer')
);

-- Allow course managers to update/delete their uploads (optional: restrict by path if needed)
DROP POLICY IF EXISTS "Trainers can update course materials" ON storage.objects;
DROP POLICY IF EXISTS "Course managers can update course materials" ON storage.objects;
CREATE POLICY "Course managers can update course materials"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'course-materials'
  AND public.get_user_role() IN ('admin', 'trainer', 'spd', 'training_officer')
)
WITH CHECK (
  bucket_id = 'course-materials'
  AND public.get_user_role() IN ('admin', 'trainer', 'spd', 'training_officer')
);

DROP POLICY IF EXISTS "Trainers can delete course materials" ON storage.objects;
DROP POLICY IF EXISTS "Course managers can delete course materials" ON storage.objects;
CREATE POLICY "Course managers can delete course materials"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'course-materials'
  AND public.get_user_role() IN ('admin', 'trainer', 'spd', 'training_officer')
);
