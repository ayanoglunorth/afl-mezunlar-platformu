-- Allow participants to submit reviews and reports without the service role.
-- NIST: This protects moderation availability and ownership boundaries. Attack
-- scenario: a user posts a report for a conversation they do not belong to, or
-- a missing service-role secret breaks the report/review flow.

CREATE OR REPLACE FUNCTION public.get_conversation_participants(
  p_kind TEXT,
  p_conversation_id UUID
)
RETURNS TABLE (first_user_id UUID, second_user_id UUID) AS $$
BEGIN
  IF p_kind = 'social' THEN
    RETURN QUERY
    SELECT room.user_a, room.user_b
    FROM public.chat_rooms AS room
    WHERE room.id = p_conversation_id;
    RETURN;
  END IF;

  IF p_kind = 'mentorship' THEN
    RETURN QUERY
    SELECT conversation.student_id, conversation.mentor_id
    FROM public.mentorship_conversations AS conversation
    WHERE conversation.id = p_conversation_id;
    RETURN;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.submit_conversation_review(
  p_kind TEXT,
  p_conversation_id UUID,
  p_rating INTEGER,
  p_note TEXT DEFAULT NULL
)
RETURNS boolean AS $$
DECLARE
  v_participants RECORD;
  v_reviewed_user_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Authentication required.';
  END IF;

  IF p_kind NOT IN ('social', 'mentorship') OR p_rating < 1 OR p_rating > 5 THEN
    RETURN FALSE;
  END IF;

  SELECT * INTO v_participants
  FROM public.get_conversation_participants(p_kind, p_conversation_id)
  LIMIT 1;

  IF NOT FOUND OR auth.uid() NOT IN (v_participants.first_user_id, v_participants.second_user_id) THEN
    RETURN FALSE;
  END IF;

  v_reviewed_user_id := CASE
    WHEN auth.uid() = v_participants.first_user_id THEN v_participants.second_user_id
    ELSE v_participants.first_user_id
  END;

  INSERT INTO public.conversation_reviews (
    reviewer_id,
    reviewed_user_id,
    conversation_kind,
    conversation_id,
    rating,
    note,
    updated_at
  )
  VALUES (
    auth.uid(),
    v_reviewed_user_id,
    p_kind::moderation_conversation_kind,
    p_conversation_id,
    p_rating,
    NULLIF(LEFT(BTRIM(COALESCE(p_note, '')), 2000), ''),
    NOW()
  )
  ON CONFLICT (reviewer_id, conversation_kind, conversation_id)
  DO UPDATE SET
    reviewed_user_id = EXCLUDED.reviewed_user_id,
    rating = EXCLUDED.rating,
    note = EXCLUDED.note,
    updated_at = NOW();

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.submit_message_report(
  p_kind TEXT,
  p_conversation_id UUID,
  p_message_ids UUID[],
  p_note TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_participants RECORD;
  v_reported_user_id UUID;
  v_report_id UUID;
  v_message_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Authentication required.';
  END IF;

  IF p_kind NOT IN ('social', 'mentorship')
     OR p_message_ids IS NULL
     OR array_length(p_message_ids, 1) IS NULL
     OR array_length(p_message_ids, 1) > 20 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_participants
  FROM public.get_conversation_participants(p_kind, p_conversation_id)
  LIMIT 1;

  IF NOT FOUND OR auth.uid() NOT IN (v_participants.first_user_id, v_participants.second_user_id) THEN
    RETURN NULL;
  END IF;

  v_reported_user_id := CASE
    WHEN auth.uid() = v_participants.first_user_id THEN v_participants.second_user_id
    ELSE v_participants.first_user_id
  END;

  IF p_kind = 'social' THEN
    SELECT COUNT(*)
    INTO v_message_count
    FROM public.messages AS message
    WHERE message.room_id = p_conversation_id
      AND message.id = ANY(p_message_ids)
      AND message.sender_id = v_reported_user_id;
  ELSE
    SELECT COUNT(*)
    INTO v_message_count
    FROM public.mentorship_messages AS message
    WHERE message.conversation_id = p_conversation_id
      AND message.id = ANY(p_message_ids)
      AND message.sender_id = v_reported_user_id;
  END IF;

  IF v_message_count <> array_length(p_message_ids, 1) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.message_reports (
    reporter_id,
    reported_user_id,
    conversation_kind,
    conversation_id,
    note
  )
  VALUES (
    auth.uid(),
    v_reported_user_id,
    p_kind::moderation_conversation_kind,
    p_conversation_id,
    NULLIF(LEFT(BTRIM(COALESCE(p_note, '')), 2000), '')
  )
  RETURNING id INTO v_report_id;

  IF p_kind = 'social' THEN
    INSERT INTO public.reported_messages (report_id, message_id, sender_id, content_snapshot, message_created_at)
    SELECT v_report_id, message.id, message.sender_id, message.content, message.created_at
    FROM public.messages AS message
    WHERE message.room_id = p_conversation_id
      AND message.id = ANY(p_message_ids)
      AND message.sender_id = v_reported_user_id;
  ELSE
    INSERT INTO public.reported_messages (report_id, message_id, sender_id, content_snapshot, message_created_at)
    SELECT v_report_id, message.id, message.sender_id, message.content, message.created_at
    FROM public.mentorship_messages AS message
    WHERE message.conversation_id = p_conversation_id
      AND message.id = ANY(p_message_ids)
      AND message.sender_id = v_reported_user_id;
  END IF;

  RETURN v_report_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.get_conversation_participants(TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_conversation_review(TEXT, UUID, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_message_report(TEXT, UUID, UUID[], TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.submit_conversation_review(TEXT, UUID, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_message_report(TEXT, UUID, UUID[], TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
