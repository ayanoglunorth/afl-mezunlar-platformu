-- Registration identity, private contacts, chat moderation, and durable unread
-- message notifications.

CREATE INDEX IF NOT EXISTS profiles_student_number_lookup
  ON profiles ((BTRIM(student_number)))
  WHERE NULLIF(BTRIM(student_number), '') IS NOT NULL;

CREATE OR REPLACE FUNCTION enforce_unique_profile_student_number()
RETURNS TRIGGER AS $$
DECLARE
  normalized_number TEXT;
BEGIN
  normalized_number := NULLIF(BTRIM(NEW.student_number), '');
  IF normalized_number IS NULL THEN
    RETURN NEW;
  END IF;

  -- Serializes concurrent registrations for the same number even if historical
  -- duplicate rows need to be resolved before a unique index can be introduced.
  PERFORM pg_advisory_xact_lock(hashtextextended(normalized_number, 0));

  IF EXISTS (
    SELECT 1
    FROM profiles
    WHERE BTRIM(student_number) = normalized_number
      AND id <> NEW.id
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'This student number is already registered.';
  END IF;

  NEW.student_number := normalized_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS profiles_unique_student_number_guard ON profiles;
CREATE TRIGGER profiles_unique_student_number_guard
  BEFORE INSERT OR UPDATE OF student_number ON profiles
  FOR EACH ROW EXECUTE FUNCTION enforce_unique_profile_student_number();

CREATE TABLE private_user_contacts (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  phone_e164 TEXT NOT NULL UNIQUE CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  phone_verified_at TIMESTAMPTZ NOT NULL,
  verification_provider TEXT NOT NULL DEFAULT 'twilio_verify',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE private_user_contacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private_user_contacts FROM anon, authenticated;

CREATE TYPE moderation_conversation_kind AS ENUM ('social', 'mentorship');
CREATE TYPE message_report_status AS ENUM ('open', 'reviewing', 'resolved', 'dismissed');

CREATE TABLE conversation_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reviewed_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  conversation_kind moderation_conversation_kind NOT NULL,
  conversation_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  note TEXT CHECK (note IS NULL OR CHAR_LENGTH(note) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (reviewer_id <> reviewed_user_id),
  UNIQUE (reviewer_id, conversation_kind, conversation_id)
);

CREATE INDEX conversation_reviews_reviewed_user
  ON conversation_reviews(reviewed_user_id, created_at DESC);

CREATE TABLE message_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reported_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  conversation_kind moderation_conversation_kind NOT NULL,
  conversation_id UUID NOT NULL,
  note TEXT CHECK (note IS NULL OR CHAR_LENGTH(note) <= 2000),
  status message_report_status NOT NULL DEFAULT 'open',
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (reporter_id <> reported_user_id)
);

CREATE INDEX message_reports_status_created
  ON message_reports(status, created_at DESC);

CREATE TABLE reported_messages (
  report_id UUID NOT NULL REFERENCES message_reports(id) ON DELETE CASCADE,
  message_id UUID NOT NULL,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content_snapshot TEXT NOT NULL,
  message_created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (report_id, message_id)
);

ALTER TABLE conversation_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE reported_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON conversation_reviews, message_reports, reported_messages FROM anon, authenticated;

-- Serialize accepts per mentor so two pending requests cannot both consume the
-- final capacity slot in concurrent transactions.
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
  ON CONFLICT ON CONSTRAINT mentorship_conversations_request_id_key DO UPDATE
    SET last_message_at = mentorship_conversations.last_message_at
  RETURNING id INTO conversation_id;

  RETURN conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Include failed jobs in the single-job-per-conversation invariant. A new
-- message updates the same retryable job instead of creating a second email.
DROP INDEX IF EXISTS notification_jobs_one_pending_conversation;
CREATE UNIQUE INDEX notification_jobs_one_active_conversation
  ON notification_jobs(recipient_id, conversation_kind, conversation_id)
  WHERE status IN ('pending', 'processing', 'failed');

CREATE OR REPLACE FUNCTION queue_message_notification(
  p_kind notification_conversation_kind,
  p_conversation_id UUID,
  p_message_id UUID,
  p_recipient_id UUID
) RETURNS UUID AS $$
DECLARE
  job_id UUID;
BEGIN
  INSERT INTO notification_jobs (
    recipient_id,
    conversation_kind,
    conversation_id,
    first_message_id
  )
  VALUES (p_recipient_id, p_kind, p_conversation_id, p_message_id)
  ON CONFLICT (recipient_id, conversation_kind, conversation_id)
    WHERE status IN ('pending', 'processing', 'failed')
  DO UPDATE SET
    updated_at = NOW(),
    status = CASE
      WHEN notification_jobs.status = 'failed' THEN 'pending'::notification_job_status
      ELSE notification_jobs.status
    END,
    scheduled_for = CASE
      WHEN notification_jobs.status = 'failed' THEN LEAST(notification_jobs.scheduled_for, NOW() + INTERVAL '2 minutes')
      ELSE notification_jobs.scheduled_for
    END
  RETURNING id INTO job_id;

  RETURN job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION queue_social_message_notification()
RETURNS TRIGGER AS $$
DECLARE
  recipient UUID;
BEGIN
  SELECT CASE WHEN user_a = NEW.sender_id THEN user_b ELSE user_a END
  INTO recipient
  FROM chat_rooms
  WHERE id = NEW.room_id
    AND NEW.sender_id IN (user_a, user_b);

  IF recipient IS NOT NULL THEN
    PERFORM queue_message_notification('social', NEW.room_id, NEW.id, recipient);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION queue_mentorship_message_notification()
RETURNS TRIGGER AS $$
DECLARE
  recipient UUID;
BEGIN
  SELECT CASE WHEN student_id = NEW.sender_id THEN mentor_id ELSE student_id END
  INTO recipient
  FROM mentorship_conversations
  WHERE id = NEW.conversation_id
    AND NEW.sender_id IN (student_id, mentor_id);

  IF recipient IS NOT NULL THEN
    PERFORM queue_message_notification('mentorship', NEW.conversation_id, NEW.id, recipient);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS queue_social_message_email ON messages;
CREATE TRIGGER queue_social_message_email
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION queue_social_message_notification();

DROP TRIGGER IF EXISTS queue_mentorship_message_email ON mentorship_messages;
CREATE TRIGGER queue_mentorship_message_email
  AFTER INSERT ON mentorship_messages
  FOR EACH ROW EXECUTE FUNCTION queue_mentorship_message_notification();

CREATE OR REPLACE FUNCTION claim_due_notification_jobs(p_limit INTEGER DEFAULT 25)
RETURNS SETOF notification_jobs AS $$
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT id
    FROM notification_jobs
    WHERE status IN ('pending', 'failed')
      AND scheduled_for <= NOW()
    ORDER BY scheduled_for
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(p_limit, 1), 100)
  )
  UPDATE notification_jobs AS jobs
  SET
    status = 'processing',
    locked_at = NOW(),
    attempt_count = jobs.attempt_count + 1,
    updated_at = NOW()
  FROM due
  WHERE jobs.id = due.id
  RETURNING jobs.*;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION claim_due_notification_jobs(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_due_notification_jobs(INTEGER) TO service_role;
