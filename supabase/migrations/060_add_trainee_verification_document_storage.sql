INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trainee-verification-documents',
  'trainee-verification-documents',
  FALSE,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Trainees can upload own verification documents" ON storage.objects;
CREATE POLICY "Trainees can upload own verification documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'trainee-verification-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Trainees can update own verification documents" ON storage.objects;
CREATE POLICY "Trainees can update own verification documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'trainee-verification-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'trainee-verification-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Trainees can delete own verification documents" ON storage.objects;
CREATE POLICY "Trainees can delete own verification documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'trainee-verification-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Staff can review trainee verification documents" ON storage.objects;
CREATE POLICY "Staff can review trainee verification documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'trainee-verification-documents'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.get_user_role() IN ('admin', 'trainer', 'spd', 'training_officer')
  )
);