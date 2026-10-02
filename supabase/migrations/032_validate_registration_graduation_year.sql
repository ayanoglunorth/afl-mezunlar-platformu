-- Keep registration metadata consistent with the private alumni registry.
-- NIST: This protects identity and graduation claims. Attack scenario: a
-- client bypasses the form and sends a real registry id/student number with a
-- manipulated graduation year in auth metadata.

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
    is_profile_complete
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
      WHEN safe_role = 'alumni' AND NOT registry_identity_matches THEN NULL
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
    END
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

NOTIFY pgrst, 'reload schema';
