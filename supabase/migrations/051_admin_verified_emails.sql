-- ============================================
-- Migration 051: Admin Email Verification Count
-- ============================================

CREATE OR REPLACE FUNCTION public.admin_count_verified_emails()
RETURNS integer AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Admin required.';
  END IF;

  SELECT count(*) INTO v_count FROM auth.users WHERE email_confirmed_at IS NOT NULL;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
