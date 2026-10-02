CREATE TABLE IF NOT EXISTS public.profile_name_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  old_full_name TEXT NOT NULL,
  requested_full_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_name_change_requests_one_pending
  ON public.profile_name_change_requests(user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_profile_name_change_requests_status_created
  ON public.profile_name_change_requests(status, created_at DESC);

DROP TRIGGER IF EXISTS profile_name_change_requests_updated_at ON public.profile_name_change_requests;
CREATE TRIGGER profile_name_change_requests_updated_at
  BEFORE UPDATE ON public.profile_name_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.profile_name_change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own name change requests" ON public.profile_name_change_requests;
CREATE POLICY "Users can view own name change requests"
  ON public.profile_name_change_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can submit own name change requests" ON public.profile_name_change_requests;
CREATE POLICY "Users can submit own name change requests"
  ON public.profile_name_change_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
  );

DROP POLICY IF EXISTS "Users can update own pending name change requests" ON public.profile_name_change_requests;
CREATE POLICY "Users can update own pending name change requests"
  ON public.profile_name_change_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
  );

CREATE OR REPLACE FUNCTION public.submit_profile_name_change(p_requested_full_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
SET search_path = public, pg_temp
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  current_name TEXT;
  clean_name TEXT := regexp_replace(btrim(coalesce(p_requested_full_name, '')), '\s+', ' ', 'g');
  result JSONB;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Authentication required.';
  END IF;

  IF char_length(clean_name) < 3 OR char_length(clean_name) > 120 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Ad soyad 3-120 karakter olmalidir.';
  END IF;

  SELECT full_name
  INTO current_name
  FROM public.profiles
  WHERE id = current_user_id
  FOR UPDATE;

  IF current_name IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Profile not found.';
  END IF;

  IF lower(clean_name) = lower(regexp_replace(btrim(current_name), '\s+', ' ', 'g')) THEN
    DELETE FROM public.profile_name_change_requests
    WHERE user_id = current_user_id
      AND status = 'pending';

    RETURN NULL;
  END IF;

  INSERT INTO public.profile_name_change_requests (
    user_id,
    old_full_name,
    requested_full_name,
    status,
    reviewed_by,
    reviewed_at
  )
  VALUES (
    current_user_id,
    current_name,
    clean_name,
    'pending',
    NULL,
    NULL
  )
  ON CONFLICT (user_id) WHERE status = 'pending'
  DO UPDATE SET
    old_full_name = EXCLUDED.old_full_name,
    requested_full_name = EXCLUDED.requested_full_name,
    reviewed_by = NULL,
    reviewed_at = NULL,
    updated_at = NOW()
  RETURNING jsonb_build_object(
    'id', id,
    'user_id', user_id,
    'old_full_name', old_full_name,
    'requested_full_name', requested_full_name,
    'status', status,
    'reviewed_by', reviewed_by,
    'reviewed_at', reviewed_at,
    'created_at', created_at,
    'updated_at', updated_at
  )
  INTO result;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_review_profile_name_change(
  p_request_id UUID,
  p_action TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
SET search_path = public, pg_temp
AS $$
DECLARE
  clean_action TEXT := lower(btrim(coalesce(p_action, '')));
  request_row public.profile_name_change_requests%ROWTYPE;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Admin required.';
  END IF;

  IF clean_action NOT IN ('approve', 'reject') THEN
    RETURN FALSE;
  END IF;

  SELECT *
  INTO request_row
  FROM public.profile_name_change_requests
  WHERE id = p_request_id
    AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF clean_action = 'approve' THEN
    UPDATE public.profiles
    SET full_name = request_row.requested_full_name
    WHERE id = request_row.user_id;

    UPDATE public.profile_name_change_requests
    SET status = 'approved',
        reviewed_by = auth.uid(),
        reviewed_at = NOW()
    WHERE id = p_request_id;

    INSERT INTO public.admin_audit_logs (actor_id, target_id, action, metadata)
    VALUES (
      auth.uid(),
      request_row.user_id,
      'approved_profile_name_change',
      jsonb_build_object(
        'request_id', request_row.id,
        'old_full_name', request_row.old_full_name,
        'requested_full_name', request_row.requested_full_name
      )
    );

    RETURN TRUE;
  END IF;

  UPDATE public.profile_name_change_requests
  SET status = 'rejected',
      reviewed_by = auth.uid(),
      reviewed_at = NOW()
  WHERE id = p_request_id;

  INSERT INTO public.admin_audit_logs (actor_id, target_id, action, metadata)
  VALUES (
    auth.uid(),
    request_row.user_id,
    'rejected_profile_name_change',
    jsonb_build_object(
      'request_id', request_row.id,
      'old_full_name', request_row.old_full_name,
      'requested_full_name', request_row.requested_full_name
    )
  );

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_profile_name_changes(
  p_status TEXT DEFAULT 'pending'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  clean_status TEXT := lower(btrim(coalesce(p_status, 'pending')));
  result JSONB;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Admin required.';
  END IF;

  IF clean_status NOT IN ('pending', 'approved', 'rejected', 'all') THEN
    clean_status := 'pending';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', request.id,
        'user_id', request.user_id,
        'user_name', profile.full_name,
        'user_role', profile.role,
        'old_full_name', request.old_full_name,
        'requested_full_name', request.requested_full_name,
        'status', request.status,
        'reviewed_by', request.reviewed_by,
        'reviewed_at', request.reviewed_at,
        'created_at', request.created_at,
        'updated_at', request.updated_at
      )
      ORDER BY request.created_at DESC
    ),
    '[]'::JSONB
  )
  INTO result
  FROM public.profile_name_change_requests AS request
  JOIN public.profiles AS profile ON profile.id = request.user_id
  WHERE clean_status = 'all'
     OR request.status = clean_status;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_current_profile_edit()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  result JSONB;
BEGIN
  IF current_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'id', profile.id,
    'full_name', profile.full_name,
    'nickname', profile.nickname,
    'role', profile.role,
    'university', profile.university,
    'department', profile.department,
    'field_of_study', profile.field_of_study,
    'bio', profile.bio,
    'current_grade', profile.current_grade,
    'target_field', profile.target_field,
    'target_departments', profile.target_departments,
    'target_universities', profile.target_universities,
    'mentorship_expectations', profile.mentorship_expectations,
    'education_status', profile.education_status,
    'is_working', profile.is_working,
    'company_name', profile.company_name,
    'company_logo', profile.company_logo,
    'work_title', profile.work_title,
    'linkedin_url', profile.linkedin_url,
    'mentorship_availability', profile.mentorship_availability,
    'mentorship_topics', profile.mentorship_topics,
    'is_verified', profile.is_verified,
    'pending_name_change', CASE
      WHEN request.id IS NULL THEN NULL
      ELSE jsonb_build_object(
        'id', request.id,
        'old_full_name', request.old_full_name,
        'requested_full_name', request.requested_full_name,
        'status', request.status,
        'created_at', request.created_at,
        'updated_at', request.updated_at
      )
    END
  )
  INTO result
  FROM public.profiles AS profile
  LEFT JOIN public.profile_name_change_requests AS request
    ON request.user_id = profile.id
   AND request.status = 'pending'
  WHERE profile.id = current_user_id
  LIMIT 1;

  RETURN result;
END;
$$;

DROP POLICY IF EXISTS "Users can update own profile (restricted)" ON public.profiles;
CREATE POLICY "Users can update own profile (restricted)"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND full_name = (SELECT p.full_name FROM public.profiles p WHERE p.id = auth.uid())
    AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
    AND is_verified = (SELECT p.is_verified FROM public.profiles p WHERE p.id = auth.uid())
    AND COALESCE(BTRIM(student_number), '') = COALESCE((SELECT BTRIM(p.student_number) FROM public.profiles p WHERE p.id = auth.uid()), '')
    AND COALESCE(BTRIM(class_section), '') = COALESCE((SELECT BTRIM(p.class_section) FROM public.profiles p WHERE p.id = auth.uid()), '')
    AND COALESCE(active_student_registry_entry_id, -1) = COALESCE((SELECT p.active_student_registry_entry_id FROM public.profiles p WHERE p.id = auth.uid()), -1)
    AND mentorship_capacity BETWEEN 1 AND 5
    AND mentorship_availability IN ('active', 'unavailable')
  );

REVOKE ALL ON TABLE public.profile_name_change_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.profile_name_change_requests TO authenticated;

REVOKE ALL ON FUNCTION public.submit_profile_name_change(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_review_profile_name_change(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_list_profile_name_changes(TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.submit_profile_name_change(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_profile_name_change(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_profile_name_changes(TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
