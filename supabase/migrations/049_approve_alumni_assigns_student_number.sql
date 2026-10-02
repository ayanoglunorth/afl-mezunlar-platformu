-- ============================================
-- Migration 049: Admin approval assigns student number
-- ============================================

CREATE OR REPLACE FUNCTION public.admin_approve_pending_alumni(p_user_id UUID)
RETURNS boolean AS $$
DECLARE
  v_target RECORD;
  v_registry_id BIGINT;
  v_registry_student_number TEXT;
  v_normalized_name TEXT;
  v_match_count INTEGER;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Admin required.';
  END IF;

  SELECT id, role, is_verified, full_name, graduation_year
  INTO v_target
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND OR v_target.role <> 'alumni' OR v_target.is_verified THEN
    RETURN FALSE;
  END IF;

  -- Normalize the name to match the registry
  v_normalized_name := UPPER(BTRIM(v_target.full_name));

  -- Try to find exactly one matching unclaimed registry entry by name and year
  IF v_target.graduation_year IS NOT NULL THEN
    SELECT COUNT(*)
    INTO v_match_count
    FROM public.alumni_registry
    WHERE full_name_normalized = v_normalized_name
      AND graduation_year = v_target.graduation_year
      AND is_claimed = FALSE;

    IF v_match_count = 1 THEN
      SELECT id, student_number
      INTO v_registry_id, v_registry_student_number
      FROM public.alumni_registry
      WHERE full_name_normalized = v_normalized_name
        AND graduation_year = v_target.graduation_year
        AND is_claimed = FALSE
      LIMIT 1;

      -- Claim it in the registry
      UPDATE public.alumni_registry
      SET is_claimed = TRUE, claimed_by = p_user_id
      WHERE id = v_registry_id;
      
      -- Set the profile as verified WITH the found student number
      UPDATE public.profiles
      SET is_verified = TRUE,
          student_number = BTRIM(v_registry_student_number)
      WHERE id = p_user_id;
    ELSE
      -- Could not reliably find one entry, just verify the profile
      UPDATE public.profiles
      SET is_verified = TRUE
      WHERE id = p_user_id;
    END IF;
  ELSE
    -- Missing graduation year, just verify the profile
    UPDATE public.profiles
    SET is_verified = TRUE
    WHERE id = p_user_id;
  END IF;

  INSERT INTO public.admin_audit_logs (actor_id, target_id, action, metadata)
  VALUES (auth.uid(), p_user_id, 'approved_pending_alumni', '{}'::jsonb);

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path = public, pg_temp;
