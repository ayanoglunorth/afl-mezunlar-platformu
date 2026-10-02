-- ============================================
-- Migration 081: Fast admin dashboard payloads and prepared reaction people
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
    'openForumReports', (SELECT COUNT(*) FROM public.forum_reports WHERE status IN ('open'::forum_report_status, 'reviewing'::forum_report_status)),
    'directoryUsers', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', profile.id,
          'full_name', profile.full_name,
          'role', profile.role,
          'student_number', profile.student_number,
          'university', profile.university,
          'department', profile.department,
          'graduation_year', profile.graduation_year,
          'registration_review_reason', profile.registration_review_reason,
          'registration_registry_entry_id', profile.registration_registry_entry_id
        )
        ORDER BY profile.full_name ASC
      )
      FROM (
        SELECT id, full_name, role, student_number, university, department, graduation_year, registration_review_reason, registration_registry_entry_id
        FROM public.profiles
        ORDER BY full_name ASC
        LIMIT 60
      ) AS profile
    ), '[]'::JSONB),
    'registryEntries', COALESCE((
      SELECT jsonb_agg(to_jsonb(registry) ORDER BY registry.graduation_year DESC, registry.full_name ASC)
      FROM public.admin_list_alumni_registry(60) AS registry
    ), '[]'::JSONB),
    'recentAdminActions', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', log.id,
          'actor_id', log.actor_id,
          'actor_name', actor.full_name,
          'target_id', log.target_id,
          'target_name', target.full_name,
          'action', log.action,
          'created_at', log.created_at
        )
        ORDER BY log.created_at DESC
      )
      FROM (
        SELECT id, actor_id, target_id, action, created_at
        FROM public.admin_audit_logs
        ORDER BY created_at DESC
        LIMIT 8
      ) AS log
      LEFT JOIN public.profiles AS actor ON actor.id = log.actor_id
      LEFT JOIN public.profiles AS target ON target.id = log.target_id
    ), '[]'::JSONB),
    'dashboardFeedbacks', COALESCE((
      SELECT jsonb_agg(to_jsonb(feedback) ORDER BY feedback.created_at DESC)
      FROM (
        SELECT id, sender_name, sender_email, sender_role, message, status, created_at
        FROM public.dashboard_feedback
        ORDER BY created_at DESC
        LIMIT 12
      ) AS feedback
    ), '[]'::JSONB),
    'conversationReviews', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', review.id,
          'reviewer_name', reviewer.full_name,
          'reviewed_user_name', reviewed.full_name,
          'conversation_kind', review.conversation_kind,
          'rating', review.rating,
          'note', review.note
        )
        ORDER BY review.created_at DESC
      )
      FROM (
        SELECT id, reviewer_id, reviewed_user_id, conversation_kind, rating, note, created_at
        FROM public.conversation_reviews
        ORDER BY created_at DESC
        LIMIT 20
      ) AS review
      LEFT JOIN public.profiles AS reviewer ON reviewer.id = review.reviewer_id
      LEFT JOIN public.profiles AS reviewed ON reviewed.id = review.reviewed_user_id
    ), '[]'::JSONB),
    'messageReports', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', report.id,
          'reporter_name', reporter.full_name,
          'reported_user_name', reported.full_name,
          'status', report.status,
          'note', report.note,
          'messages', COALESCE(messages.items, '[]'::JSONB)
        )
        ORDER BY report.created_at DESC
      )
      FROM (
        SELECT id, reporter_id, reported_user_id, status, note, created_at
        FROM public.message_reports
        ORDER BY created_at DESC
        LIMIT 20
      ) AS report
      LEFT JOIN public.profiles AS reporter ON reporter.id = report.reporter_id
      LEFT JOIN public.profiles AS reported ON reported.id = report.reported_user_id
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(
          jsonb_build_object(
            'message_id', message.message_id,
            'content_snapshot', message.content_snapshot
          )
          ORDER BY message.message_created_at ASC
        ) AS items
        FROM public.reported_messages AS message
        WHERE message.report_id = report.id
      ) AS messages ON TRUE
    ), '[]'::JSONB),
    'archivedForumContent', COALESCE((
      SELECT jsonb_agg(to_jsonb(item) ORDER BY item.date DESC)
      FROM (
        SELECT
          thread.id,
          'Konu'::TEXT AS kind,
          thread.title,
          thread.content AS preview,
          '/topluluk/konu/' || thread.id::TEXT AS href,
          COALESCE(thread.edited_at, thread.updated_at, thread.created_at) AS date
        FROM public.forum_threads_public AS thread
        WHERE thread.status = 'archived'
        ORDER BY COALESCE(thread.edited_at, thread.updated_at, thread.created_at) DESC
        LIMIT 12
      ) AS item
    ), '[]'::JSONB) || COALESCE((
      SELECT jsonb_agg(to_jsonb(item) ORDER BY item.date DESC)
      FROM (
        SELECT
          post.id,
          'Yanıt'::TEXT AS kind,
          COALESCE(thread.title, 'Konu bulunamadı') AS title,
          post.content AS preview,
          '/topluluk/konu/' || post.thread_id::TEXT AS href,
          COALESCE(post.edited_at, post.updated_at, post.created_at) AS date
        FROM public.forum_posts_public AS post
        LEFT JOIN public.forum_threads_public AS thread ON thread.id = post.thread_id
        WHERE post.status = 'archived'
        ORDER BY COALESCE(post.edited_at, post.updated_at, post.created_at) DESC
        LIMIT 12
      ) AS item
    ), '[]'::JSONB),
    'forumReports', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', report.id,
          'target_type', report.target_type,
          'target_href', CASE
            WHEN report.target_thread_id IS NOT NULL THEN '/topluluk/konu/' || report.target_thread_id::TEXT
            WHEN post.thread_id IS NOT NULL THEN '/topluluk/konu/' || post.thread_id::TEXT
            ELSE '/topluluk'
          END,
          'target_label', COALESCE(thread.title, left(post.content, 180), 'İçerik bulunamadı'),
          'reporter_name', reporter.full_name,
          'reason', report.reason,
          'note', report.note,
          'status', report.status,
          'created_at', report.created_at
        )
        ORDER BY report.created_at DESC
      )
      FROM (
        SELECT id, reporter_id, target_type, target_thread_id, target_post_id, reason, note, status, created_at
        FROM public.forum_reports
        ORDER BY created_at DESC
        LIMIT 30
      ) AS report
      LEFT JOIN public.profiles AS reporter ON reporter.id = report.reporter_id
      LEFT JOIN public.forum_threads_public AS thread ON thread.id = report.target_thread_id
      LEFT JOIN public.forum_posts_public AS post ON post.id = report.target_post_id
    ), '[]'::JSONB)
  )
  INTO result;

  RETURN result;
END;
$$;

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
    'hasMore', effective_offset + effective_limit < total_count,
    'nextOffset', LEAST(effective_offset + effective_limit, total_count)
  )
  INTO result;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_forum_thread_detail(p_thread_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  current_user_is_admin BOOLEAN := FALSE;
  thread_row public.forum_threads%ROWTYPE;
  next_view_count INTEGER;
  visible_post_ids UUID[];
  result JSONB;
BEGIN
  IF current_user_id IS NULL OR NOT public.forum_is_verified_user(current_user_id) THEN
    RAISE EXCEPTION 'Topluluk yalnizca dogrulanmis platform kullanicilarina aciktir.';
  END IF;

  current_user_is_admin := public.is_platform_admin(current_user_id);

  SELECT *
  INTO thread_row
  FROM public.forum_threads AS thread
  WHERE thread.id = p_thread_id
    AND (
      thread.is_hidden = FALSE
      OR thread.author_id = current_user_id
      OR current_user_is_admin
    );

  IF thread_row.id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.forum_threads AS thread
  SET view_count = thread.view_count + 1
  WHERE thread.id = thread_row.id
    AND thread.status = 'open'
    AND thread.is_hidden = FALSE
  RETURNING thread.view_count INTO next_view_count;

  IF next_view_count IS NOT NULL THEN
    thread_row.view_count := next_view_count;
  END IF;

  WITH visible_posts AS (
    SELECT post.*
    FROM public.forum_posts AS post
    WHERE post.thread_id = thread_row.id
      AND (
        CASE
          WHEN current_user_is_admin THEN TRUE
          ELSE post.is_hidden = FALSE AND post.status = 'open'
        END
      )
  )
  SELECT COALESCE(array_agg(id), ARRAY[]::UUID[])
  INTO visible_post_ids
  FROM visible_posts;

  WITH visible_posts AS (
    SELECT post.*
    FROM public.forum_posts AS post
    WHERE post.thread_id = thread_row.id
      AND (
        CASE
          WHEN current_user_is_admin THEN TRUE
          ELSE post.is_hidden = FALSE AND post.status = 'open'
        END
      )
  ),
  post_author_ids AS (
    SELECT DISTINCT post.author_id
    FROM visible_posts AS post
    WHERE post.author_id IS NOT NULL
      AND post.is_anonymous = FALSE
  ),
  visible_reactions AS (
    SELECT reaction.*
    FROM public.forum_reactions AS reaction
    WHERE reaction.target_thread_id = thread_row.id
      OR reaction.target_post_id = ANY(visible_post_ids)
  )
  SELECT jsonb_build_object(
    'isAdmin', current_user_is_admin,
    'thread', jsonb_build_object(
      'id', thread_row.id,
      'category_id', thread_row.category_id,
      'author_id', CASE WHEN thread_row.is_anonymous THEN NULL ELSE thread_row.author_id END,
      'title', thread_row.title,
      'content', thread_row.content,
      'status', thread_row.status,
      'is_pinned', thread_row.is_pinned,
      'is_locked', thread_row.is_locked,
      'is_hidden', thread_row.is_hidden,
      'is_anonymous', thread_row.is_anonymous,
      'can_edit', thread_row.author_id = current_user_id,
      'upvote_count', thread_row.upvote_count,
      'comment_count', thread_row.comment_count,
      'view_count', thread_row.view_count,
      'reaction_count', thread_row.reaction_count,
      'last_activity_at', thread_row.last_activity_at,
      'created_at', thread_row.created_at,
      'updated_at', thread_row.updated_at,
      'edited_at', thread_row.edited_at
    ),
    'category', (
      SELECT to_jsonb(category)
      FROM public.forum_categories AS category
      WHERE category.id = thread_row.category_id
        AND category.is_active = TRUE
    ),
    'author', (
      SELECT jsonb_build_object('id', profile.id, 'full_name', profile.full_name, 'role', profile.role)
      FROM public.profiles AS profile
      WHERE profile.id = thread_row.author_id
        AND thread_row.is_anonymous = FALSE
    ),
    'tags', COALESCE((
      SELECT jsonb_agg(to_jsonb(tag) ORDER BY tag.sort_order ASC, tag.name ASC)
      FROM public.forum_thread_tags AS thread_tag
      JOIN public.forum_tags AS tag ON tag.id = thread_tag.tag_id
      WHERE thread_tag.thread_id = thread_row.id
        AND tag.is_active = TRUE
    ), '[]'::JSONB),
    'posts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', post.id,
        'thread_id', post.thread_id,
        'author_id', CASE WHEN post.is_anonymous THEN NULL ELSE post.author_id END,
        'content', post.content,
        'parent_post_id', post.parent_post_id,
        'reply_count', post.reply_count,
        'reaction_count', post.reaction_count,
        'is_hidden', post.is_hidden,
        'status', post.status,
        'is_anonymous', post.is_anonymous,
        'can_edit', post.author_id = current_user_id,
        'edited_at', post.edited_at,
        'created_at', post.created_at,
        'updated_at', post.updated_at
      ) ORDER BY post.created_at ASC)
      FROM visible_posts AS post
    ), '[]'::JSONB),
    'postAuthors', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', profile.id, 'full_name', profile.full_name, 'role', profile.role) ORDER BY profile.full_name ASC)
      FROM post_author_ids AS author_id
      JOIN public.profiles AS profile ON profile.id = author_id.author_id
    ), '[]'::JSONB),
    'reactionAuthors', COALESCE((
      SELECT jsonb_agg(DISTINCT jsonb_build_object('id', profile.id, 'full_name', profile.full_name, 'role', profile.role))
      FROM visible_reactions AS reaction
      JOIN public.profiles AS profile ON profile.id = reaction.user_id
      WHERE profile.is_verified = TRUE
    ), '[]'::JSONB),
    'reactions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', reaction.user_id,
        'target_thread_id', reaction.target_thread_id,
        'target_post_id', reaction.target_post_id,
        'reaction_type', reaction.reaction_type
      ) ORDER BY reaction.created_at ASC)
      FROM visible_reactions AS reaction
    ), '[]'::JSONB),
    'mentions', COALESCE((
      SELECT jsonb_agg(DISTINCT jsonb_build_object(
        'thread_id', mention.thread_id,
        'post_id', mention.post_id,
        'id', profile.id,
        'full_name', profile.full_name,
        'role', profile.role
      ))
      FROM public.forum_mentions AS mention
      JOIN public.profiles AS profile ON profile.id = mention.mentioned_user_id
      LEFT JOIN visible_posts AS post ON post.id = mention.post_id
      WHERE mention.thread_id = thread_row.id
        AND profile.is_verified = TRUE
        AND (
          mention.post_id IS NULL
          OR post.id IS NOT NULL
        )
    ), '[]'::JSONB)
  )
  INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_dashboard_snapshot() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_users_snapshot(TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_forum_thread_detail(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
