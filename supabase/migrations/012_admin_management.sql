-- ============================================
-- Migration 012: Admin Management Hardening
-- ============================================
-- Separates platform administration from user profile roles and prevents
-- client-provided signup metadata from creating admin users.

CREATE TABLE IF NOT EXISTS admin_privileges (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  can_manage_admins BOOLEAN NOT NULL DEFAULT FALSE,
  granted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_privileges_manage_admins
  ON admin_privileges(can_manage_admins)
  WHERE can_manage_admins = TRUE;

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  target_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at
  ON admin_audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor
  ON admin_audit_logs(actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target
  ON admin_audit_logs(target_id, created_at DESC);

CREATE OR REPLACE FUNCTION is_platform_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = p_user_id
      AND profiles.role = 'admin'
  )
  OR EXISTS (
    SELECT 1
    FROM admin_privileges
    WHERE admin_privileges.user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION can_manage_admins(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM admin_privileges
    WHERE admin_privileges.user_id = p_user_id
      AND admin_privileges.can_manage_admins = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION is_platform_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION can_manage_admins(UUID) TO authenticated;

ALTER TABLE admin_privileges ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view admin privileges" ON admin_privileges;
CREATE POLICY "Admins can view admin privileges"
  ON admin_privileges FOR SELECT
  TO authenticated
  USING (is_platform_admin(auth.uid()) OR user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view audit logs" ON admin_audit_logs;
CREATE POLICY "Admins can view audit logs"
  ON admin_audit_logs FOR SELECT
  TO authenticated
  USING (is_platform_admin(auth.uid()));

-- Bootstrap existing legacy admins so at least one trusted admin can manage
-- the new permission layer after the migration is applied.
INSERT INTO admin_privileges (user_id, can_manage_admins)
SELECT id, TRUE
FROM profiles
WHERE role = 'admin'
ON CONFLICT (user_id) DO UPDATE
SET can_manage_admins = TRUE,
    updated_at = NOW();

CREATE TRIGGER admin_privileges_updated_at
  BEFORE UPDATE ON admin_privileges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Harden signup: client metadata may only create student/alumni profiles.
-- Admin access must be granted through admin_privileges or direct trusted SQL.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  requested_role TEXT;
  safe_role user_role;
BEGIN
  requested_role := NEW.raw_user_meta_data->>'role';
  safe_role := CASE
    WHEN requested_role = 'alumni' THEN 'alumni'::user_role
    ELSE 'student'::user_role
  END;

  INSERT INTO public.profiles (
    id,
    full_name,
    role,
    student_number,
    field_of_study,
    graduation_year,
    university,
    department,
    current_grade,
    target_field,
    target_departments,
    target_universities,
    mentorship_expectations,
    education_status,
    is_working,
    company_name,
    company_logo,
    work_title,
    linkedin_url,
    mentorship_capacity,
    mentorship_topics,
    mentorship_availability,
    is_verified,
    is_profile_complete
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    safe_role,
    NEW.raw_user_meta_data->>'student_number',
    COALESCE(NEW.raw_user_meta_data->>'field_of_study', NEW.raw_user_meta_data->>'target_field'),
    NULLIF(NEW.raw_user_meta_data->>'graduation_year', '')::INTEGER,
    NEW.raw_user_meta_data->>'university',
    NEW.raw_user_meta_data->>'department',
    NEW.raw_user_meta_data->>'current_grade',
    COALESCE(NEW.raw_user_meta_data->>'target_field', NEW.raw_user_meta_data->>'field_of_study'),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'target_departments')), '{}'),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'target_universities')), '{}'),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'mentorship_expectations')), '{}'),
    NEW.raw_user_meta_data->>'education_status',
    COALESCE((NEW.raw_user_meta_data->>'is_working')::BOOLEAN, FALSE),
    NEW.raw_user_meta_data->>'company_name',
    NEW.raw_user_meta_data->>'company_logo',
    NEW.raw_user_meta_data->>'work_title',
    NEW.raw_user_meta_data->>'linkedin_url',
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'mentorship_capacity', '')::INTEGER, 5),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'mentorship_topics')), '{}'),
    COALESCE(NEW.raw_user_meta_data->>'mentorship_availability', 'active'),
    COALESCE((NEW.raw_user_meta_data->>'is_verified')::BOOLEAN, FALSE),
    COALESCE((NEW.raw_user_meta_data->>'is_profile_complete')::BOOLEAN, FALSE)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
