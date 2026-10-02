-- ============================================
-- Migration 052: Fix Alumni Registry Account Check
-- ============================================

-- The previous admin_list_alumni_registry RPC was only checking if an
-- 'alumni' role profile existed with the student_number. However, recent
-- graduates (e.g. 2026) register as 'student' to receive mentorship, and
-- they should also be marked as "has_account = true" in the registry.

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
        WHERE profile.student_number = registry.student_number
      )
    ) AS has_account
  FROM public.alumni_registry registry
  ORDER BY registry.full_name ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 1000), 1), 5000);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;
