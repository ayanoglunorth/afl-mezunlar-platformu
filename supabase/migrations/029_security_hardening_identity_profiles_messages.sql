-- Security hardening for identity, profile access, and read receipts.
-- NIST: Bu migration platform kimliğini, profil gizliliğini ve mesaj okundu
-- durumunu korumak için var. Saldırı senaryosu: istemci kayıt metadata'sına
-- doğrulanmış/admin-benzeri alanlar ekler, başka kullanıcı profillerinden fazla
-- veri çeker veya mesaj satırlarını okundu bahanesiyle geniş şekilde günceller.

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
  registry_matches BOOLEAN := FALSE;
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

  IF metadata_registry_entry_id IS NOT NULL AND metadata_student_number IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.alumni_registry registry
      WHERE registry.id = metadata_registry_entry_id
        AND BTRIM(registry.student_number) = metadata_student_number
        AND registry.full_name_normalized = normalized_full_name
        AND registry.is_claimed = FALSE
    )
    INTO registry_matches;
  END IF;

  safe_capacity := CASE
    WHEN COALESCE(NEW.raw_user_meta_data->>'mentorship_capacity', '') ~ '^[0-9]+$'
      THEN LEAST(GREATEST((NEW.raw_user_meta_data->>'mentorship_capacity')::INTEGER, 1), 5)
    ELSE 5
  END;

  safe_graduation_year := CASE
    WHEN COALESCE(NEW.raw_user_meta_data->>'graduation_year', '') ~ '^[0-9]{4}$'
      THEN (NEW.raw_user_meta_data->>'graduation_year')::INTEGER
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
    COALESCE(clean_full_name, ''),
    safe_nickname,
    safe_role,
    CASE
      WHEN registry_matches THEN metadata_student_number
      WHEN safe_role = 'student' THEN metadata_student_number
      ELSE NULL
    END,
    COALESCE(NEW.raw_user_meta_data->>'field_of_study', NEW.raw_user_meta_data->>'target_field'),
    safe_graduation_year,
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
      WHEN safe_role = 'alumni' AND registry_matches THEN 'active'
      ELSE 'unavailable'
    END,
    registry_matches,
    CASE
      WHEN safe_role = 'alumni' THEN (
        registry_matches
        AND NULLIF(BTRIM(NEW.raw_user_meta_data->>'university'), '') IS NOT NULL
        AND NULLIF(BTRIM(NEW.raw_user_meta_data->>'department'), '') IS NOT NULL
      )
      ELSE (
        NULLIF(BTRIM(NEW.raw_user_meta_data->>'current_grade'), '') IS NOT NULL
        AND NULLIF(BTRIM(COALESCE(NEW.raw_user_meta_data->>'target_field', NEW.raw_user_meta_data->>'field_of_study')), '') IS NOT NULL
      )
    END
  );

  IF registry_matches THEN
    UPDATE public.alumni_registry
    SET is_claimed = TRUE,
        claimed_by = NEW.id
    WHERE id = metadata_registry_entry_id
      AND is_claimed = FALSE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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

DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are visible to owner, admins, and completed profiles" ON public.profiles;
CREATE POLICY "Profiles are visible to owner, admins, and completed profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR is_profile_complete = TRUE
    OR public.is_platform_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
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
    AND mentorship_capacity BETWEEN 1 AND 5
    AND mentorship_availability IN ('active', 'unavailable')
  );

DROP POLICY IF EXISTS "Users can mark messages as read" ON public.messages;
DROP POLICY IF EXISTS "Participants can mark mentorship messages read" ON public.mentorship_messages;

CREATE OR REPLACE FUNCTION public.mark_social_messages_read(p_room_id UUID)
RETURNS UUID[] AS $$
DECLARE
  changed_ids UUID[];
BEGIN
  WITH updated AS (
    UPDATE public.messages AS message
    SET is_read = TRUE
    WHERE message.room_id = p_room_id
      AND message.is_read = FALSE
      AND message.sender_id <> auth.uid()
      AND EXISTS (
        SELECT 1
        FROM public.chat_rooms room
        WHERE room.id = p_room_id
          AND (room.user_a = auth.uid() OR room.user_b = auth.uid())
      )
    RETURNING message.id
  )
  SELECT COALESCE(array_agg(id), ARRAY[]::UUID[])
  INTO changed_ids
  FROM updated;

  RETURN changed_ids;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.mark_mentorship_messages_read(p_conversation_id UUID)
RETURNS UUID[] AS $$
DECLARE
  changed_ids UUID[];
BEGIN
  WITH updated AS (
    UPDATE public.mentorship_messages AS message
    SET is_read = TRUE
    WHERE message.conversation_id = p_conversation_id
      AND message.is_read = FALSE
      AND message.sender_id <> auth.uid()
      AND EXISTS (
        SELECT 1
        FROM public.mentorship_conversations conversation
        WHERE conversation.id = p_conversation_id
          AND (conversation.student_id = auth.uid() OR conversation.mentor_id = auth.uid())
      )
    RETURNING message.id
  )
  SELECT COALESCE(array_agg(id), ARRAY[]::UUID[])
  INTO changed_ids
  FROM updated;

  RETURN changed_ids;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.mark_social_messages_read(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_mentorship_messages_read(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_social_messages_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_mentorship_messages_read(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
