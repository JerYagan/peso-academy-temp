-- Create audit_logs table for tracking authentication and security events
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type VARCHAR(50) NOT NULL,
  event_category VARCHAR(50) NOT NULL DEFAULT 'authentication',
  description TEXT,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON public.audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_category ON public.audit_logs(event_category);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_success ON public.audit_logs(success);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admins can view all audit logs
CREATE POLICY "Admins can view all audit logs"
  ON public.audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Service role can insert audit logs (for server-side logging)
CREATE POLICY "Service role can insert audit logs"
  ON public.audit_logs
  FOR INSERT
  WITH CHECK (true);

-- Users can view their own audit logs
CREATE POLICY "Users can view own audit logs"
  ON public.audit_logs
  FOR SELECT
  USING (user_id = auth.uid());

-- Function to log audit events (can be called from client or server)
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_user_id UUID,
  p_event_type VARCHAR,
  p_event_category VARCHAR DEFAULT 'authentication',
  p_description TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_success BOOLEAN DEFAULT true,
  p_error_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    event_type,
    event_category,
    description,
    ip_address,
    user_agent,
    metadata,
    success,
    error_message
  ) VALUES (
    p_user_id,
    p_event_type,
    p_event_category,
    p_description,
    p_ip_address,
    p_user_agent,
    p_metadata,
    p_success,
    p_error_message
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- Create a view for easier querying (with user email for display)
CREATE OR REPLACE VIEW public.audit_logs_view AS
SELECT 
  al.id,
  al.user_id,
  u.email as user_email,
  u.name as user_name,
  al.event_type,
  al.event_category,
  al.description,
  al.ip_address,
  al.user_agent,
  al.metadata,
  al.success,
  al.error_message,
  al.created_at
FROM public.audit_logs al
LEFT JOIN public.users u ON al.user_id = u.id
ORDER BY al.created_at DESC;

-- Grant permissions
GRANT SELECT ON public.audit_logs_view TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_audit_event TO authenticated;

-- Add comment
COMMENT ON TABLE public.audit_logs IS 'Stores audit logs for authentication and security events';
COMMENT ON COLUMN public.audit_logs.event_type IS 'Type of event: login, logout, login_failed, password_reset, etc.';
COMMENT ON COLUMN public.audit_logs.event_category IS 'Category: authentication, authorization, security, etc.';
COMMENT ON COLUMN public.audit_logs.metadata IS 'Additional event data in JSON format';

