-- Keep notification events visible to the clients that can already read these rows.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE matches;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE mentorship_requests;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE messages REPLICA IDENTITY FULL;
ALTER TABLE mentorship_messages REPLICA IDENTITY FULL;

CREATE TABLE message_email_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_kind TEXT NOT NULL CHECK (source_kind IN ('social_message', 'mentorship_message', 'social_request', 'mentorship_request')),
  source_id UUID NOT NULL,
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  resend_email_id TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_kind, source_id)
);

CREATE INDEX idx_message_email_notifications_recipient
  ON message_email_notifications(recipient_id, cancelled_at);

ALTER TABLE message_email_notifications ENABLE ROW LEVEL SECURITY;
