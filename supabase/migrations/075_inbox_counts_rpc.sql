-- ============================================
-- Migration 075: Global inbox counts RPC
-- ============================================

CREATE OR REPLACE FUNCTION public.get_inbox_counts()
RETURNS TABLE (
  social_unread INTEGER,
  mentor_unread INTEGER,
  forum_unread INTEGER,
  social_request_count INTEGER,
  mentorship_request_count INTEGER,
  unread_messages_total INTEGER,
  pending_matches_total INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  next_social_unread INTEGER := 0;
  next_mentor_unread INTEGER := 0;
  next_forum_unread INTEGER := 0;
  next_social_request_count INTEGER := 0;
  next_mentorship_request_count INTEGER := 0;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO next_social_unread
  FROM public.messages AS message
  JOIN public.chat_rooms AS room ON room.id = message.room_id
  WHERE room.is_expired = FALSE
    AND (room.user_a = current_user_id OR room.user_b = current_user_id)
    AND message.is_read = FALSE
    AND message.sender_id <> current_user_id;

  SELECT COUNT(*)::INTEGER
  INTO next_mentor_unread
  FROM public.mentorship_messages AS message
  JOIN public.mentorship_conversations AS conversation ON conversation.id = message.conversation_id
  WHERE (conversation.student_id = current_user_id OR conversation.mentor_id = current_user_id)
    AND message.is_read = FALSE
    AND message.sender_id <> current_user_id;

  SELECT COUNT(*)::INTEGER
  INTO next_forum_unread
  FROM public.forum_notifications AS notification
  WHERE notification.recipient_id = current_user_id
    AND notification.is_read = FALSE;

  SELECT COUNT(*)::INTEGER
  INTO next_social_request_count
  FROM public.matches AS match
  WHERE (match.user_a = current_user_id OR match.user_b = current_user_id)
    AND match.status = 'pending'
    AND match.requested_by IS DISTINCT FROM current_user_id;

  SELECT COUNT(*)::INTEGER
  INTO next_mentorship_request_count
  FROM public.mentorship_requests AS request
  WHERE request.mentor_id = current_user_id
    AND request.status = 'pending';

  RETURN QUERY
  SELECT
    next_social_unread,
    next_mentor_unread,
    next_forum_unread,
    next_social_request_count,
    next_mentorship_request_count,
    next_social_unread + next_mentor_unread + next_social_request_count,
    next_social_request_count + next_mentorship_request_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_inbox_counts() TO authenticated;
