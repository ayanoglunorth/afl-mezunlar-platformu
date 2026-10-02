-- ============================================
-- Migration 080: Lightweight admin context RPC
-- ============================================

CREATE OR REPLACE FUNCTION public.admin_get_context()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  result JSONB;
BEGIN
  IF current_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'userId', profile.id,
    'profile', jsonb_build_object(
      'id', profile.id,
      'full_name', profile.full_name,
      'role', profile.role
    ),
    'privilege', CASE
      WHEN privilege.user_id IS NULL THEN NULL
      ELSE to_jsonb(privilege)
    END,
    'isPlatformAdmin', profile.role = 'admin'::user_role OR privilege.user_id IS NOT NULL,
    'canManageAdmins', COALESCE(privilege.can_manage_admins, FALSE)
  )
  INTO result
  FROM public.profiles AS profile
  LEFT JOIN public.admin_privileges AS privilege ON privilege.user_id = profile.id
  WHERE profile.id = current_user_id
  LIMIT 1;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_context() TO authenticated;

NOTIFY pgrst, 'reload schema';
