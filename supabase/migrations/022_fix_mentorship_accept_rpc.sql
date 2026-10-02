-- `request_id` is also the public RPC argument name. Referencing the unique
-- constraint explicitly avoids PL/pgSQL's parameter/column ambiguity.
CREATE OR REPLACE FUNCTION accept_mentorship_request(request_id UUID)
RETURNS UUID AS $$
DECLARE
  target_request mentorship_requests%ROWTYPE;
  active_count INTEGER;
  mentor_capacity INTEGER;
  conversation_id UUID;
BEGIN
  SELECT * INTO target_request
  FROM mentorship_requests
  WHERE id = request_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Mentorship request not found'; END IF;
  IF target_request.mentor_id <> auth.uid() THEN RAISE EXCEPTION 'Only the mentor can accept this request'; END IF;
  IF target_request.status <> 'pending' THEN RAISE EXCEPTION 'Only pending requests can be accepted'; END IF;

  PERFORM 1 FROM profiles WHERE id = target_request.mentor_id FOR UPDATE;
  SELECT COALESCE(mentorship_capacity, 5)
  INTO mentor_capacity
  FROM profiles
  WHERE id = target_request.mentor_id
    AND role = 'alumni'
    AND is_verified = TRUE
    AND is_profile_complete = TRUE
    AND mentorship_availability = 'active';

  IF mentor_capacity IS NULL THEN RAISE EXCEPTION 'Mentor is not currently available'; END IF;

  SELECT COUNT(*) INTO active_count
  FROM mentorship_requests
  WHERE mentor_id = target_request.mentor_id
    AND status = 'accepted';
  IF active_count >= mentor_capacity THEN RAISE EXCEPTION 'Mentor active student capacity is full'; END IF;

  UPDATE mentorship_requests
  SET status = 'accepted', responded_at = NOW()
  WHERE id = request_id;

  INSERT INTO mentorship_conversations (request_id, student_id, mentor_id)
  VALUES (target_request.id, target_request.student_id, target_request.mentor_id)
  ON CONFLICT ON CONSTRAINT mentorship_conversations_request_id_key
  DO UPDATE SET last_message_at = mentorship_conversations.last_message_at
  RETURNING id INTO conversation_id;

  RETURN conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
