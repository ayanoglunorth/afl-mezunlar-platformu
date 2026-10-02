-- ============================================
-- Migration 085: Fix active student registry UTF-8 constraints
-- ============================================

ALTER TABLE public.active_student_registry
  DROP CONSTRAINT IF EXISTS active_student_registry_grade_check,
  DROP CONSTRAINT IF EXISTS active_student_registry_section_check;

ALTER TABLE public.active_student_registry
  ADD CONSTRAINT active_student_registry_grade_check
    CHECK (current_grade IN ('10. Sınıf', '11. Sınıf', '12. Sınıf')),
  ADD CONSTRAINT active_student_registry_section_check
    CHECK (class_section ~ '^[A-ZÇĞİÖŞÜ]{1,3}$');

CREATE OR REPLACE FUNCTION public.verify_active_student_registration(
  p_school_number TEXT,
  p_full_name_normalized TEXT,
  p_current_grade TEXT,
  p_class_section TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_entry RECORD;
  v_school_number TEXT := NULLIF(BTRIM(p_school_number), '');
  v_full_name_normalized TEXT := NULLIF(UPPER(BTRIM(p_full_name_normalized)), '');
  v_current_grade TEXT := NULLIF(BTRIM(p_current_grade), '');
  v_class_section TEXT := NULLIF(UPPER(BTRIM(p_class_section)), '');
BEGIN
  IF v_school_number IS NULL
     OR v_school_number !~ '^[0-9]{1,8}$'
     OR v_full_name_normalized IS NULL
     OR v_current_grade NOT IN ('10. Sınıf', '11. Sınıf', '12. Sınıf')
     OR v_class_section IS NULL
     OR v_class_section !~ '^[A-ZÇĞİÖŞÜ]{1,3}$' THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'invalid');
  END IF;

  SELECT id, student_number, school_number, current_grade, class_section, expected_graduation_year, is_claimed
  INTO v_entry
  FROM public.active_student_registry
  WHERE school_number = v_school_number
    AND full_name_normalized = v_full_name_normalized
    AND current_grade = v_current_grade
    AND class_section = v_class_section
  LIMIT 1;

  IF NOT FOUND OR v_entry.is_claimed THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'invalid');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE BTRIM(student_number) = BTRIM(v_entry.student_number)
  ) THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'already_registered');
  END IF;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'entry', jsonb_build_object(
      'id', v_entry.id,
      'student_number', v_entry.student_number,
      'school_number', v_entry.school_number,
      'current_grade', v_entry.current_grade,
      'class_section', v_entry.class_section,
      'expected_graduation_year', v_entry.expected_graduation_year
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

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
  metadata_school_number TEXT;
  metadata_registry_entry_id BIGINT;
  metadata_active_student_registry_entry_id BIGINT;
  metadata_current_grade TEXT;
  metadata_class_section TEXT;
  registry_identity_matches BOOLEAN := FALSE;
  registry_number_matches BOOLEAN := FALSE;
  active_student_matches BOOLEAN := FALSE;
  active_student_entry RECORD;
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
  metadata_school_number := NULLIF(BTRIM(COALESCE(NEW.raw_user_meta_data->>'school_number', NEW.raw_user_meta_data->>'student_school_number')), '');
  metadata_registry_entry_id := CASE
    WHEN COALESCE(NEW.raw_user_meta_data->>'registry_entry_id', '') ~ '^[0-9]+$'
      THEN (NEW.raw_user_meta_data->>'registry_entry_id')::BIGINT
    ELSE NULL
  END;
  metadata_active_student_registry_entry_id := CASE
    WHEN COALESCE(NEW.raw_user_meta_data->>'active_student_registry_entry_id', '') ~ '^[0-9]+$'
      THEN (NEW.raw_user_meta_data->>'active_student_registry_entry_id')::BIGINT
    ELSE NULL
  END;
  metadata_current_grade := NULLIF(BTRIM(NEW.raw_user_meta_data->>'current_grade'), '');
  metadata_class_section := NULLIF(UPPER(BTRIM(NEW.raw_user_meta_data->>'class_section')), '');
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

  IF safe_role = 'student'
     AND metadata_active_student_registry_entry_id IS NOT NULL
     AND metadata_school_number IS NOT NULL
     AND metadata_current_grade IN ('10. Sınıf', '11. Sınıf', '12. Sınıf')
     AND metadata_class_section IS NOT NULL THEN
    SELECT id, student_number, school_number, current_grade, class_section, expected_graduation_year
    INTO active_student_entry
    FROM public.active_student_registry registry
    WHERE registry.id = metadata_active_student_registry_entry_id
      AND registry.school_number = metadata_school_number
      AND registry.full_name_normalized = normalized_full_name
      AND registry.current_grade = metadata_current_grade
      AND registry.class_section = metadata_class_section
      AND registry.is_claimed = FALSE
    LIMIT 1;

    active_student_matches := FOUND
      AND metadata_student_number IS NOT NULL
      AND BTRIM(active_student_entry.student_number) = metadata_student_number;
  END IF;

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
    class_section,
    active_student_registry_entry_id,
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
      WHEN active_student_matches THEN active_student_entry.student_number
      WHEN safe_role = 'student' AND metadata_current_grade = 'YKS 2026 Yeni Mezun' THEN metadata_student_number
      ELSE NULL
    END,
    COALESCE(NEW.raw_user_meta_data->>'field_of_study', NEW.raw_user_meta_data->>'target_field'),
    CASE
      WHEN safe_role = 'alumni' AND NOT registry_identity_matches AND safe_review_reason IS NULL THEN NULL
      ELSE safe_graduation_year
    END,
    NEW.raw_user_meta_data->>'university',
    NEW.raw_user_meta_data->>'department',
    CASE
      WHEN active_student_matches THEN active_student_entry.current_grade
      ELSE metadata_current_grade
    END,
    CASE
      WHEN active_student_matches THEN active_student_entry.class_section
      ELSE NULL
    END,
    CASE
      WHEN active_student_matches THEN active_student_entry.id
      ELSE NULL
    END,
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
    CASE
      WHEN safe_role = 'alumni' THEN registry_number_matches
      WHEN safe_role = 'student' THEN active_student_matches OR registry_number_matches
      ELSE FALSE
    END,
    CASE
      WHEN safe_role = 'alumni' THEN (
        registry_number_matches
        AND NULLIF(BTRIM(NEW.raw_user_meta_data->>'university'), '') IS NOT NULL
        AND NULLIF(BTRIM(NEW.raw_user_meta_data->>'department'), '') IS NOT NULL
      )
      ELSE (
        (active_student_matches OR registry_number_matches OR metadata_current_grade = 'YKS 2026 Yeni Mezun')
        AND NULLIF(BTRIM(metadata_current_grade), '') IS NOT NULL
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

  IF active_student_matches THEN
    UPDATE public.active_student_registry
    SET is_claimed = TRUE,
        claimed_by = NEW.id
    WHERE id = active_student_entry.id
      AND is_claimed = FALSE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

NOTIFY pgrst, 'reload schema';
