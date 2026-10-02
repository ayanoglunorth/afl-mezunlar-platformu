-- Keep the admin mentorship counter independent from service-role clients and
-- direct admin table SELECT policies. "Active Mentorship" means an accepted
-- mentorship conversation where at least one message has actually been sent.

DROP POLICY IF EXISTS "Admins can view mentorship requests" ON public.mentorship_requests;
DROP POLICY IF EXISTS "Admins can view mentorship conversations" ON public.mentorship_conversations;

CREATE OR REPLACE FUNCTION public.admin_get_mentorship_dashboard_stats()
RETURNS TABLE (
  active_conversation_count integer,
  open_request_count integer
) AS $$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Admin required.';
  END IF;

  RETURN QUERY
  SELECT
    (
      SELECT COUNT(*)::integer
      FROM public.mentorship_conversations conversation
      JOIN public.mentorship_requests request
        ON request.id = conversation.request_id
      WHERE request.status = 'accepted'
        AND EXISTS (
          SELECT 1
          FROM public.mentorship_messages message
          WHERE message.conversation_id = conversation.id
        )
    ) AS active_conversation_count,
    (
      SELECT COUNT(*)::integer
      FROM public.mentorship_requests request
      WHERE request.status IN ('pending', 'accepted', 'completed')
    ) AS open_request_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.admin_get_mentorship_dashboard_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_mentorship_dashboard_stats() TO authenticated;

NOTIFY pgrst, 'reload schema';
