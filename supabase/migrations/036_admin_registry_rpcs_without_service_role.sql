-- Move non-Auth admin registry actions behind authenticated RPCs.
-- NIST: This protects admin workflow availability. Attack scenario: routine
-- registry/profile admin work fails because a service-role secret is missing,
-- even though the action can be safely authorized with the admin's own session.

CREATE OR REPLACE FUNCTION public.admin_approve_pending_alumni(p_user_id UUID)
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

  UPDATE public.profiles
  SET is_verified = TRUE
  WHERE id = p_user_id;

  INSERT INTO public.admin_audit_logs (actor_id, target_id, action, metadata)
  VALUES (auth.uid(), p_user_id, 'approved_pending_alumni', '{}'::jsonb);

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.admin_upsert_alumni_registry(
  p_rows JSONB,
  p_file_name TEXT DEFAULT NULL,
  p_parse_error_count INTEGER DEFAULT 0
)
RETURNS integer AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Admin required.';
  END IF;

  IF jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 OR jsonb_array_length(p_rows) > 5000 THEN
    RETURN 0;
  END IF;

  WITH incoming AS (
    SELECT *
    FROM jsonb_to_recordset(p_rows) AS row_data(
      sequence_number INTEGER,
      student_number TEXT,
      full_name TEXT,
      field_of_study TEXT,
      graduation_year INTEGER
    )
  ),
  cleaned AS (
    SELECT
      sequence_number,
      BTRIM(student_number) AS student_number,
      BTRIM(full_name) AS full_name,
      NULLIF(BTRIM(field_of_study), '') AS field_of_study,
      graduation_year
    FROM incoming
    WHERE BTRIM(student_number) ~ '^[0-9]{2,16}$'
      AND NULLIF(BTRIM(full_name), '') IS NOT NULL
      AND graduation_year BETWEEN 1900 AND EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
  ),
  upserted AS (
    INSERT INTO public.alumni_registry (
      sequence_number,
      student_number,
      full_name,
      field_of_study,
      graduation_year,
      uploaded_by
    )
    SELECT
      sequence_number,
      student_number,
      full_name,
      field_of_study,
      graduation_year,
      auth.uid()
    FROM cleaned
    ON CONFLICT (student_number) DO UPDATE SET
      sequence_number = EXCLUDED.sequence_number,
      full_name = EXCLUDED.full_name,
      field_of_study = EXCLUDED.field_of_study,
      graduation_year = EXCLUDED.graduation_year,
      uploaded_by = auth.uid(),
      uploaded_at = NOW()
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM upserted;

  INSERT INTO public.admin_audit_logs (actor_id, target_id, action, metadata)
  VALUES (
    auth.uid(),
    NULL,
    'upload_alumni_registry',
    jsonb_build_object(
      'rowCount', v_count,
      'parseErrorCount', COALESCE(p_parse_error_count, 0),
      'fileName', LEFT(COALESCE(p_file_name, ''), 180)
    )
  );

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.admin_approve_pending_alumni(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_upsert_alumni_registry(JSONB, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.admin_approve_pending_alumni(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_alumni_registry(JSONB, TEXT, INTEGER) TO authenticated;

NOTIFY pgrst, 'reload schema';
