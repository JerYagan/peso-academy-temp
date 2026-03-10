-- Fix course-management RLS to support the actual seeded/admin roles in public.users.
-- This migration makes public.get_user_role() prefer public.users.role and updates
-- course/storage policies so admin, trainer, SPD, and training_officer can manage course assets.

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Prefer the application profile role first because seeded/internal users are stored in public.users.
  SELECT role::TEXT INTO user_role
  FROM public.users
  WHERE id = auth.uid();

  IF user_role IS NULL OR user_role = '' THEN
    user_role := NULLIF(auth.jwt() -> 'user_metadata' ->> 'role', '');
  END IF;

  IF user_role IS NULL OR user_role = '' THEN
    SELECT NULLIF(raw_user_meta_data ->> 'role', '') INTO user_role
    FROM auth.users
    WHERE id = auth.uid();
  END IF;

  RETURN COALESCE(user_role, 'trainee');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS "Training officers and admins can create courses" ON public.courses;
DROP POLICY IF EXISTS "Training officers and admins can update courses" ON public.courses;
DROP POLICY IF EXISTS "Trainers and admins can create courses" ON public.courses;
DROP POLICY IF EXISTS "Course managers can create courses" ON public.courses;
DROP POLICY IF EXISTS "Course managers can update courses" ON public.courses;

CREATE POLICY "Course managers can create courses" ON public.courses
FOR INSERT
TO authenticated
WITH CHECK (
  public.get_user_role() IN ('admin', 'trainer', 'spd', 'training_officer')
);

CREATE POLICY "Course managers can update courses" ON public.courses
FOR UPDATE
TO authenticated
USING (
  public.get_user_role() IN ('admin', 'trainer', 'spd', 'training_officer')
)
WITH CHECK (
  public.get_user_role() IN ('admin', 'trainer', 'spd', 'training_officer')
);

DROP POLICY IF EXISTS "Trainers can upload course materials" ON storage.objects;
DROP POLICY IF EXISTS "Trainers can update course materials" ON storage.objects;
DROP POLICY IF EXISTS "Trainers can delete course materials" ON storage.objects;
DROP POLICY IF EXISTS "Course managers can upload course materials" ON storage.objects;
DROP POLICY IF EXISTS "Course managers can update course materials" ON storage.objects;
DROP POLICY IF EXISTS "Course managers can delete course materials" ON storage.objects;

CREATE POLICY "Course managers can upload course materials"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'course-materials'
  AND public.get_user_role() IN ('admin', 'trainer', 'spd', 'training_officer')
);

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

CREATE POLICY "Course managers can delete course materials"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'course-materials'
  AND public.get_user_role() IN ('admin', 'trainer', 'spd', 'training_officer')
);