-- ============================================
-- Migration 084: Active student registry
-- ============================================
-- Keeps active student identity data private while allowing registration to
-- verify the exact name + school number + grade + class section combination.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS class_section TEXT,
  ADD COLUMN IF NOT EXISTS active_student_registry_entry_id BIGINT;

CREATE TABLE IF NOT EXISTS public.active_student_registry (
  id BIGSERIAL PRIMARY KEY,
  student_number TEXT NOT NULL UNIQUE,
  school_number TEXT NOT NULL,
  full_name TEXT NOT NULL,
  full_name_normalized TEXT NOT NULL,
  current_grade TEXT NOT NULL,
  class_section TEXT NOT NULL,
  expected_graduation_year INTEGER NOT NULL,
  is_claimed BOOLEAN NOT NULL DEFAULT FALSE,
  claimed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT active_student_registry_school_number_check
    CHECK (school_number ~ '^[0-9]{1,8}$'),
  CONSTRAINT active_student_registry_student_number_check
    CHECK (student_number ~ '^[0-9]{5,16}$'),
  CONSTRAINT active_student_registry_grade_check
    CHECK (current_grade IN ('10. Sınıf', '11. Sınıf', '12. Sınıf')),
  CONSTRAINT active_student_registry_section_check
    CHECK (class_section ~ '^[A-ZÇĞİÖŞÜ]{1,3}$'),
  CONSTRAINT active_student_registry_year_check
    CHECK (expected_graduation_year BETWEEN EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER AND 2100)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_active_student_registry_entry_id_fkey'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_active_student_registry_entry_id_fkey
      FOREIGN KEY (active_student_registry_entry_id)
      REFERENCES public.active_student_registry(id);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_active_student_registry_lookup
  ON public.active_student_registry (
    school_number,
    current_grade,
    class_section,
    full_name_normalized
  )
  WHERE is_claimed = FALSE;

CREATE INDEX IF NOT EXISTS idx_active_student_registry_claimed_by
  ON public.active_student_registry(claimed_by)
  WHERE claimed_by IS NOT NULL;

ALTER TABLE public.active_student_registry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage active student registry" ON public.active_student_registry;
CREATE POLICY "Admins can manage active student registry"
  ON public.active_student_registry FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.set_active_student_normalized_name()
RETURNS TRIGGER AS $$
BEGIN
  NEW.full_name := UPPER(BTRIM(NEW.full_name));
  NEW.full_name_normalized := UPPER(BTRIM(NEW.full_name));
  NEW.school_number := BTRIM(NEW.school_number);
  NEW.student_number := BTRIM(NEW.student_number);
  NEW.current_grade := BTRIM(NEW.current_grade);
  NEW.class_section := UPPER(BTRIM(NEW.class_section));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS active_student_registry_normalize_name ON public.active_student_registry;
CREATE TRIGGER active_student_registry_normalize_name
  BEFORE INSERT OR UPDATE ON public.active_student_registry
  FOR EACH ROW EXECUTE FUNCTION public.set_active_student_normalized_name();

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

CREATE OR REPLACE FUNCTION public.admin_upsert_active_student_registry(
  p_rows JSONB,
  p_file_name TEXT DEFAULT NULL,
  p_parse_error_count INTEGER DEFAULT 0
)
RETURNS INTEGER AS $$
DECLARE
  inserted_count INTEGER := 0;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Admin required.';
  END IF;

  IF jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Rows must be a JSON array.';
  END IF;

  WITH parsed AS (
    SELECT
      BTRIM(row_data->>'student_number') AS student_number,
      BTRIM(row_data->>'school_number') AS school_number,
      UPPER(BTRIM(row_data->>'full_name')) AS full_name,
      UPPER(BTRIM(row_data->>'full_name')) AS full_name_normalized,
      BTRIM(row_data->>'current_grade') AS current_grade,
      UPPER(BTRIM(row_data->>'class_section')) AS class_section,
      (row_data->>'expected_graduation_year')::INTEGER AS expected_graduation_year
    FROM jsonb_array_elements(p_rows) AS row_data
  ),
  upserted AS (
    INSERT INTO public.active_student_registry (
      student_number,
      school_number,
      full_name,
      full_name_normalized,
      current_grade,
      class_section,
      expected_graduation_year,
      uploaded_by
    )
    SELECT
      student_number,
      school_number,
      full_name,
      full_name_normalized,
      current_grade,
      class_section,
      expected_graduation_year,
      auth.uid()
    FROM parsed
    ON CONFLICT (student_number) DO UPDATE SET
      school_number = EXCLUDED.school_number,
      full_name = EXCLUDED.full_name,
      full_name_normalized = EXCLUDED.full_name_normalized,
      current_grade = EXCLUDED.current_grade,
      class_section = EXCLUDED.class_section,
      expected_graduation_year = EXCLUDED.expected_graduation_year,
      uploaded_at = NOW(),
      uploaded_by = auth.uid()
    WHERE public.active_student_registry.is_claimed = FALSE
    RETURNING 1
  )
  SELECT COUNT(*) INTO inserted_count FROM upserted;

  INSERT INTO public.admin_audit_logs (actor_id, action, metadata)
  VALUES (
    auth.uid(),
    'upload_active_student_registry',
    jsonb_build_object(
      'file_name', p_file_name,
      'row_count', jsonb_array_length(p_rows),
      'affected_count', inserted_count,
      'parse_error_count', COALESCE(p_parse_error_count, 0)
    )
  );

  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path = public, pg_temp;

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

DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles
WITH (security_invoker = true) AS
SELECT
  id,
  full_name,
  nickname,
  role,
  field_of_study,
  graduation_year,
  university,
  department,
  current_grade,
  class_section,
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
  avatar_url,
  bio,
  is_verified,
  is_profile_complete,
  created_at,
  updated_at
FROM public.profiles
WHERE is_profile_complete = TRUE
   OR id = auth.uid()
   OR public.is_platform_admin(auth.uid());

GRANT SELECT ON public.public_profiles TO authenticated;


DROP POLICY IF EXISTS "Users can update own profile (restricted)" ON public.profiles;
CREATE POLICY "Users can update own profile (restricted)"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
    AND is_verified = (SELECT p.is_verified FROM public.profiles p WHERE p.id = auth.uid())
    AND COALESCE(BTRIM(student_number), '') = COALESCE((SELECT BTRIM(p.student_number) FROM public.profiles p WHERE p.id = auth.uid()), '')
    AND COALESCE(BTRIM(class_section), '') = COALESCE((SELECT BTRIM(p.class_section) FROM public.profiles p WHERE p.id = auth.uid()), '')
    AND COALESCE(active_student_registry_entry_id, -1) = COALESCE((SELECT p.active_student_registry_entry_id FROM public.profiles p WHERE p.id = auth.uid()), -1)
    AND mentorship_capacity BETWEEN 1 AND 5
    AND mentorship_availability IN ('active', 'unavailable')
  );
REVOKE ALL ON FUNCTION public.verify_active_student_registration(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_upsert_active_student_registry(JSONB, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_active_student_normalized_name() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.verify_active_student_registration(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_active_student_registry(JSONB, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_active_student_normalized_name() TO service_role;

NOTIFY pgrst, 'reload schema';
