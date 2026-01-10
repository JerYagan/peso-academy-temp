-- ============================================
-- Create Roles and Permissions Tables
-- ============================================
-- This migration creates database tables for dynamic role and permission management
-- Run this in Supabase SQL Editor

-- Step 1: Create permissions table
CREATE TABLE IF NOT EXISTS public.permissions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL, -- e.g., 'users', 'courses', 'training', 'jobs', 'reports', 'system'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 2: Create roles table
CREATE TABLE IF NOT EXISTS public.roles (
    id TEXT PRIMARY KEY, -- e.g., 'admin', 'trainer', 'jobseeker'
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('internal', 'end_user')),
    icon TEXT,
    color TEXT,
    dashboard_route TEXT NOT NULL,
    can_signup BOOLEAN NOT NULL DEFAULT false,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 3: Create role_permissions junction table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS public.role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id TEXT NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id TEXT NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(role_id, permission_id)
);

-- Step 4: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_permissions_category ON public.permissions(category);
CREATE INDEX IF NOT EXISTS idx_roles_category ON public.roles(category);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON public.role_permissions(permission_id);

-- Step 5: Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_roles_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create triggers for updated_at
CREATE TRIGGER update_permissions_updated_at 
    BEFORE UPDATE ON public.permissions
    FOR EACH ROW 
    EXECUTE FUNCTION update_roles_permissions_updated_at();

CREATE TRIGGER update_roles_updated_at 
    BEFORE UPDATE ON public.roles
    FOR EACH ROW 
    EXECUTE FUNCTION update_roles_permissions_updated_at();

-- Step 7: Enable Row Level Security
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Step 8: Create RLS Policies

-- Permissions: Everyone can view (read-only for now)
CREATE POLICY "Anyone can view permissions" ON public.permissions
    FOR SELECT USING (true);

-- Roles: Everyone can view (read-only for now)
CREATE POLICY "Anyone can view roles" ON public.roles
    FOR SELECT USING (true);

-- Role Permissions: Everyone can view (read-only for now)
CREATE POLICY "Anyone can view role permissions" ON public.role_permissions
    FOR SELECT USING (true);

-- Admins can manage permissions
CREATE POLICY "Admins can manage permissions" ON public.permissions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Admins can manage roles
CREATE POLICY "Admins can manage roles" ON public.roles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Admins can manage role permissions
CREATE POLICY "Admins can manage role permissions" ON public.role_permissions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Step 9: Insert default permissions
INSERT INTO public.permissions (id, name, description, category) VALUES
-- User Management
('users.view', 'View Users', 'View user profiles and information', 'users'),
('users.create', 'Create Users', 'Create new user accounts', 'users'),
('users.update', 'Update Users', 'Update user information', 'users'),
('users.delete', 'Delete Users', 'Delete user accounts', 'users'),
('users.manage_roles', 'Manage User Roles', 'Change user roles and permissions', 'users'),

-- Course Management
('courses.view', 'View Courses', 'View course catalog and details', 'courses'),
('courses.create', 'Create Courses', 'Create new courses', 'courses'),
('courses.update', 'Update Courses', 'Edit existing courses', 'courses'),
('courses.delete', 'Delete Courses', 'Delete courses', 'courses'),
('courses.enroll', 'Enroll in Courses', 'Enroll in available courses', 'courses'),

-- Training Management
('training.manage', 'Manage Training', 'Manage training programs and content', 'training'),
('training.validate', 'Validate Training', 'Validate training completions', 'training'),
('training.certify', 'Issue Certificates', 'Issue completion certificates', 'training'),

-- Job Management
('jobs.view', 'View Jobs', 'View job listings', 'jobs'),
('jobs.create', 'Post Jobs', 'Create job postings', 'jobs'),
('jobs.update', 'Update Jobs', 'Edit job postings', 'jobs'),
('jobs.delete', 'Delete Jobs', 'Delete job postings', 'jobs'),
('jobs.apply', 'Apply to Jobs', 'Apply for job positions', 'jobs'),

-- Reporting
('reports.view', 'View Reports', 'Access system reports', 'reports'),
('reports.export', 'Export Reports', 'Export report data', 'reports'),

-- System Administration
('system.settings', 'System Settings', 'Manage system configuration', 'system'),
('system.audit', 'View Audit Logs', 'Access audit logs', 'system')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    updated_at = NOW();

-- Step 10: Insert default roles
INSERT INTO public.roles (id, name, description, category, icon, color, dashboard_route, can_signup, metadata) VALUES
('admin', 'Administrator', 'Full system access and management capabilities', 'internal', 'Shield', 'red', '/admin/users', false, '{"level": "highest", "requiresApproval": true}'::jsonb),
('validator', 'Validator', 'Review and validate training completions', 'internal', 'CheckCircle', 'blue', '/validator/dashboard', false, '{"level": "internal", "requiresApproval": true}'::jsonb),
('trainer', 'Trainer', 'Create courses, manage content, and track learner progress', 'end_user', 'GraduationCap', 'green', '/trainer/courses', false, '{"level": "moderate", "requiresApproval": true}'::jsonb),
('spd', 'Special Projects Division', 'Manage modules, training programs, and content delivery', 'end_user', 'FolderKanban', 'purple', '/trainer/courses', false, '{"level": "moderate", "requiresApproval": true}'::jsonb),
('employer', 'Employer', 'Post jobs and access skill-verified candidate pool', 'end_user', 'Briefcase', 'orange', '/employer/jobs', true, '{"level": "basic", "requiresApproval": false}'::jsonb),
('jobseeker', 'Job Seeker', 'Access learning materials and complete training courses', 'end_user', 'User', 'gray', '/dashboard', true, '{"level": "basic", "requiresApproval": false}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    icon = EXCLUDED.icon,
    color = EXCLUDED.color,
    dashboard_route = EXCLUDED.dashboard_route,
    can_signup = EXCLUDED.can_signup,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

-- Step 11: Insert role-permission mappings
-- Admin: All permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'admin', id FROM public.permissions
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Validator: View courses, validate training, certify, view reports
INSERT INTO public.role_permissions (role_id, permission_id) VALUES
('validator', 'courses.view'),
('validator', 'training.validate'),
('validator', 'training.certify'),
('validator', 'reports.view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Trainer: Course management, training management, validate, view reports
INSERT INTO public.role_permissions (role_id, permission_id) VALUES
('trainer', 'courses.view'),
('trainer', 'courses.create'),
('trainer', 'courses.update'),
('trainer', 'training.manage'),
('trainer', 'training.validate'),
('trainer', 'reports.view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- SPD: Same as trainer
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'spd', permission_id FROM public.role_permissions WHERE role_id = 'trainer'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Employer: Job management and view reports
INSERT INTO public.role_permissions (role_id, permission_id) VALUES
('employer', 'jobs.view'),
('employer', 'jobs.create'),
('employer', 'jobs.update'),
('employer', 'jobs.delete'),
('employer', 'reports.view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Job Seeker: View courses, enroll, view jobs, apply to jobs
INSERT INTO public.role_permissions (role_id, permission_id) VALUES
('jobseeker', 'courses.view'),
('jobseeker', 'courses.enroll'),
('jobseeker', 'jobs.view'),
('jobseeker', 'jobs.apply')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Step 12: Create helper function to check if user has permission
CREATE OR REPLACE FUNCTION public.user_has_permission(user_id UUID, permission_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.users u
    JOIN public.role_permissions rp ON u.role::TEXT = rp.role_id
    WHERE u.id = user_id AND rp.permission_id = permission_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Step 13: Create helper function to get user permissions
CREATE OR REPLACE FUNCTION public.get_user_permissions(user_id UUID)
RETURNS TABLE(permission_id TEXT, permission_name TEXT, category TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as permission_id,
    p.name as permission_name,
    p.category
  FROM public.users u
  JOIN public.role_permissions rp ON u.role::TEXT = rp.role_id
  JOIN public.permissions p ON rp.permission_id = p.id
  WHERE u.id = user_id
  ORDER BY p.category, p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Step 14: Create helper function to get role permissions
CREATE OR REPLACE FUNCTION public.get_role_permissions(role_name TEXT)
RETURNS TABLE(permission_id TEXT, permission_name TEXT, category TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as permission_id,
    p.name as permission_name,
    p.category
  FROM public.role_permissions rp
  JOIN public.permissions p ON rp.permission_id = p.id
  WHERE rp.role_id = role_name
  ORDER BY p.category, p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Step 15: Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.permissions TO authenticated;
GRANT SELECT ON public.roles TO authenticated;
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_permission(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_permissions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_role_permissions(TEXT) TO authenticated;

-- Verification queries (run these to check if everything is set up correctly)
-- SELECT COUNT(*) FROM public.permissions; -- Should return 20
-- SELECT COUNT(*) FROM public.roles; -- Should return 6
-- SELECT r.name, COUNT(rp.permission_id) as permission_count 
-- FROM public.roles r 
-- LEFT JOIN public.role_permissions rp ON r.id = rp.role_id 
-- GROUP BY r.id, r.name 
-- ORDER BY r.name;
-- SELECT * FROM public.get_role_permissions('admin');

