-- ============================================
-- Migration 006: Row Level Security Policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE alumni_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE upvotes ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PROFILES
-- ============================================

-- Anyone authenticated can read profiles
CREATE POLICY "Profiles are viewable by authenticated users"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================
-- ALUMNI REGISTRY
-- ============================================

-- Admins can do everything
CREATE POLICY "Admins can manage alumni registry"
  ON alumni_registry FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Authenticated users can read (for verification during registration)
CREATE POLICY "Authenticated users can read alumni registry"
  ON alumni_registry FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- MATCHES
-- ============================================

-- Users can see their own matches
CREATE POLICY "Users can view own matches"
  ON matches FOR SELECT
  TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b);

-- Users can create match requests
CREATE POLICY "Users can create match requests"
  ON matches FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = requested_by);

-- Users can update matches they're part of (accept/reject)
CREATE POLICY "Users can respond to match requests"
  ON matches FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b);

-- ============================================
-- MATCH SUGGESTIONS
-- ============================================

-- Users can see their own suggestions
CREATE POLICY "Users can view own suggestions"
  ON match_suggestions FOR SELECT
  TO authenticated
  USING (auth.uid() = for_user);

-- Users can dismiss suggestions
CREATE POLICY "Users can dismiss own suggestions"
  ON match_suggestions FOR UPDATE
  TO authenticated
  USING (auth.uid() = for_user)
  WITH CHECK (auth.uid() = for_user);

-- Service role can insert suggestions (matching engine)
CREATE POLICY "Service can insert suggestions"
  ON match_suggestions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================
-- CHAT ROOMS
-- ============================================

-- Users can see their own chat rooms
CREATE POLICY "Users can view own chat rooms"
  ON chat_rooms FOR SELECT
  TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b);

-- ============================================
-- MESSAGES
-- ============================================

-- Users can read messages in their chat rooms
CREATE POLICY "Users can read messages in their rooms"
  ON messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_rooms
      WHERE chat_rooms.id = messages.room_id
      AND (chat_rooms.user_a = auth.uid() OR chat_rooms.user_b = auth.uid())
    )
  );

-- Users can send messages to non-expired rooms they belong to
CREATE POLICY "Users can send messages to their active rooms"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM chat_rooms
      WHERE chat_rooms.id = room_id
      AND (chat_rooms.user_a = auth.uid() OR chat_rooms.user_b = auth.uid())
      AND chat_rooms.is_expired = FALSE
    )
  );

-- Users can mark messages as read
CREATE POLICY "Users can mark messages as read"
  ON messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_rooms
      WHERE chat_rooms.id = messages.room_id
      AND (chat_rooms.user_a = auth.uid() OR chat_rooms.user_b = auth.uid())
    )
  );

-- ============================================
-- FORUM
-- ============================================

-- Everyone can read categories
CREATE POLICY "Forum categories are public"
  ON forum_categories FOR SELECT
  TO authenticated
  USING (true);

-- Everyone can read threads
CREATE POLICY "Forum threads are viewable by authenticated users"
  ON forum_threads FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can create threads
CREATE POLICY "Authenticated users can create threads"
  ON forum_threads FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

-- Authors can update their own threads
CREATE POLICY "Authors can update own threads"
  ON forum_threads FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id);

-- Admins can update any thread (pin/lock)
CREATE POLICY "Admins can manage threads"
  ON forum_threads FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Admins can delete threads
CREATE POLICY "Admins can delete threads"
  ON forum_threads FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Everyone can read comments
CREATE POLICY "Forum comments are viewable by authenticated users"
  ON forum_comments FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can create comments
CREATE POLICY "Authenticated users can create comments"
  ON forum_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

-- Authors can update own comments
CREATE POLICY "Authors can update own comments"
  ON forum_comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id);

-- Admins can delete comments
CREATE POLICY "Admins can delete comments"
  ON forum_comments FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- UPVOTES
-- ============================================

-- Users can see all upvotes
CREATE POLICY "Upvotes are viewable"
  ON upvotes FOR SELECT
  TO authenticated
  USING (true);

-- Users can create upvotes
CREATE POLICY "Users can upvote"
  ON upvotes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can remove their own upvotes
CREATE POLICY "Users can remove own upvotes"
  ON upvotes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================
-- Enable Realtime for chat messages
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_rooms;
