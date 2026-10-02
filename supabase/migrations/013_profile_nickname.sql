-- ============================================
-- Migration 013: Profile Nicknames
-- ============================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS nickname TEXT;

ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_nickname_format;

ALTER TABLE profiles
ADD CONSTRAINT profiles_nickname_format
CHECK (
  nickname IS NULL
  OR nickname ~ '^[a-z0-9][a-z0-9._]{1,30}[a-z0-9]$'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_nickname_unique
  ON profiles (LOWER(nickname))
  WHERE nickname IS NOT NULL;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  requested_role TEXT;
  safe_role user_role;
  raw_nickname TEXT;
  safe_nickname TEXT;
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
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    safe_nickname,
    safe_role,
    NEW.raw_user_meta_data->>'student_number',
    COALESCE(NEW.raw_user_meta_data->>'field_of_study', NEW.raw_user_meta_data->>'target_field'),
    NULLIF(NEW.raw_user_meta_data->>'graduation_year', '')::INTEGER,
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
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'mentorship_capacity', '')::INTEGER, 5),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'mentorship_topics')), '{}'),
    COALESCE(NEW.raw_user_meta_data->>'mentorship_availability', 'active'),
    COALESCE((NEW.raw_user_meta_data->>'is_verified')::BOOLEAN, FALSE),
    COALESCE((NEW.raw_user_meta_data->>'is_profile_complete')::BOOLEAN, FALSE)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
