-- ============================================
-- Add User Permissions Table for Direct User-Permission Assignment
-- ============================================
-- This allows assigning permissions directly to users, bypassing roles
-- This enables flexible RBAC where users can have permissions from multiple roles

-- Step 1: Create user_permissions table (for direct user-to-permission mapping)
CREATE TABLE IF NOT EXISTS public.user_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    permission_id TEXT NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    granted_by UUID REFERENCES public.users(id), -- Who granted this permission
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, permission_id)
);

-- Step 2: Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON public.user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_permission ON public.user_permissions(permission_id);

-- Step 3: Enable RLS
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS policies for user_permissions
-- Users can view their own permissions
CREATE POLICY "Users can view their own permissions" ON public.user_permissions
    FOR SELECT USING (user_id = auth.uid());

-- Admins can manage all user permissions
CREATE POLICY "Admins can manage user permissions" ON public.user_permissions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Step 5: Update user_has_permission function to check both role permissions AND direct user permissions
CREATE OR REPLACE FUNCTION public.user_has_permission(user_id UUID, permission_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    -- Check role-based permissions
    SELECT 1
    FROM public.users u
    JOIN public.role_permissions rp ON u.role::TEXT = rp.role_id
    WHERE u.id = user_id AND rp.permission_id = permission_id
    
    UNION
    
    -- Check direct user permissions
    SELECT 1
    FROM public.user_permissions up
    WHERE up.user_id = user_id AND up.permission_id = permission_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Step 6: Update get_user_permissions function to include both role permissions AND direct user permissions
-- Drop the existing function first since we're changing the return type
DROP FUNCTION IF EXISTS public.get_user_permissions(UUID);

CREATE FUNCTION public.get_user_permissions(user_id UUID)
RETURNS TABLE(permission_id TEXT, permission_name TEXT, category TEXT, source TEXT) AS $$
BEGIN
  RETURN QUERY
  -- Get permissions from role
  SELECT 
    p.id as permission_id,
    p.name as permission_name,
    p.category,
    'role'::TEXT as source
  FROM public.users u
  JOIN public.role_permissions rp ON u.role::TEXT = rp.role_id
  JOIN public.permissions p ON rp.permission_id = p.id
  WHERE u.id = user_id
  
  UNION
  
  -- Get direct user permissions
  SELECT 
    p.id as permission_id,
    p.name as permission_name,
    p.category,
    'direct'::TEXT as source
  FROM public.user_permissions up
  JOIN public.permissions p ON up.permission_id = p.id
  WHERE up.user_id = user_id
  
  ORDER BY category, permission_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Step 7: Grant permissions
GRANT SELECT ON public.user_permissions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.user_permissions TO authenticated;

-- Step 8: Create helper function to grant permission to user
CREATE OR REPLACE FUNCTION public.grant_user_permission(
    target_user_id UUID,
    permission_id TEXT,
    granted_by_user_id UUID DEFAULT auth.uid()
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.user_permissions (user_id, permission_id, granted_by)
  VALUES (target_user_id, permission_id, granted_by_user_id)
  ON CONFLICT (user_id, permission_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 9: Create helper function to revoke permission from user
CREATE OR REPLACE FUNCTION public.revoke_user_permission(
    target_user_id UUID,
    permission_id TEXT
)
RETURNS void AS $$
BEGIN
  DELETE FROM public.user_permissions
  WHERE user_id = target_user_id AND permission_id = permission_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 10: Grant execute permissions
GRANT EXECUTE ON FUNCTION public.grant_user_permission(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_user_permission(UUID, TEXT) TO authenticated;

