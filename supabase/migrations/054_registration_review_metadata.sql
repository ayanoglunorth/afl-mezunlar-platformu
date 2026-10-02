-- Persist manual alumni registration review metadata for admin screens.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS registration_review_reason TEXT,
  ADD COLUMN IF NOT EXISTS registration_registry_entry_id BIGINT REFERENCES public.alumni_registry(id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_registration_review_reason_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_registration_review_reason_check
      CHECK (
        registration_review_reason IS NULL
        OR registration_review_reason IN ('forgot_school_number', 'transferred_from_school')
      );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  requested_role TEXT;
  safe_role user_role;
  raw_nickname TEXT;
  safe_nickname TEXT;
  clean_full_name TEXT;
  normalized_full_name TEXT;
  metadata_student_number TEXT;
  metadata_registry_entry_id BIGINT;
  registry_identity_matches BOOLEAN := FALSE;
  registry_number_matches BOOLEAN := FALSE;
  safe_capacity INTEGER := 5;
  safe_graduation_year INTEGER;
  metadata_review_reason TEXT;
  safe_review_reason TEXT;
  safe_review_registry_entry_id BIGINT;
BEGIN
  requested_role := NEW.raw_user_meta_data->>'role';
  safe_role := CASE
    WHEN requested_role = 'alumni' THEN 'alumni'::user_role
    ELSE 'student'::user_role
  END;

  raw_nickname := LOWER(NULLIF(TRIM(NEW.raw_user_meta_data->>'nickname'), ''));
  safe_nickname := CASE
    WHEN raw_nickname ~ '^[a-z0-9][a-z0-9._]{1,30}[a-z0-9]$' THEN raw_nickname
    ELSE NULL
  END;

  clean_full_name := NULLIF(BTRIM(COALESCE(NEW.raw_user_meta_data->>'full_name', '')), '');
  normalized_full_name := UPPER(clean_full_name);
  metadata_student_number := NULLIF(BTRIM(NEW.raw_user_meta_data->>'student_number'), '');
  metadata_registry_entry_id := CASE
    WHEN COALESCE(NEW.raw_user_meta_data->>'registry_entry_id', '') ~ '^[0-9]+$'
      THEN (NEW.raw_user_meta_data->>'registry_entry_id')::BIGINT
    ELSE NULL
  END;
  safe_graduation_year := CASE
    WHEN COALESCE(NEW.raw_user_meta_data->>'graduation_year', '') ~ '^[0-9]{4}$'
      AND (NEW.raw_user_meta_data->>'graduation_year')::INTEGER
        BETWEEN 1900 AND EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
      THEN (NEW.raw_user_meta_data->>'graduation_year')::INTEGER
    ELSE NULL
  END;
  metadata_review_reason := NEW.raw_user_meta_data->>'registration_review_reason';
  safe_review_reason := CASE
    WHEN safe_role = 'alumni'
      AND metadata_review_reason IN ('forgot_school_number', 'transferred_from_school')
      THEN metadata_review_reason
    ELSE NULL
  END;

  IF metadata_registry_entry_id IS NOT NULL AND safe_graduation_year IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.alumni_registry registry
      WHERE registry.id = metadata_registry_entry_id
        AND registry.full_name_normalized = normalized_full_name
        AND registry.graduation_year = safe_graduation_year
        AND registry.is_claimed = FALSE
    )
    INTO registry_identity_matches;
  END IF;

  registry_number_matches :=
    registry_identity_matches
    AND metadata_student_number IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.alumni_registry registry
      WHERE registry.id = metadata_registry_entry_id
        AND BTRIM(registry.student_number) = metadata_student_number
    );

  safe_review_registry_entry_id := CASE
    WHEN safe_review_reason = 'forgot_school_number' AND registry_identity_matches
      THEN metadata_registry_entry_id
    ELSE NULL
  END;

  safe_capacity := CASE
    WHEN COALESCE(NEW.raw_user_meta_data->>'mentorship_capacity', '') ~ '^[0-9]+$'
      THEN LEAST(GREATEST((NEW.raw_user_meta_data->>'mentorship_capacity')::INTEGER, 1), 5)
    ELSE 5
  END;

  INSERT INTO public.profiles (
    id,
    full_name,
    nickname,
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
    is_profile_complete,
    registration_review_reason,
    registration_registry_entry_id
  )
  VALUES (
    NEW.id,
    COALESCE(clean_full_name, ''),
    safe_nickname,
    safe_role,
    CASE
      WHEN registry_number_matches THEN metadata_student_number
      WHEN safe_role = 'student' THEN metadata_student_number
      ELSE NULL
    END,
    COALESCE(NEW.raw_user_meta_data->>'field_of_study', NEW.raw_user_meta_data->>'target_field'),
    CASE
      WHEN safe_role = 'alumni' AND NOT registry_identity_matches AND safe_review_reason IS NULL THEN NULL
      ELSE safe_graduation_year
    END,
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
    safe_capacity,
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'mentorship_topics')), '{}'),
    CASE
      WHEN safe_role = 'alumni' AND registry_number_matches THEN 'active'
      ELSE 'unavailable'
    END,
    registry_number_matches,
    CASE
      WHEN safe_role = 'alumni' THEN (
        registry_number_matches
        AND NULLIF(BTRIM(NEW.raw_user_meta_data->>'university'), '') IS NOT NULL
        AND NULLIF(BTRIM(NEW.raw_user_meta_data->>'department'), '') IS NOT NULL
      )
      ELSE (
        NULLIF(BTRIM(NEW.raw_user_meta_data->>'current_grade'), '') IS NOT NULL
        AND NULLIF(BTRIM(COALESCE(NEW.raw_user_meta_data->>'target_field', NEW.raw_user_meta_data->>'field_of_study')), '') IS NOT NULL
      )
    END,
    safe_review_reason,
    safe_review_registry_entry_id
  );

  IF registry_number_matches THEN
    UPDATE public.alumni_registry
    SET is_claimed = TRUE,
        claimed_by = NEW.id
    WHERE id = metadata_registry_entry_id
      AND is_claimed = FALSE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

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

  SELECT id, role, is_verified, full_name, graduation_year, registration_review_reason, registration_registry_entry_id
  INTO v_target
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND OR v_target.role <> 'alumni' OR v_target.is_verified THEN
    RETURN FALSE;
  END IF;

  IF v_target.registration_review_reason = 'transferred_from_school' THEN
    UPDATE public.profiles
    SET is_verified = TRUE
    WHERE id = p_user_id;
  ELSIF v_target.registration_review_reason = 'forgot_school_number'
        AND v_target.registration_registry_entry_id IS NOT NULL THEN
    SELECT id, student_number
    INTO v_registry_id, v_registry_student_number
    FROM public.alumni_registry
    WHERE id = v_target.registration_registry_entry_id
      AND is_claimed = FALSE
    LIMIT 1;

    IF FOUND THEN
      UPDATE public.alumni_registry
      SET is_claimed = TRUE, claimed_by = p_user_id
      WHERE id = v_registry_id;

      UPDATE public.profiles
      SET is_verified = TRUE,
          student_number = BTRIM(v_registry_student_number)
      WHERE id = p_user_id;
    ELSE
      UPDATE public.profiles
      SET is_verified = TRUE
      WHERE id = p_user_id;
    END IF;
  ELSIF v_target.graduation_year IS NOT NULL THEN
    v_normalized_name := UPPER(BTRIM(v_target.full_name));

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

      UPDATE public.alumni_registry
      SET is_claimed = TRUE, claimed_by = p_user_id
      WHERE id = v_registry_id;

      UPDATE public.profiles
      SET is_verified = TRUE,
          student_number = BTRIM(v_registry_student_number)
      WHERE id = p_user_id;
    ELSE
      UPDATE public.profiles
      SET is_verified = TRUE
      WHERE id = p_user_id;
    END IF;
  ELSE
    UPDATE public.profiles
    SET is_verified = TRUE
    WHERE id = p_user_id;
  END IF;

  INSERT INTO public.admin_audit_logs (actor_id, target_id, action, metadata)
  VALUES (
    auth.uid(),
    p_user_id,
    'approved_pending_alumni',
    jsonb_build_object('registration_review_reason', v_target.registration_review_reason)
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path = public, pg_temp;

NOTIFY pgrst, 'reload schema';
