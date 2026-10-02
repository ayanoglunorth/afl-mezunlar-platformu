-- Admin moderation dashboard reads go through authenticated SECURITY DEFINER
-- RPCs. This keeps the panel independent from service-role clients and avoids
-- direct reads from revoked/RLS-protected moderation tables.

CREATE OR REPLACE FUNCTION public.admin_list_conversation_reviews(p_limit integer DEFAULT 20)
RETURNS TABLE (
  id uuid,
  reviewer_id uuid,
  reviewer_name text,
  reviewed_user_id uuid,
  reviewed_user_name text,
  conversation_kind public.moderation_conversation_kind,
  conversation_id uuid,
  rating integer,
  note text,
  created_at timestamptz
) AS $$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Admin required.';
  END IF;

  RETURN QUERY
  SELECT
    review.id,
    review.reviewer_id,
    reviewer.full_name AS reviewer_name,
    review.reviewed_user_id,
    reviewed.full_name AS reviewed_user_name,
    review.conversation_kind,
    review.conversation_id,
    review.rating,
    review.note,
    review.created_at
  FROM public.conversation_reviews review
  LEFT JOIN public.profiles reviewer ON reviewer.id = review.reviewer_id
  LEFT JOIN public.profiles reviewed ON reviewed.id = review.reviewed_user_id
  ORDER BY review.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.admin_list_message_reports(p_limit integer DEFAULT 20)
RETURNS TABLE (
  id uuid,
  reporter_id uuid,
  reporter_name text,
  reported_user_id uuid,
  reported_user_name text,
  conversation_kind public.moderation_conversation_kind,
  conversation_id uuid,
  note text,
  status public.message_report_status,
  created_at timestamptz,
  messages jsonb
) AS $$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Admin required.';
  END IF;

  RETURN QUERY
  SELECT
    report.id,
    report.reporter_id,
    reporter.full_name AS reporter_name,
    report.reported_user_id,
    reported.full_name AS reported_user_name,
    report.conversation_kind,
    report.conversation_id,
    report.note,
    report.status,
    report.created_at,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'message_id', message.message_id,
          'sender_id', message.sender_id,
          'content_snapshot', message.content_snapshot,
          'message_created_at', message.message_created_at
        )
        ORDER BY message.message_created_at ASC
      ) FILTER (WHERE message.message_id IS NOT NULL),
      '[]'::jsonb
    ) AS messages
  FROM public.message_reports report
  LEFT JOIN public.profiles reporter ON reporter.id = report.reporter_id
  LEFT JOIN public.profiles reported ON reported.id = report.reported_user_id
  LEFT JOIN public.reported_messages message ON message.report_id = report.id
  GROUP BY report.id, reporter.full_name, reported.full_name
  ORDER BY report.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.admin_list_mentorship_reviews(p_limit integer DEFAULT 8)
RETURNS TABLE (
  id uuid,
  request_id uuid,
  student_id uuid,
  student_name text,
  mentor_id uuid,
  mentor_name text,
  rating integer,
  feedback text,
  created_at timestamptz
) AS $$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Admin required.';
  END IF;

  RETURN QUERY
  SELECT
    review.id,
    review.request_id,
    review.student_id,
    student.full_name AS student_name,
    review.mentor_id,
    mentor.full_name AS mentor_name,
    review.rating,
    review.feedback,
    review.created_at
  FROM public.mentorship_reviews review
  LEFT JOIN public.profiles student ON student.id = review.student_id
  LEFT JOIN public.profiles mentor ON mentor.id = review.mentor_id
  ORDER BY review.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 8), 1), 100);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.admin_list_conversation_reviews(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_list_message_reports(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_list_mentorship_reviews(integer) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.admin_list_conversation_reviews(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_message_reports(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_mentorship_reviews(integer) TO authenticated;

NOTIFY pgrst, 'reload schema';
