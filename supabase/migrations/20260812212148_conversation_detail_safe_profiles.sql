-- Return only profile fields that are safe to expose through relationship-aware
-- RPC payloads. Do not include student_number, registry ids, or admin metadata.
CREATE OR REPLACE FUNCTION public.profile_safe_json(p_profile public.profiles)
RETURNS JSONB
LANGUAGE SQL
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_profile.id IS NULL THEN NULL
    ELSE jsonb_build_object(
      'id', p_profile.id,
      'full_name', p_profile.full_name,
      'nickname', p_profile.nickname,
      'role', p_profile.role,
      'avatar_url', p_profile.avatar_url,
      'university', p_profile.university,
      'department', p_profile.department,
      'interests', p_profile.interests,
      'graduation_year', p_profile.graduation_year,
      'field_of_study', p_profile.field_of_study,
      'bio', p_profile.bio,
      'current_grade', p_profile.current_grade,
      'class_section', p_profile.class_section,
      'target_field', p_profile.target_field,
      'target_departments', p_profile.target_departments,
      'target_universities', p_profile.target_universities,
      'mentorship_expectations', p_profile.mentorship_expectations,
      'education_status', p_profile.education_status,
      'is_working', p_profile.is_working,
      'company_name', p_profile.company_name,
      'company_logo', p_profile.company_logo,
      'work_title', p_profile.work_title,
      'linkedin_url', p_profile.linkedin_url,
      'mentorship_capacity', p_profile.mentorship_capacity,
      'mentorship_topics', p_profile.mentorship_topics,
      'mentorship_availability', p_profile.mentorship_availability,
      'is_verified', p_profile.is_verified,
      'is_profile_complete', p_profile.is_profile_complete,
      'created_at', p_profile.created_at,
      'updated_at', p_profile.updated_at
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.profile_safe_json(public.profiles) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_mentorship_conversation_detail(p_conversation_id UUID)
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
    'conversation', jsonb_build_object(
      'id', conversation.id,
      'request_id', conversation.request_id,
      'student_id', conversation.student_id,
      'mentor_id', conversation.mentor_id,
      'created_at', conversation.created_at,
      'last_message_at', conversation.last_message_at
    ),
    'request', jsonb_build_object(
      'id', request.id,
      'student_id', request.student_id,
      'mentor_id', request.mentor_id,
      'request_message', request.request_message,
      'status', request.status,
      'match_score', request.match_score,
      'match_reasons', request.match_reasons,
      'created_at', request.created_at,
      'responded_at', request.responded_at,
      'completed_at', request.completed_at
    ),
    'other_profile', public.profile_safe_json(other_profile),
    'messages', COALESCE((
      SELECT jsonb_agg(to_jsonb(message_row) ORDER BY message_row.created_at ASC)
      FROM (
        SELECT
          message.id,
          message.conversation_id,
          message.sender_id,
          message.recipient_id,
          message.content,
          message.is_read,
          message.created_at
        FROM public.mentorship_messages AS message
        WHERE message.conversation_id = conversation.id
        ORDER BY message.created_at DESC
        LIMIT 100
      ) AS message_row
    ), '[]'::JSONB),
    'review', CASE
      WHEN conversation.student_id = current_user_id THEN (
        SELECT to_jsonb(review)
        FROM public.mentorship_reviews AS review
        WHERE review.request_id = conversation.request_id
          AND review.student_id = current_user_id
        LIMIT 1
      )
      ELSE NULL
    END
  )
  INTO result
  FROM public.mentorship_conversations AS conversation
  JOIN public.mentorship_requests AS request ON request.id = conversation.request_id
  JOIN public.profiles AS other_profile
    ON other_profile.id = CASE
      WHEN conversation.student_id = current_user_id THEN conversation.mentor_id
      ELSE conversation.student_id
    END
  WHERE conversation.id = p_conversation_id
    AND (conversation.student_id = current_user_id OR conversation.mentor_id = current_user_id)
  LIMIT 1;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_social_conversation_detail(p_room_id UUID)
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
    'room', jsonb_build_object(
      'id', room.id,
      'match_id', room.match_id,
      'user_a', room.user_a,
      'user_b', room.user_b,
      'expires_at', room.expires_at,
      'is_expired', room.is_expired,
      'created_at', room.created_at
    ),
    'match', CASE
      WHEN match.id IS NULL THEN NULL
      ELSE jsonb_build_object(
        'id', match.id,
        'user_a', match.user_a,
        'user_b', match.user_b,
        'status', match.status,
        'match_score', match.match_score,
        'match_reasons', match.match_reasons,
        'requested_by', match.requested_by,
        'created_at', match.created_at,
        'responded_at', match.responded_at
      )
    END,
    'other_profile', public.profile_safe_json(other_profile),
    'messages', COALESCE((
      SELECT jsonb_agg(to_jsonb(message_row) ORDER BY message_row.created_at ASC)
      FROM (
        SELECT
          message.id,
          message.room_id,
          message.sender_id,
          message.recipient_id,
          message.content,
          message.is_read,
          message.created_at
        FROM public.messages AS message
        WHERE message.room_id = room.id
        ORDER BY message.created_at DESC
        LIMIT 100
      ) AS message_row
    ), '[]'::JSONB)
  )
  INTO result
  FROM public.chat_rooms AS room
  LEFT JOIN public.matches AS match ON match.id = room.match_id
  JOIN public.profiles AS other_profile
    ON other_profile.id = CASE
      WHEN room.user_a = current_user_id THEN room.user_b
      ELSE room.user_a
    END
  WHERE room.id = p_room_id
    AND (room.user_a = current_user_id OR room.user_b = current_user_id)
  LIMIT 1;

  RETURN result;
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
          'other_profile', public.profile_safe_json(other_profile),
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
              'recipient_id', last_message.recipient_id,
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
        SELECT message.id, message.conversation_id, message.sender_id, message.recipient_id, message.content, message.is_read, message.created_at
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
          'other_profile', public.profile_safe_json(other_profile),
          'last_message', CASE
            WHEN last_message.id IS NULL THEN NULL
            ELSE jsonb_build_object(
              'id', last_message.id,
              'room_id', last_message.room_id,
              'sender_id', last_message.sender_id,
              'recipient_id', last_message.recipient_id,
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
        SELECT message.id, message.room_id, message.sender_id, message.recipient_id, message.content, message.is_read, message.created_at
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
          'other_profile', public.profile_safe_json(other_profile),
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
    ), '[]'::jsonb)
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
    'profile', public.profile_safe_json(current_profile),
    'socialRequests', COALESCE((
      SELECT jsonb_agg(
        to_jsonb(match)
        || jsonb_build_object(
          'other_profile', public.profile_safe_json(other_profile),
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
        SELECT jsonb_agg(public.profile_safe_json(mentor))
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
            'student_profile', public.profile_safe_json(student),
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

REVOKE ALL ON FUNCTION public.get_mentorship_conversation_detail(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_social_conversation_detail(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_messages_overview() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_matching_overview() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_mentorship_conversation_detail(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_social_conversation_detail(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_messages_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_matching_overview() TO authenticated;
