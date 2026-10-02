-- Migration 053: Add recipient_id to messages for Realtime RLS compatibility

-- Add recipient_id columns
ALTER TABLE messages ADD COLUMN recipient_id UUID REFERENCES profiles(id);
ALTER TABLE mentorship_messages ADD COLUMN recipient_id UUID REFERENCES profiles(id);

-- Backfill existing messages
UPDATE messages m
SET recipient_id = (
  SELECT CASE WHEN c.user_a = m.sender_id THEN c.user_b ELSE c.user_a END
  FROM chat_rooms c WHERE c.id = m.room_id
);

UPDATE mentorship_messages m
SET recipient_id = (
  SELECT CASE WHEN c.mentor_id = m.sender_id THEN c.student_id ELSE c.mentor_id END
  FROM mentorship_conversations c WHERE c.id = m.conversation_id
);

-- Make them NOT NULL (if there are no messages where room doesn't exist. Assuming referential integrity is fine)
-- We will just leave them nullable in case some orphaned messages exist, but they should be filled.
-- Actually, it's safer to keep it nullable if there's any broken data, but let's try setting NOT NULL if possible.
DO $$
BEGIN
  ALTER TABLE messages ALTER COLUMN recipient_id SET NOT NULL;
  ALTER TABLE mentorship_messages ALTER COLUMN recipient_id SET NOT NULL;
EXCEPTION
  WHEN not_null_violation THEN
    -- If some orphaned rows exist, we skip setting NOT NULL.
    NULL;
END $$;

-- Create triggers to auto-populate recipient_id on new inserts
CREATE OR REPLACE FUNCTION set_message_recipient_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.recipient_id IS NULL THEN
    NEW.recipient_id := (
      SELECT CASE WHEN user_a = NEW.sender_id THEN user_b ELSE user_a END
      FROM chat_rooms WHERE id = NEW.room_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_set_message_recipient_id ON messages;
CREATE TRIGGER trg_set_message_recipient_id
BEFORE INSERT ON messages
FOR EACH ROW EXECUTE FUNCTION set_message_recipient_id();

CREATE OR REPLACE FUNCTION set_mentorship_message_recipient_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.recipient_id IS NULL THEN
    NEW.recipient_id := (
      SELECT CASE WHEN mentor_id = NEW.sender_id THEN student_id ELSE mentor_id END
      FROM mentorship_conversations WHERE id = NEW.conversation_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_set_mentorship_message_recipient_id ON mentorship_messages;
CREATE TRIGGER trg_set_mentorship_message_recipient_id
BEFORE INSERT ON mentorship_messages
FOR EACH ROW EXECUTE FUNCTION set_mentorship_message_recipient_id();

-- Update RLS Policies to NOT use EXISTS (which breaks Realtime)
DROP POLICY IF EXISTS "Users can read messages in their rooms" ON messages;
CREATE POLICY "Users can read messages in their rooms"
  ON messages FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

DROP POLICY IF EXISTS "Participants can read mentorship messages" ON mentorship_messages;
CREATE POLICY "Participants can read mentorship messages"
  ON mentorship_messages FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

DROP POLICY IF EXISTS "Participants can mark mentorship messages read" ON mentorship_messages;
CREATE POLICY "Participants can mark mentorship messages read"
  ON mentorship_messages FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid());
