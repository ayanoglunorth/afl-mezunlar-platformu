-- First message in a mentorship conversation triggers an instant notification.
-- Subsequent messages use a 5-minute delay. The worker also uses the
-- mentorshipFirstMessageHtml template when it detects it is the first message.

-- Update the core queue function to accept an is_first_message flag.
CREATE OR REPLACE FUNCTION queue_message_notification(
  p_kind notification_conversation_kind,
  p_conversation_id UUID,
  p_message_id UUID,
  p_recipient_id UUID,
  p_is_first_message BOOLEAN DEFAULT FALSE
) RETURNS UUID AS $$
DECLARE
  job_id UUID;
  delay INTERVAL;
BEGIN
  IF p_is_first_message THEN
    delay := INTERVAL '0 seconds';
  ELSE
    delay := INTERVAL '5 minutes';
  END IF;

  INSERT INTO notification_jobs (
    recipient_id,
    conversation_kind,
    conversation_id,
    first_message_id,
    scheduled_for
  )
  VALUES (p_recipient_id, p_kind, p_conversation_id, p_message_id, NOW() + delay)
  ON CONFLICT (recipient_id, conversation_kind, conversation_id)
    WHERE status IN ('pending', 'processing', 'failed')
  DO UPDATE SET
    updated_at = NOW(),
    status = CASE
      WHEN notification_jobs.status = 'failed' THEN 'pending'::notification_job_status
      ELSE notification_jobs.status
    END,
    scheduled_for = CASE
      WHEN notification_jobs.status = 'failed' THEN LEAST(notification_jobs.scheduled_for, NOW() + INTERVAL '5 minutes')
      ELSE notification_jobs.scheduled_for
    END
  RETURNING id INTO job_id;

  RETURN job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Social messages keep the 5-minute delay (no first-message special case).
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
    PERFORM queue_message_notification('social', NEW.room_id, NEW.id, recipient, FALSE);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Mentorship messages: first message in the conversation triggers instant
-- notification; subsequent messages use the 5-minute delay.
CREATE OR REPLACE FUNCTION queue_mentorship_message_notification()
RETURNS TRIGGER AS $$
DECLARE
  recipient UUID;
  is_first BOOLEAN;
BEGIN
  SELECT CASE WHEN student_id = NEW.sender_id THEN mentor_id ELSE student_id END
  INTO recipient
  FROM mentorship_conversations
  WHERE id = NEW.conversation_id
    AND NEW.sender_id IN (student_id, mentor_id);

  IF recipient IS NOT NULL THEN
    -- Check if this is the very first message in the conversation.
    SELECT NOT EXISTS (
      SELECT 1
      FROM mentorship_messages
      WHERE conversation_id = NEW.conversation_id
        AND id <> NEW.id
      LIMIT 1
    ) INTO is_first;

    PERFORM queue_message_notification('mentorship', NEW.conversation_id, NEW.id, recipient, is_first);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate triggers to use updated functions.
DROP TRIGGER IF EXISTS queue_social_message_email ON messages;
CREATE TRIGGER queue_social_message_email
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION queue_social_message_notification();

DROP TRIGGER IF EXISTS queue_mentorship_message_email ON mentorship_messages;
CREATE TRIGGER queue_mentorship_message_email
  AFTER INSERT ON mentorship_messages
  FOR EACH ROW EXECUTE FUNCTION queue_mentorship_message_notification();
