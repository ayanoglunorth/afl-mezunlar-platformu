-- Ensure every platform admin can read/manage alumni registry entries.
-- The admin dashboard already treats both legacy role=admin users and
-- admin_privileges users as platform admins, so alumni_registry RLS must
-- use the same permission check.

DROP POLICY IF EXISTS "Admins can manage alumni registry" ON public.alumni_registry;

CREATE POLICY "Admins can manage alumni registry"
  ON public.alumni_registry FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.admin_count_alumni_registry()
RETURNS integer AS $$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Admin required.';
  END IF;

  RETURN (SELECT COUNT(*)::integer FROM public.alumni_registry);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.admin_list_alumni_registry(p_limit integer DEFAULT 1000)
RETURNS TABLE (
  id integer,
  sequence_number integer,
  student_number text,
  full_name text,
  full_name_normalized text,
  field_of_study text,
  graduation_year integer,
  is_claimed boolean,
  claimed_by uuid,
  uploaded_at timestamptz,
  uploaded_by uuid,
  has_account boolean
) AS $$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Admin required.';
  END IF;

  RETURN QUERY
  SELECT
    registry.id,
    registry.sequence_number,
    registry.student_number,
    registry.full_name,
    registry.full_name_normalized,
    registry.field_of_study,
    registry.graduation_year,
    registry.is_claimed,
    registry.claimed_by,
    registry.uploaded_at,
    registry.uploaded_by,
    (
      registry.is_claimed
      OR registry.claimed_by IS NOT NULL
      OR EXISTS (
        SELECT 1
        FROM public.profiles profile
        WHERE profile.role = 'alumni'
          AND profile.student_number = registry.student_number
      )
    ) AS has_account
  FROM public.alumni_registry registry
  ORDER BY registry.full_name ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 1000), 1), 5000);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.admin_count_alumni_registry() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_list_alumni_registry(integer) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.admin_count_alumni_registry() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_alumni_registry(integer) TO authenticated;

DROP POLICY IF EXISTS "Students can create mentorship requests" ON public.mentorship_requests;

CREATE POLICY "Students can create mentorship requests"
  ON public.mentorship_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = student_id
    AND EXISTS (
      SELECT 1
      FROM public.profiles seeker
      WHERE seeker.id = student_id
        AND (
          seeker.role = 'student'
          OR (
            seeker.role = 'alumni'
            AND seeker.education_status = 'Sınava tekrar hazırlanıyorum.'
          )
        )
    )
    AND EXISTS (
      SELECT 1
      FROM public.profiles mentor
      WHERE mentor.id = mentor_id
        AND mentor.role = 'alumni'
        AND COALESCE(mentor.education_status, '') <> 'Sınava tekrar hazırlanıyorum.'
    )
  );

NOTIFY pgrst, 'reload schema';
