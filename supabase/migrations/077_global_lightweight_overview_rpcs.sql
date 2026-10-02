-- ============================================
-- Migration 077: Lightweight overview RPCs
-- ============================================

CREATE OR REPLACE FUNCTION public.get_forum_overview()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'currentUserId', current_user_id,
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
          'category', to_jsonb(category),
          'tags', COALESCE(thread_tags.tags, '[]'::JSONB)
        )
        ORDER BY thread.is_pinned DESC, thread.last_activity_at DESC
      )
      FROM (
        SELECT *
        FROM public.forum_threads_public
        WHERE status = 'open'
          AND is_hidden = FALSE
        ORDER BY is_pinned DESC, last_activity_at DESC
        LIMIT 80
      ) AS thread
      LEFT JOIN public.profiles AS author ON author.id = thread.author_id
      LEFT JOIN public.forum_categories AS category ON category.id = thread.category_id
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(to_jsonb(tag) ORDER BY tag.sort_order ASC, tag.name ASC) AS tags
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

CREATE OR REPLACE FUNCTION public.get_forum_threads_list(p_limit INTEGER DEFAULT 250)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  effective_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 250), 1), 250);
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'currentUserId', current_user_id,
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
          'category', to_jsonb(category),
          'tags', COALESCE(thread_tags.tags, '[]'::JSONB)
        )
        ORDER BY thread.is_pinned DESC, thread.last_activity_at DESC
      )
      FROM (
        SELECT *
        FROM public.forum_threads_public
        WHERE status = 'open'
          AND is_hidden = FALSE
        ORDER BY is_pinned DESC, last_activity_at DESC
        LIMIT effective_limit
      ) AS thread
      LEFT JOIN public.profiles AS author ON author.id = thread.author_id
      LEFT JOIN public.forum_categories AS category ON category.id = thread.category_id
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(to_jsonb(tag) ORDER BY tag.sort_order ASC, tag.name ASC) AS tags
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

CREATE OR REPLACE FUNCTION public.get_social_board_snapshot()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  result JSONB;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT jsonb_build_object(
    'recentUsers', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', profile.id,
          'full_name', profile.full_name,
          'role', profile.role,
          'nickname', profile.nickname,
          'last_seen_at', profile.last_seen_at,
          'is_admin', profile.role = 'admin'::user_role OR admin.user_id IS NOT NULL
        )
        ORDER BY profile.last_seen_at DESC
      )
      FROM (
        SELECT id, full_name, role, nickname, last_seen_at
        FROM public.profiles
        WHERE last_seen_at IS NOT NULL
        ORDER BY last_seen_at DESC
        LIMIT 50
      ) AS profile
      LEFT JOIN public.admin_privileges AS admin ON admin.user_id = profile.id
    ), '[]'::JSONB)
  )
  INTO result;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_matching_overview()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  current_profile public.profiles%ROWTYPE;
  is_mentor_seeker BOOLEAN := FALSE;
  result JSONB;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT *
  INTO current_profile
  FROM public.profiles
  WHERE id = current_user_id
  LIMIT 1;

  IF current_profile.id IS NULL THEN
    RETURN NULL;
  END IF;

  is_mentor_seeker := current_profile.role = 'student'::user_role
    OR current_profile.education_status = 'Sinava tekrar hazirlaniyorum.'
    OR current_profile.education_status = 'Sınava tekrar hazırlanıyorum.';

  SELECT jsonb_build_object(
    'currentUserId', current_user_id,
    'profile', to_jsonb(current_profile),
    'socialRequests', COALESCE((
      SELECT jsonb_agg(
        to_jsonb(match)
        || jsonb_build_object(
          'other_profile', to_jsonb(other_profile),
          'request_note', COALESCE(
            NULLIF(regexp_replace(reason.message, '^Mesaj:\s*', ''), ''),
            'Seninle iletisime gecmek istiyor.'
          )
        )
        ORDER BY match.created_at DESC
      )
      FROM public.matches AS match
      JOIN public.profiles AS other_profile
        ON other_profile.id = CASE
          WHEN match.user_a = current_user_id THEN match.user_b
          ELSE match.user_a
        END
      LEFT JOIN LATERAL (
        SELECT item AS message
        FROM unnest(match.match_reasons) AS item
        WHERE item LIKE 'Mesaj:%'
        LIMIT 1
      ) AS reason ON TRUE
      WHERE (match.user_a = current_user_id OR match.user_b = current_user_id)
        AND match.status = 'pending'::match_status
        AND match.requested_by IS DISTINCT FROM current_user_id
    ), '[]'::JSONB),
    'mentorSeeker', CASE WHEN is_mentor_seeker THEN jsonb_build_object(
      'mentors', COALESCE((
        SELECT jsonb_agg(to_jsonb(mentor))
        FROM public.profiles AS mentor
        WHERE mentor.role = 'alumni'::user_role
      ), '[]'::JSONB),
      'requests', COALESCE((
        SELECT jsonb_agg(
          to_jsonb(request)
          || jsonb_build_object('conversation_id', conversation.id)
          ORDER BY request.created_at DESC
        )
        FROM public.mentorship_requests AS request
        LEFT JOIN public.mentorship_conversations AS conversation ON conversation.request_id = request.id
        WHERE request.student_id = current_user_id
      ), '[]'::JSONB),
      'activeMentorCounts', COALESCE((
        SELECT jsonb_object_agg(active.mentor_id, active.count)
        FROM (
          SELECT mentor_id, COUNT(*)::INTEGER AS count
          FROM public.mentorship_requests
          WHERE status = 'accepted'::mentorship_request_status
          GROUP BY mentor_id
        ) AS active
      ), '{}'::JSONB)
    ) ELSE NULL END,
    'alumni', CASE WHEN current_profile.role = 'alumni'::user_role AND NOT is_mentor_seeker THEN jsonb_build_object(
      'requests', COALESCE((
        SELECT jsonb_agg(
          to_jsonb(request)
          || jsonb_build_object(
            'student_profile', to_jsonb(student),
            'conversation_id', conversation.id
          )
          ORDER BY request.created_at DESC
        )
        FROM public.mentorship_requests AS request
        LEFT JOIN public.profiles AS student ON student.id = request.student_id
        LEFT JOIN public.mentorship_conversations AS conversation ON conversation.request_id = request.id
        WHERE request.mentor_id = current_user_id
          AND request.status IN ('pending'::mentorship_request_status, 'accepted'::mentorship_request_status)
      ), '[]'::JSONB)
    ) ELSE NULL END
  )
  INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_forum_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_forum_threads_list(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_social_board_snapshot() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_matching_overview() TO authenticated;
