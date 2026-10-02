-- ============================================
-- Migration 079: Admin/category/profile lightweight RPCs
-- ============================================

CREATE OR REPLACE FUNCTION public.admin_get_dashboard_snapshot()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Admin required.';
  END IF;

  SELECT jsonb_build_object(
    'totalUsers', (SELECT COUNT(*) FROM public.profiles),
    'students', (SELECT COUNT(*) FROM public.profiles WHERE role = 'student'::user_role),
    'alumni', (SELECT COUNT(*) FROM public.profiles WHERE role = 'alumni'::user_role),
    'teachers', (SELECT COUNT(*) FROM public.profiles WHERE role = 'teacher'::user_role),
    'registryCount', (SELECT COUNT(*) FROM public.alumni_registry),
    'claimedRegistryCount', (SELECT COUNT(*) FROM public.alumni_registry WHERE is_claimed = TRUE),
    'pendingAlumni', (SELECT COUNT(*) FROM public.profiles WHERE role = 'alumni'::user_role AND is_verified = FALSE),
    'activeMentorships', (SELECT COUNT(*) FROM public.mentorship_conversations),
    'totalMentorshipRequests', (SELECT COUNT(*) FROM public.mentorship_requests WHERE status = 'pending'::mentorship_request_status),
    'totalThreads', (SELECT COUNT(*) FROM public.forum_threads_public),
    'privilegeAdmins', (SELECT COUNT(*) FROM public.admin_privileges),
    'activeSocialMatches', (SELECT COUNT(*) FROM public.matches WHERE status = 'accepted'::match_status),
    'pendingSocialMatches', (SELECT COUNT(*) FROM public.matches WHERE status = 'pending'::match_status),
    'verifiedEmailsCount', (SELECT COUNT(*) FROM auth.users WHERE email_confirmed_at IS NOT NULL),
    'openForumReports', (SELECT COUNT(*) FROM public.forum_reports WHERE status IN ('open'::forum_report_status, 'reviewing'::forum_report_status))
  )
  INTO result;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_users_snapshot(
  p_query TEXT DEFAULT '',
  p_limit INTEGER DEFAULT 1000
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
  effective_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 1000), 1), 1000);
  result JSONB;
BEGIN
  IF NOT public.is_platform_admin(current_user_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Admin required.';
  END IF;

  SELECT COALESCE(privilege.can_manage_admins, FALSE)
  INTO can_manage
  FROM public.admin_privileges AS privilege
  WHERE privilege.user_id = current_user_id;

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
    'canManageAdmins', can_manage
  )
  INTO result;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_forum_overview()
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
  SELECT jsonb_build_object(
    'currentUserId', current_user_id,
    'categories', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', category.id,
          'slug', category.slug,
          'name', category.name,
          'description', category.description,
          'icon', category.icon,
          'icon_key', category.icon_key,
          'color', category.color,
          'sort_order', category.sort_order,
          'is_active', category.is_active,
          'created_by', category.created_by,
          'is_user_created', category.is_user_created
        )
        ORDER BY category.sort_order ASC, category.name ASC
      )
      FROM public.forum_categories AS category
      WHERE category.is_active = TRUE
    ), '[]'::JSONB),
    'tags', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', tag.id,
          'slug', tag.slug,
          'name', tag.name,
          'color', tag.color,
          'category_id', tag.category_id,
          'sort_order', tag.sort_order,
          'is_active', tag.is_active,
          'created_at', tag.created_at
        )
        ORDER BY tag.sort_order ASC, tag.name ASC
      )
      FROM public.forum_tags AS tag
      WHERE tag.is_active = TRUE
    ), '[]'::JSONB),
    'threads', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', thread.id,
          'category_id', thread.category_id,
          'author_id', thread.author_id,
          'title', thread.title,
          'content', thread.content,
          'status', thread.status,
          'is_pinned', thread.is_pinned,
          'is_locked', thread.is_locked,
          'is_hidden', thread.is_hidden,
          'is_anonymous', thread.is_anonymous,
          'upvote_count', thread.upvote_count,
          'comment_count', thread.comment_count,
          'view_count', thread.view_count,
          'reaction_count', thread.reaction_count,
          'last_activity_at', thread.last_activity_at,
          'created_at', thread.created_at,
          'updated_at', thread.updated_at,
          'edited_at', thread.edited_at,
          'author', CASE
            WHEN thread.author_id IS NULL THEN NULL
            ELSE jsonb_build_object('id', author.id, 'full_name', author.full_name, 'role', author.role)
          END,
          'category', jsonb_build_object(
            'id', category.id,
            'slug', category.slug,
            'name', category.name,
            'description', category.description,
            'icon', category.icon,
            'icon_key', category.icon_key,
            'color', category.color,
            'sort_order', category.sort_order,
            'is_active', category.is_active,
            'created_by', category.created_by,
            'is_user_created', category.is_user_created
          ),
          'tags', COALESCE(thread_tags.tags, '[]'::JSONB)
        )
        ORDER BY thread.is_pinned DESC, thread.last_activity_at DESC
      )
      FROM (
        SELECT id, category_id, author_id, title, content, status, is_pinned, is_locked, is_hidden, is_anonymous,
          upvote_count, comment_count, view_count, reaction_count, last_activity_at, created_at, updated_at, edited_at
        FROM public.forum_threads_public
        WHERE status = 'open'
          AND is_hidden = FALSE
        ORDER BY is_pinned DESC, last_activity_at DESC
        LIMIT 24
      ) AS thread
      LEFT JOIN public.profiles AS author ON author.id = thread.author_id
      LEFT JOIN public.forum_categories AS category ON category.id = thread.category_id
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', tag.id,
            'slug', tag.slug,
            'name', tag.name,
            'color', tag.color,
            'category_id', tag.category_id,
            'sort_order', tag.sort_order,
            'is_active', tag.is_active,
            'created_at', tag.created_at
          )
          ORDER BY tag.sort_order ASC, tag.name ASC
        ) AS tags
        FROM public.forum_thread_tags AS thread_tag
        JOIN public.forum_tags AS tag ON tag.id = thread_tag.tag_id
        WHERE thread_tag.thread_id = thread.id
          AND tag.is_active = TRUE
      ) AS thread_tags ON TRUE
    ), '[]'::JSONB)
  )
  INTO result;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_forum_category_detail(
  p_category_slug TEXT,
  p_tag_slug TEXT DEFAULT '',
  p_sort TEXT DEFAULT 'latest'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  selected_category public.forum_categories%ROWTYPE;
  clean_tag TEXT := btrim(coalesce(p_tag_slug, ''));
  clean_sort TEXT := CASE WHEN p_sort IN ('latest', 'popular', 'unanswered') THEN p_sort ELSE 'latest' END;
  result JSONB;
BEGIN
  SELECT *
  INTO selected_category
  FROM public.forum_categories
  WHERE slug = p_category_slug
    AND is_active = TRUE
  LIMIT 1;

  IF selected_category.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'currentUserId', current_user_id,
    'category', to_jsonb(selected_category),
    'categories', COALESCE((
      SELECT jsonb_agg(to_jsonb(category) ORDER BY category.sort_order ASC, category.name ASC)
      FROM public.forum_categories AS category
      WHERE category.is_active = TRUE
    ), '[]'::JSONB),
    'tags', COALESCE((
      SELECT jsonb_agg(to_jsonb(tag) ORDER BY tag.sort_order ASC, tag.name ASC)
      FROM public.forum_tags AS tag
      WHERE tag.is_active = TRUE
    ), '[]'::JSONB),
    'threads', COALESCE((
      SELECT jsonb_agg(
        to_jsonb(thread)
        || jsonb_build_object(
          'author', CASE
            WHEN thread.author_id IS NULL THEN NULL
            ELSE jsonb_build_object('id', author.id, 'full_name', author.full_name, 'role', author.role)
          END,
          'tags', COALESCE(thread_tags.tags, '[]'::JSONB)
        )
        ORDER BY
          thread.is_pinned DESC,
          CASE WHEN clean_sort = 'popular' THEN thread.reaction_count + thread.comment_count ELSE 0 END DESC,
          thread.last_activity_at DESC
      )
      FROM (
        SELECT *
        FROM public.forum_threads_public
        WHERE category_id = selected_category.id
          AND status = 'open'
          AND is_hidden = FALSE
          AND (clean_sort <> 'unanswered' OR comment_count = 0)
        ORDER BY is_pinned DESC, last_activity_at DESC
        LIMIT 250
      ) AS thread
      LEFT JOIN public.profiles AS author ON author.id = thread.author_id
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(to_jsonb(tag) ORDER BY tag.sort_order ASC, tag.name ASC) AS tags
        FROM public.forum_thread_tags AS thread_tag
        JOIN public.forum_tags AS tag ON tag.id = thread_tag.tag_id
        WHERE thread_tag.thread_id = thread.id
          AND tag.is_active = TRUE
      ) AS thread_tags ON TRUE
      WHERE clean_tag = ''
        OR EXISTS (
          SELECT 1
          FROM public.forum_thread_tags AS selected_thread_tag
          JOIN public.forum_tags AS selected_tag ON selected_tag.id = selected_thread_tag.tag_id
          WHERE selected_thread_tag.thread_id = thread.id
            AND selected_tag.slug = clean_tag
            AND selected_tag.is_active = TRUE
        )
    ), '[]'::JSONB)
  )
  INTO result;

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
    'id', id,
    'full_name', full_name,
    'nickname', nickname,
    'role', role,
    'university', university,
    'department', department,
    'field_of_study', field_of_study,
    'bio', bio,
    'current_grade', current_grade,
    'target_field', target_field,
    'target_departments', target_departments,
    'target_universities', target_universities,
    'mentorship_expectations', mentorship_expectations,
    'education_status', education_status,
    'is_working', is_working,
    'company_name', company_name,
    'company_logo', company_logo,
    'work_title', work_title,
    'linkedin_url', linkedin_url,
    'mentorship_availability', mentorship_availability,
    'mentorship_topics', mentorship_topics,
    'is_verified', is_verified
  )
  INTO result
  FROM public.profiles
  WHERE id = current_user_id
  LIMIT 1;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_settings_profile()
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
    'id', id,
    'nickname', nickname,
    'role', role,
    'is_profile_complete', is_profile_complete
  )
  INTO result
  FROM public.profiles
  WHERE id = current_user_id
  LIMIT 1;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_dashboard_snapshot() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_users_snapshot(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_forum_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_forum_category_detail(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_profile_edit() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_settings_profile() TO authenticated;

NOTIFY pgrst, 'reload schema';
