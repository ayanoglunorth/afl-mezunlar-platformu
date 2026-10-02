-- ============================================
-- Migration 082: Fix admin dashboard report status check
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
    'openForumReports', (SELECT COUNT(*) FROM public.forum_reports WHERE status::TEXT IN ('open', 'reviewing')),
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
        WHERE thread.status::TEXT = 'archived'
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
        WHERE post.status::TEXT = 'archived'
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

GRANT EXECUTE ON FUNCTION public.admin_get_dashboard_snapshot() TO authenticated;

NOTIFY pgrst, 'reload schema';
