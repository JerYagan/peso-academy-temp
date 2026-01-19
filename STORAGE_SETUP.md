# Supabase Storage Setup Guide

This guide explains how to set up Supabase Storage buckets for the PESO Academy application.

## Required Storage Buckets

### 1. Submissions Bucket

This bucket stores assignment submissions uploaded by learners.

#### Setup Steps:

1. **Create the Bucket:**
   - Go to your Supabase Dashboard
   - Navigate to **Storage** → **Buckets**
   - Click **New Bucket**
   - Name: `submissions`
   - Public: `No` (private bucket)
   - File size limit: `10 MB` (or adjust as needed)
   - Allowed MIME types: Leave empty or specify allowed types

2. **Set Up Storage Policies:**

   Run the following SQL in your Supabase SQL Editor:

   ```sql
   -- Allow users to upload their own submissions
   CREATE POLICY "Users can upload submissions"
   ON storage.objects FOR INSERT
   TO authenticated
   WITH CHECK (
     bucket_id = 'submissions' AND
     (storage.foldername(name))[1] = auth.uid()::text
   );

   -- Allow users to view their own submissions
   CREATE POLICY "Users can view own submissions"
   ON storage.objects FOR SELECT
   TO authenticated
   USING (
     bucket_id = 'submissions' AND
     (storage.foldername(name))[1] = auth.uid()::text
   );

   -- Allow validators/admins to view all submissions
   CREATE POLICY "Validators can view all submissions"
   ON storage.objects FOR SELECT
   TO authenticated
   USING (
     bucket_id = 'submissions' AND
     EXISTS (
       SELECT 1 FROM public.users
       WHERE users.id = auth.uid()
       AND users.role IN ('validator', 'admin', 'trainer', 'spd')
     )
   );

   -- Allow users to delete their own submissions (before validation)
   CREATE POLICY "Users can delete own submissions"
   ON storage.objects FOR DELETE
   TO authenticated
   USING (
     bucket_id = 'submissions' AND
     (storage.foldername(name))[1] = auth.uid()::text
   );
   ```

3. **Folder Structure:**
   The bucket will automatically organize files by enrollment ID:
   ```
   submissions/
   └── {enrollment_id}/
       └── {timestamp}-{random}.{ext}
   ```

### 2. Course Materials Bucket (Optional)

If you want to store course materials (videos, documents) in Supabase Storage:

1. **Create the Bucket:**
   - Name: `course-materials`
   - Public: `Yes` (for easy access)
   - File size limit: `100 MB` (adjust based on needs)

2. **Set Up Storage Policies:**

   ```sql
   -- Allow authenticated users to view course materials
   CREATE POLICY "Users can view course materials"
   ON storage.objects FOR SELECT
   TO authenticated
   USING (bucket_id = 'course-materials');

   -- Allow trainers/admins to upload materials
   CREATE POLICY "Trainers can upload course materials"
   ON storage.objects FOR INSERT
   TO authenticated
   WITH CHECK (
     bucket_id = 'course-materials' AND
     EXISTS (
       SELECT 1 FROM public.users
       WHERE users.id = auth.uid()
       AND users.role IN ('trainer', 'admin', 'spd')
     )
   );
   ```

### 3. User Avatars Bucket (Optional)

For user profile pictures:

1. **Create the Bucket:**
   - Name: `avatars`
   - Public: `Yes`
   - File size limit: `2 MB`

2. **Set Up Storage Policies:**

   ```sql
   -- Allow users to upload their own avatar
   CREATE POLICY "Users can upload own avatar"
   ON storage.objects FOR INSERT
   TO authenticated
   WITH CHECK (
     bucket_id = 'avatars' AND
     (storage.foldername(name))[1] = auth.uid()::text
   );

   -- Allow users to view all avatars
   CREATE POLICY "Anyone can view avatars"
   ON storage.objects FOR SELECT
   TO authenticated
   USING (bucket_id = 'avatars');

   -- Allow users to update their own avatar
   CREATE POLICY "Users can update own avatar"
   ON storage.objects FOR UPDATE
   TO authenticated
   USING (
     bucket_id = 'avatars' AND
     (storage.foldername(name))[1] = auth.uid()::text
   );
   ```

## Testing Storage Setup

### Test File Upload (Submissions)

You can test the storage setup using the Assignment Submission interface:

1. Navigate to a course module
2. Go to the "Activities" tab
3. Upload a file using the Assignment Submission form
4. Check Supabase Storage → `submissions` bucket to verify the file was uploaded

### Verify Policies

To verify your storage policies are working:

1. Try uploading a file as a regular user
2. Try accessing the file URL directly
3. Verify validators can see all submissions

## Troubleshooting

### Common Issues:

1. **"Bucket not found" error:**
   - Ensure the bucket name matches exactly (case-sensitive)
   - Check that the bucket exists in your Supabase project

2. **"Permission denied" error:**
   - Verify RLS policies are set up correctly
   - Check that the user is authenticated
   - Ensure the user has the correct role for the operation

3. **"File too large" error:**
   - Check the bucket's file size limit
   - Adjust the limit in bucket settings if needed

4. **Files not appearing:**
   - Check the folder structure matches the expected pattern
   - Verify the file path is correct

## Security Considerations

1. **Private Buckets:** Use private buckets for sensitive data like submissions
2. **Public Buckets:** Only use public buckets for non-sensitive content like course materials
3. **File Validation:** Always validate file types and sizes on the client side before upload
4. **Virus Scanning:** Consider implementing virus scanning for uploaded files (future enhancement)

## File Organization Best Practices

- Use consistent folder structures: `{bucket}/{enrollment_id}/{filename}`
- Include timestamps in filenames to prevent conflicts
- Use UUIDs or random strings to prevent filename collisions
- Clean up old files periodically (implement cleanup job)

## Next Steps

After setting up storage:

1. Test file uploads from the Assignment Submission interface
2. Verify validators can access submitted files
3. Set up automated cleanup for old submissions (optional)
4. Configure CDN for public buckets (optional, for better performance)

