-- Delete Auth users through tightly authorized database RPCs.
-- NIST: This protects account lifecycle availability while failing closed.
-- Attack scenario: a missing service-role secret prevents admins from rejecting
-- fake registrations or users from deleting their own account after OTP proof.

CREATE OR REPLACE FUNCTION public.admin_reject_pending_alumni(p_user_id UUID)
RETURNS boolean AS $$
DECLARE
  v_target RECORD;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Admin required.';
  END IF;

  SELECT id, role, is_verified
  INTO v_target
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND OR v_target.role <> 'alumni' OR v_target.is_verified THEN
    RETURN FALSE;
  END IF;

  UPDATE public.alumni_registry
  SET is_claimed = FALSE,
      claimed_by = NULL
  WHERE claimed_by = p_user_id;

  INSERT INTO public.admin_audit_logs (actor_id, target_id, action, metadata)
  VALUES (
    auth.uid(),
    p_user_id,
    'rejected_pending_alumni',
    jsonb_build_object('target_user_id', p_user_id)
  );

  DELETE FROM auth.users
  WHERE id = p_user_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path = public, auth, pg_temp;

CREATE OR REPLACE FUNCTION public.admin_delete_platform_user(p_user_id UUID)
RETURNS boolean AS $$
DECLARE
  v_target RECORD;
  v_target_privilege RECORD;
BEGIN
  IF NOT public.can_manage_admins(auth.uid()) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Admin manager required.';
  END IF;

  IF p_user_id IS NULL OR p_user_id = auth.uid() THEN
    RETURN FALSE;
  END IF;

  SELECT id, role
  INTO v_target
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  SELECT *
  INTO v_target_privilege
  FROM public.admin_privileges
  WHERE user_id = p_user_id;

  IF (v_target.role = 'admin' OR v_target_privilege.user_id IS NOT NULL)
     AND public.count_platform_admins_excluding(p_user_id) < 1 THEN
    RETURN FALSE;
  END IF;

  IF COALESCE(v_target_privilege.can_manage_admins, FALSE)
     AND public.count_admin_managers_excluding(p_user_id) < 1 THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.admin_audit_logs (actor_id, target_id, action, metadata)
  VALUES (
    auth.uid(),
    p_user_id,
    'admin_deleted_user',
    jsonb_build_object(
      'target_user_id', p_user_id,
      'target_role', v_target.role::TEXT,
      'was_admin', v_target.role = 'admin' OR v_target_privilege.user_id IS NOT NULL,
      'was_admin_manager', COALESCE(v_target_privilege.can_manage_admins, FALSE)
    )
  );

  DELETE FROM auth.users
  WHERE id = p_user_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path = public, auth, pg_temp;

CREATE OR REPLACE FUNCTION public.user_delete_own_account()
RETURNS boolean AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Authentication required.';
  END IF;

  INSERT INTO public.admin_audit_logs (actor_id, target_id, action, metadata)
  VALUES (v_user_id, v_user_id, 'user_requested_account_deletion', '{}'::jsonb);

  DELETE FROM auth.users
  WHERE id = v_user_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path = public, auth, pg_temp;

REVOKE ALL ON FUNCTION public.admin_reject_pending_alumni(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_delete_platform_user(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.user_delete_own_account() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.admin_reject_pending_alumni(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_platform_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_delete_own_account() TO authenticated;

NOTIFY pgrst, 'reload schema';
