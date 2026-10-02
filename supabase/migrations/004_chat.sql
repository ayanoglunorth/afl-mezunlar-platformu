-- ============================================
-- Migration 004: Time-Limited Chat System
-- ============================================

-- Chat rooms (created when a match is accepted)
CREATE TABLE chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_a UUID NOT NULL REFERENCES profiles(id),
  user_b UUID NOT NULL REFERENCES profiles(id),
  expires_at TIMESTAMPTZ NOT NULL,
  is_expired BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_rooms_user_a ON chat_rooms(user_a);
CREATE INDEX idx_chat_rooms_user_b ON chat_rooms(user_b);
CREATE INDEX idx_chat_rooms_expires_at ON chat_rooms(expires_at) WHERE is_expired = FALSE;

-- Chat messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id),
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_room_created ON messages(room_id, created_at);
CREATE INDEX idx_messages_sender ON messages(sender_id);

-- Function to auto-expire chat rooms
CREATE OR REPLACE FUNCTION expire_chat_rooms()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE chat_rooms
  SET is_expired = TRUE
  WHERE expires_at < NOW() AND is_expired = FALSE;
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create a chat room when match is accepted
CREATE OR REPLACE FUNCTION create_chat_room_on_accept()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    INSERT INTO chat_rooms (match_id, user_a, user_b, expires_at)
    VALUES (NEW.id, NEW.user_a, NEW.user_b, NOW() + INTERVAL '14 days');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_match_accepted
  AFTER UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION create_chat_room_on_accept();
