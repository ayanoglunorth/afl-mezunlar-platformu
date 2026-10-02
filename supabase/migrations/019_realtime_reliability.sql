-- Durable, conversation-level email jobs. One pending job represents the first
-- unread message in a conversation and is cancelled when the recipient reads it.
CREATE TYPE notification_conversation_kind AS ENUM ('social', 'mentorship');
CREATE TYPE notification_job_status AS ENUM ('pending', 'processing', 'sent', 'cancelled', 'failed');

CREATE TABLE notification_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  conversation_kind notification_conversation_kind NOT NULL,
  conversation_id UUID NOT NULL,
  first_message_id UUID NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '2 minutes'),
  status notification_job_status NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  locked_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX notification_jobs_one_pending_conversation
  ON notification_jobs(recipient_id, conversation_kind, conversation_id)
  WHERE status IN ('pending', 'processing');
CREATE INDEX notification_jobs_due
  ON notification_jobs(status, scheduled_for)
  WHERE status IN ('pending', 'failed');

ALTER TABLE notification_jobs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION queue_message_notification(
  p_kind notification_conversation_kind,
  p_conversation_id UUID,
  p_message_id UUID,
  p_recipient_id UUID
) RETURNS UUID AS $$
DECLARE
  job_id UUID;
BEGIN
  INSERT INTO notification_jobs (recipient_id, conversation_kind, conversation_id, first_message_id)
  VALUES (p_recipient_id, p_kind, p_conversation_id, p_message_id)
  ON CONFLICT (recipient_id, conversation_kind, conversation_id)
    WHERE status IN ('pending', 'processing')
  DO UPDATE SET updated_at = NOW()
  RETURNING id INTO job_id;

  RETURN job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION cancel_message_notifications(
  p_kind notification_conversation_kind,
  p_conversation_id UUID
) RETURNS INTEGER AS $$
DECLARE
  affected INTEGER;
BEGIN
  UPDATE notification_jobs
  SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
  WHERE recipient_id = auth.uid()
    AND conversation_kind = p_kind
    AND conversation_id = p_conversation_id
    AND status IN ('pending', 'processing', 'failed');
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Enforce mentor availability and the mentor-specific capacity in the database.
CREATE OR REPLACE FUNCTION accept_mentorship_request(request_id UUID)
RETURNS UUID AS $$
DECLARE
  target_request mentorship_requests%ROWTYPE;
  active_count INTEGER;
  mentor_capacity INTEGER;
  conversation_id UUID;
BEGIN
  SELECT * INTO target_request FROM mentorship_requests WHERE id = request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Mentorship request not found'; END IF;
  IF target_request.mentor_id <> auth.uid() THEN RAISE EXCEPTION 'Only the mentor can accept this request'; END IF;
  IF target_request.status <> 'pending' THEN RAISE EXCEPTION 'Only pending requests can be accepted'; END IF;

  SELECT COALESCE(mentorship_capacity, 5) INTO mentor_capacity
  FROM profiles WHERE id = target_request.mentor_id AND mentorship_availability = 'active';
  IF mentor_capacity IS NULL THEN RAISE EXCEPTION 'Mentor is not currently available'; END IF;

  SELECT COUNT(*) INTO active_count
  FROM mentorship_requests
  WHERE mentor_id = target_request.mentor_id AND status = 'accepted';
  IF active_count >= mentor_capacity THEN RAISE EXCEPTION 'Mentor active student capacity is full'; END IF;

  UPDATE mentorship_requests SET status = 'accepted', responded_at = NOW() WHERE id = request_id;
  INSERT INTO mentorship_conversations (request_id, student_id, mentor_id)
  VALUES (target_request.id, target_request.student_id, target_request.mentor_id)
  ON CONFLICT ON CONSTRAINT mentorship_conversations_request_id_key
  DO UPDATE SET last_message_at = mentorship_conversations.last_message_at
  RETURNING id INTO conversation_id;
  RETURN conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION reject_unavailable_mentorship_request()
RETURNS TRIGGER AS $$
DECLARE
  mentor_available BOOLEAN;
  active_count INTEGER;
  mentor_capacity INTEGER;
BEGIN
  SELECT mentorship_availability = 'active', COALESCE(mentorship_capacity, 5)
    INTO mentor_available, mentor_capacity FROM profiles WHERE id = NEW.mentor_id;
  SELECT COUNT(*) INTO active_count FROM mentorship_requests
    WHERE mentor_id = NEW.mentor_id AND status = 'accepted';
  IF NOT mentor_available OR active_count >= mentor_capacity THEN
    RAISE EXCEPTION 'This mentor is not accepting new requests';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS mentorship_request_availability_guard ON mentorship_requests;
CREATE TRIGGER mentorship_request_availability_guard
  BEFORE INSERT ON mentorship_requests
  FOR EACH ROW EXECUTE FUNCTION reject_unavailable_mentorship_request();

ALTER TABLE mentorship_requests REPLICA IDENTITY FULL;
