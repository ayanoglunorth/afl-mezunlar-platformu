-- ============================================
-- Migration 083: Admin user snapshot totals for paged UI
-- ============================================

CREATE OR REPLACE FUNCTION public.admin_get_users_snapshot(
  p_query TEXT DEFAULT '',
  p_limit INTEGER DEFAULT 75,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  can_manage BOOLEAN := FALSE;
  normalized_query TEXT := lower(btrim(coalesce(p_query, '')));
  effective_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 75), 1), 150);
  effective_offset INTEGER := GREATEST(COALESCE(p_offset, 0), 0);
  total_count INTEGER := 0;
  admin_count INTEGER := 0;
  admin_manager_count INTEGER := 0;
  result JSONB;
BEGIN
  IF NOT public.is_platform_admin(current_user_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Admin required.';
  END IF;

  SELECT COALESCE(privilege.can_manage_admins, FALSE)
  INTO can_manage
  FROM public.admin_privileges AS privilege
  WHERE privilege.user_id = current_user_id;

  SELECT COUNT(*)
  INTO total_count
  FROM public.profiles AS searchable
  WHERE normalized_query = ''
    OR lower(coalesce(searchable.full_name, '')) LIKE '%' || normalized_query || '%'
    OR lower(coalesce(searchable.student_number, '')) LIKE '%' || normalized_query || '%'
    OR lower(coalesce(searchable.university, '')) LIKE '%' || normalized_query || '%'
    OR lower(coalesce(searchable.department, '')) LIKE '%' || normalized_query || '%'
    OR lower(searchable.role::TEXT) LIKE '%' || normalized_query || '%'
    OR lower(coalesce(searchable.registration_review_reason::TEXT, '')) LIKE '%' || normalized_query || '%';

  SELECT COUNT(DISTINCT profile.id)
  INTO admin_count
  FROM public.profiles AS profile
  LEFT JOIN public.admin_privileges AS privilege ON privilege.user_id = profile.id
  WHERE profile.role = 'admin'::user_role
    OR privilege.user_id IS NOT NULL;

  SELECT COUNT(*)
  INTO admin_manager_count
  FROM public.admin_privileges AS privilege
  WHERE privilege.can_manage_admins = TRUE;

  SELECT jsonb_build_object(
    'users', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', profile.id,
          'full_name', profile.full_name,
          'role', profile.role,
          'student_number', profile.student_number,
          'university', profile.university,
          'department', profile.department,
          'graduation_year', profile.graduation_year,
          'is_profile_complete', profile.is_profile_complete,
          'created_at', profile.created_at,
          'registration_review_reason', profile.registration_review_reason,
          'registration_registry_entry_id', profile.registration_registry_entry_id,
          'admin_privilege', CASE
            WHEN privilege.user_id IS NULL THEN NULL
            ELSE to_jsonb(privilege)
          END,
          'is_platform_admin', profile.role = 'admin'::user_role OR privilege.user_id IS NOT NULL,
          'can_manage_admins', COALESCE(privilege.can_manage_admins, FALSE),
          'email', NULL
        )
        ORDER BY profile.created_at DESC
      )
      FROM (
        SELECT *
        FROM public.profiles AS searchable
        WHERE normalized_query = ''
          OR lower(coalesce(searchable.full_name, '')) LIKE '%' || normalized_query || '%'
          OR lower(coalesce(searchable.student_number, '')) LIKE '%' || normalized_query || '%'
          OR lower(coalesce(searchable.university, '')) LIKE '%' || normalized_query || '%'
          OR lower(coalesce(searchable.department, '')) LIKE '%' || normalized_query || '%'
          OR lower(searchable.role::TEXT) LIKE '%' || normalized_query || '%'
          OR lower(coalesce(searchable.registration_review_reason::TEXT, '')) LIKE '%' || normalized_query || '%'
        ORDER BY searchable.created_at DESC
        LIMIT effective_limit
        OFFSET effective_offset
      ) AS profile
      LEFT JOIN public.admin_privileges AS privilege ON privilege.user_id = profile.id
    ), '[]'::JSONB),
    'auditLogs', COALESCE((
      SELECT jsonb_agg(to_jsonb(log) ORDER BY log.created_at DESC)
      FROM (
        SELECT id, actor_id, target_id, action, metadata, created_at
        FROM public.admin_audit_logs
        ORDER BY created_at DESC
        LIMIT 20
      ) AS log
    ), '[]'::JSONB),
    'currentUserId', current_user_id,
    'canManageAdmins', can_manage,
    'totalCount', total_count,
    'adminCount', admin_count,
    'adminManagerCount', admin_manager_count,
    'hasMore', effective_offset + effective_limit < total_count,
    'nextOffset', LEAST(effective_offset + effective_limit, total_count)
  )
  INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_users_snapshot(TEXT, INTEGER, INTEGER) TO authenticated;

NOTIFY pgrst, 'reload schema';
