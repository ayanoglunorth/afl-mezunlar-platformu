-- ============================================
-- Migration 076: Realtime profile and messages overview RPCs
-- ============================================

CREATE OR REPLACE FUNCTION public.get_realtime_profile()
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  nickname TEXT,
  role user_role,
  is_admin BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  RETURN QUERY
  SELECT
    profile.id,
    profile.full_name,
    profile.nickname,
    profile.role,
    (profile.role = 'admin'::user_role OR public.is_platform_admin(current_user_id)) AS is_admin
  FROM public.profiles AS profile
  WHERE profile.id = current_user_id
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_messages_overview()
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
    'currentUserId', current_user_id,
    'mentorshipConversations',
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', conversation.id,
          'request_id', conversation.request_id,
          'student_id', conversation.student_id,
          'mentor_id', conversation.mentor_id,
          'created_at', conversation.created_at,
          'last_message_at', conversation.last_message_at,
          'other_profile', jsonb_build_object(
            'id', other_profile.id,
            'full_name', other_profile.full_name,
            'university', other_profile.university,
            'department', other_profile.department,
            'field_of_study', other_profile.field_of_study
          ),
          'request', jsonb_build_object(
            'id', request.id,
            'status', request.status
          ),
          'last_message', CASE
            WHEN last_message.id IS NULL THEN NULL
            ELSE jsonb_build_object(
              'id', last_message.id,
              'conversation_id', last_message.conversation_id,
              'sender_id', last_message.sender_id,
              'content', last_message.content,
              'is_read', last_message.is_read,
              'created_at', last_message.created_at
            )
          END,
          'unread_count', COALESCE(unread_count.count, 0)
        )
        ORDER BY COALESCE(last_message.created_at, conversation.last_message_at, conversation.created_at) DESC
      )
      FROM public.mentorship_conversations AS conversation
      JOIN public.mentorship_requests AS request ON request.id = conversation.request_id
      JOIN public.profiles AS other_profile
        ON other_profile.id = CASE
          WHEN conversation.student_id = current_user_id THEN conversation.mentor_id
          ELSE conversation.student_id
        END
      LEFT JOIN LATERAL (
        SELECT message.id, message.conversation_id, message.sender_id, message.content, message.is_read, message.created_at
        FROM public.mentorship_messages AS message
        WHERE message.conversation_id = conversation.id
        ORDER BY message.created_at DESC
        LIMIT 1
      ) AS last_message ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::INTEGER AS count
        FROM public.mentorship_messages AS message
        WHERE message.conversation_id = conversation.id
          AND message.is_read = FALSE
          AND message.sender_id <> current_user_id
      ) AS unread_count ON TRUE
      WHERE conversation.student_id = current_user_id OR conversation.mentor_id = current_user_id
    ), '[]'::jsonb),
    'generalRooms',
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', room.id,
          'match_id', room.match_id,
          'user_a', room.user_a,
          'user_b', room.user_b,
          'expires_at', room.expires_at,
          'is_expired', room.is_expired,
          'created_at', room.created_at,
          'other_profile', jsonb_build_object(
            'id', other_profile.id,
            'full_name', other_profile.full_name,
            'university', other_profile.university,
            'department', other_profile.department,
            'field_of_study', other_profile.field_of_study
          ),
          'last_message', CASE
            WHEN last_message.id IS NULL THEN NULL
            ELSE jsonb_build_object(
              'id', last_message.id,
              'room_id', last_message.room_id,
              'sender_id', last_message.sender_id,
              'content', last_message.content,
              'is_read', last_message.is_read,
              'created_at', last_message.created_at
            )
          END,
          'unread_count', COALESCE(unread_count.count, 0)
        )
        ORDER BY COALESCE(last_message.created_at, room.created_at) DESC
      )
      FROM public.chat_rooms AS room
      JOIN public.profiles AS other_profile
        ON other_profile.id = CASE
          WHEN room.user_a = current_user_id THEN room.user_b
          ELSE room.user_a
        END
      LEFT JOIN LATERAL (
        SELECT message.id, message.room_id, message.sender_id, message.content, message.is_read, message.created_at
        FROM public.messages AS message
        WHERE message.room_id = room.id
        ORDER BY message.created_at DESC
        LIMIT 1
      ) AS last_message ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::INTEGER AS count
        FROM public.messages AS message
        WHERE message.room_id = room.id
          AND message.is_read = FALSE
          AND message.sender_id <> current_user_id
      ) AS unread_count ON TRUE
      WHERE (room.user_a = current_user_id OR room.user_b = current_user_id)
        AND room.is_expired = FALSE
    ), '[]'::jsonb),
    'socialRequests',
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', match.id,
          'user_a', match.user_a,
          'user_b', match.user_b,
          'status', match.status,
          'match_score', match.match_score,
          'match_reasons', match.match_reasons,
          'requested_by', match.requested_by,
          'created_at', match.created_at,
          'responded_at', match.responded_at,
          'other_profile', jsonb_build_object(
            'id', other_profile.id,
            'full_name', other_profile.full_name,
            'university', other_profile.university,
            'department', other_profile.department,
            'field_of_study', other_profile.field_of_study
          ),
          'request_note', COALESCE(
            NULLIF(regexp_replace(reason.message, '^Mesaj:\\s*', ''), ''),
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
    ), '[]'::jsonb)
  )
  INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_realtime_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_messages_overview() TO authenticated;
