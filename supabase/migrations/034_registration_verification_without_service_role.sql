-- Let registration verify private alumni identity without requiring the service role.
-- NIST: This protects signup availability while keeping the alumni registry
-- private. Attack scenario: a missing runtime secret turns registration into a
-- 500 error, or a public client tries to enumerate registry/profile rows.

CREATE OR REPLACE FUNCTION public.verify_registration_by_student_number(
  p_student_number TEXT,
  p_full_name_normalized TEXT,
  p_graduation_year INTEGER
)
RETURNS jsonb AS $$
DECLARE
  v_entry RECORD;
  v_student_number TEXT;
BEGIN
  v_student_number := NULLIF(BTRIM(p_student_number), '');

  IF v_student_number IS NULL
     OR p_full_name_normalized IS NULL
     OR p_graduation_year IS NULL
     OR p_graduation_year < 1900
     OR p_graduation_year > EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'invalid');
  END IF;

  SELECT id, student_number, graduation_year, field_of_study, full_name_normalized, is_claimed
  INTO v_entry
  FROM public.alumni_registry
  WHERE BTRIM(student_number) = v_student_number
  LIMIT 1;

  IF NOT FOUND
     OR v_entry.is_claimed
     OR v_entry.full_name_normalized <> p_full_name_normalized
     OR v_entry.graduation_year <> p_graduation_year THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'invalid');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE BTRIM(student_number) = v_student_number
  ) THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'already_registered');
  END IF;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'entry', jsonb_build_object(
      'id', v_entry.id,
      'student_number', v_entry.student_number,
      'graduation_year', v_entry.graduation_year,
      'field_of_study', v_entry.field_of_study
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.verify_registration_by_name_and_year(
  p_full_name_normalized TEXT,
  p_graduation_year INTEGER
)
RETURNS jsonb AS $$
DECLARE
  v_entry RECORD;
  v_count INTEGER;
BEGIN
  IF p_full_name_normalized IS NULL
     OR p_graduation_year IS NULL
     OR p_graduation_year < 1900
     OR p_graduation_year > EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'invalid');
  END IF;

  SELECT COUNT(*)
  INTO v_count
  FROM public.alumni_registry
  WHERE full_name_normalized = p_full_name_normalized
    AND graduation_year = p_graduation_year
    AND is_claimed = FALSE;

  IF v_count <> 1 THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'invalid');
  END IF;

  SELECT id, graduation_year, field_of_study
  INTO v_entry
  FROM public.alumni_registry
  WHERE full_name_normalized = p_full_name_normalized
    AND graduation_year = p_graduation_year
    AND is_claimed = FALSE
  LIMIT 1;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'entry', jsonb_build_object(
      'id', v_entry.id,
      'student_number', '',
      'graduation_year', v_entry.graduation_year,
      'field_of_study', v_entry.field_of_study
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.is_student_number_available_for_registration(
  p_student_number TEXT
)
RETURNS boolean AS $$
DECLARE
  v_student_number TEXT;
BEGIN
  v_student_number := NULLIF(BTRIM(p_student_number), '');

  IF v_student_number IS NULL OR v_student_number !~ '^[0-9]{2,16}$' THEN
    RETURN FALSE;
  END IF;

  RETURN NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE BTRIM(student_number) = v_student_number
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.verify_registration_by_student_number(TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_registration_by_name_and_year(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_student_number_available_for_registration(TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.verify_registration_by_student_number(TEXT, TEXT, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_registration_by_name_and_year(TEXT, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_student_number_available_for_registration(TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
