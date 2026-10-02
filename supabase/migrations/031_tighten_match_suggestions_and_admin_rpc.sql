-- Tighten remaining Supabase advisor warnings that can be fixed without
-- breaking browser flows.
-- NIST: Bu migration eşleşme önerisi üretimini ve admin sorgularını korumak
-- için var. Saldırı senaryosu: normal kullanıcı kendi lehine eşleşme önerisi
-- satırı üretir veya admin RPC'sine farklı UUID vererek yetkili kullanıcıları
-- enumere etmeye çalışır.

DROP POLICY IF EXISTS "Service can insert suggestions" ON public.match_suggestions;

CREATE OR REPLACE FUNCTION public.is_platform_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = p_user_id
      AND profiles.role = 'admin'
  )
  OR EXISTS (
    SELECT 1
    FROM public.admin_privileges
    WHERE admin_privileges.user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.can_manage_admins(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.admin_privileges
    WHERE admin_privileges.user_id = p_user_id
      AND admin_privileges.can_manage_admins = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.can_manage_admins(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_admins(UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
