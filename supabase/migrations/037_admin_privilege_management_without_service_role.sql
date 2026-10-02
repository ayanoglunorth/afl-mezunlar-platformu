-- Manage platform admin privileges through authenticated RPCs.
-- NIST: This protects privileged workflow availability while preserving
-- server-side authorization. Attack scenario: an admin cannot grant/revoke
-- privileges because the service-role secret is unavailable in the runtime.

CREATE OR REPLACE FUNCTION public.count_platform_admins_excluding(p_user_id UUID)
RETURNS integer AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM (
    SELECT id AS user_id FROM public.profiles WHERE role = 'admin'
    UNION
    SELECT user_id FROM public.admin_privileges
  ) AS admins
  WHERE admins.user_id <> p_user_id;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.count_admin_managers_excluding(p_user_id UUID)
RETURNS integer AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM public.admin_privileges
  WHERE can_manage_admins = TRUE
    AND user_id <> p_user_id;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.admin_manage_privilege(
  p_action TEXT,
  p_target_user_id UUID,
  p_demote_to user_role DEFAULT NULL
)
RETURNS boolean AS $$
DECLARE
  v_target RECORD;
  v_target_privilege RECORD;
BEGIN
  IF NOT public.can_manage_admins(auth.uid()) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Admin manager required.';
  END IF;

  IF p_target_user_id IS NULL OR p_target_user_id = auth.uid() THEN
    RETURN FALSE;
  END IF;

  SELECT id, role
  INTO v_target
  FROM public.profiles
  WHERE id = p_target_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  SELECT *
  INTO v_target_privilege
  FROM public.admin_privileges
  WHERE user_id = p_target_user_id;

  IF p_action = 'grant_admin' THEN
    INSERT INTO public.admin_privileges (user_id, can_manage_admins, granted_by)
    VALUES (p_target_user_id, FALSE, auth.uid())
    ON CONFLICT (user_id) DO UPDATE SET
      granted_by = auth.uid(),
      updated_at = NOW();

    INSERT INTO public.admin_audit_logs (actor_id, target_id, action, metadata)
    VALUES (auth.uid(), p_target_user_id, 'grant_admin', '{}'::jsonb);
    RETURN TRUE;
  END IF;

  IF p_action = 'revoke_admin' THEN
    IF v_target.role = 'admin' AND (p_demote_to IS NULL OR p_demote_to NOT IN ('student', 'alumni')) THEN
      RETURN FALSE;
    END IF;

    IF public.count_platform_admins_excluding(p_target_user_id) < 1 THEN
      RETURN FALSE;
    END IF;

    IF COALESCE(v_target_privilege.can_manage_admins, FALSE)
       AND public.count_admin_managers_excluding(p_target_user_id) < 1 THEN
      RETURN FALSE;
    END IF;

    DELETE FROM public.admin_privileges WHERE user_id = p_target_user_id;

    IF v_target.role = 'admin' THEN
      UPDATE public.profiles SET role = p_demote_to WHERE id = p_target_user_id;
    END IF;

    INSERT INTO public.admin_audit_logs (actor_id, target_id, action, metadata)
    VALUES (
      auth.uid(),
      p_target_user_id,
      'revoke_admin',
      jsonb_build_object('demoteTo', CASE WHEN v_target.role = 'admin' THEN p_demote_to::TEXT ELSE NULL END)
    );
    RETURN TRUE;
  END IF;

  IF p_action = 'grant_manager' THEN
    IF v_target.role <> 'admin' AND v_target_privilege.user_id IS NULL THEN
      RETURN FALSE;
    END IF;

    INSERT INTO public.admin_privileges (user_id, can_manage_admins, granted_by)
    VALUES (p_target_user_id, TRUE, auth.uid())
    ON CONFLICT (user_id) DO UPDATE SET
      can_manage_admins = TRUE,
      granted_by = auth.uid(),
      updated_at = NOW();

    INSERT INTO public.admin_audit_logs (actor_id, target_id, action, metadata)
    VALUES (auth.uid(), p_target_user_id, 'grant_manager', '{}'::jsonb);
    RETURN TRUE;
  END IF;

  IF p_action = 'revoke_manager' THEN
    IF NOT COALESCE(v_target_privilege.can_manage_admins, FALSE)
       OR public.count_admin_managers_excluding(p_target_user_id) < 1 THEN
      RETURN FALSE;
    END IF;

    UPDATE public.admin_privileges
    SET can_manage_admins = FALSE,
        updated_at = NOW()
    WHERE user_id = p_target_user_id;

    INSERT INTO public.admin_audit_logs (actor_id, target_id, action, metadata)
    VALUES (auth.uid(), p_target_user_id, 'revoke_manager', '{}'::jsonb);
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.count_platform_admins_excluding(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.count_admin_managers_excluding(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_manage_privilege(TEXT, UUID, user_role) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.admin_manage_privilege(TEXT, UUID, user_role) TO authenticated;

NOTIFY pgrst, 'reload schema';
