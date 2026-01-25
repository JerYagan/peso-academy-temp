-- ============================================================================
-- Check Roles in Database
-- Run this to verify roles exist in the database
-- ============================================================================

-- Check if roles table exists and has data
SELECT 
  'Roles Table Check' as check_type,
  COUNT(*) as role_count,
  CASE 
    WHEN COUNT(*) = 0 THEN '❌ No roles found in database!'
    ELSE '✅ Found ' || COUNT(*) || ' roles'
  END as status
FROM public.roles;

-- List all roles
SELECT 
  'All Roles' as check_type,
  id,
  name,
  description,
  category,
  dashboard_route,
  can_signup,
  created_at
FROM public.roles
ORDER BY category, name;

-- Check RLS policies on roles table
SELECT 
  'RLS Policies' as check_type,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'roles'
  AND schemaname = 'public';

-- Test if current user can read roles
SELECT 
  'Read Test' as check_type,
  COUNT(*) as readable_roles,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ You can read roles'
    ELSE '❌ Cannot read roles - check RLS policies'
  END as status
FROM public.roles;

