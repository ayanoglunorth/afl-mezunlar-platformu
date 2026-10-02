-- Reading a message and cancelling its conversation-level email job happen in
-- the same database transaction. The worker also rechecks unread state as a
-- second safety net.
CREATE OR REPLACE FUNCTION cancel_social_notification_job_on_read()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_read = TRUE AND OLD.is_read = FALSE AND NEW.sender_id <> auth.uid() THEN
    UPDATE notification_jobs
    SET
      status = 'cancelled',
      cancelled_at = NOW(),
      locked_at = NULL,
      updated_at = NOW()
    WHERE recipient_id = auth.uid()
      AND conversation_kind = 'social'
      AND conversation_id = NEW.room_id
      AND status IN ('pending', 'processing', 'failed');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION cancel_mentorship_notification_job_on_read()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_read = TRUE AND OLD.is_read = FALSE AND NEW.sender_id <> auth.uid() THEN
    UPDATE notification_jobs
    SET
      status = 'cancelled',
      cancelled_at = NOW(),
      locked_at = NULL,
      updated_at = NOW()
    WHERE recipient_id = auth.uid()
      AND conversation_kind = 'mentorship'
      AND conversation_id = NEW.conversation_id
      AND status IN ('pending', 'processing', 'failed');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS cancel_social_email_job_on_read ON messages;
CREATE TRIGGER cancel_social_email_job_on_read
  AFTER UPDATE OF is_read ON messages
  FOR EACH ROW EXECUTE FUNCTION cancel_social_notification_job_on_read();

DROP TRIGGER IF EXISTS cancel_mentorship_email_job_on_read ON mentorship_messages;
CREATE TRIGGER cancel_mentorship_email_job_on_read
  AFTER UPDATE OF is_read ON mentorship_messages
  FOR EACH ROW EXECUTE FUNCTION cancel_mentorship_notification_job_on_read();
