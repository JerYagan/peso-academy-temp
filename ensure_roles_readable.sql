-- ============================================================================
-- Ensure Roles Table is Readable
-- This ensures anyone can read roles (needed for dropdowns)
-- ============================================================================

-- Drop existing read policy if it exists
DROP POLICY IF EXISTS "Anyone can view roles" ON public.roles;

-- Create policy that allows anyone to read roles
CREATE POLICY "Anyone can view roles" ON public.roles
    FOR SELECT USING (true);

-- Verify the policy exists
SELECT 
  'Policy Verification' as check_type,
  policyname,
  cmd,
  CASE 
    WHEN policyname IS NOT NULL THEN '✅ Read policy exists'
    ELSE '❌ Read policy missing'
  END as status
FROM pg_policies
WHERE tablename = 'roles'
  AND schemaname = 'public'
  AND cmd = 'SELECT';

-- Test reading roles
SELECT 
  'Read Test' as check_type,
  COUNT(*) as readable_roles,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ You can read roles'
    ELSE '❌ Cannot read roles'
  END as status
FROM public.roles;

