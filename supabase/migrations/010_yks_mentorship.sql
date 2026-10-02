-- ============================================
-- Migration 010: 2026 YKS Preference Mentorship
-- ============================================

CREATE TYPE mentorship_request_status AS ENUM (
  'pending',
  'accepted',
  'rejected',
  'cancelled',
  'completed'
);

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS mentorship_availability TEXT NOT NULL DEFAULT 'active'
  CHECK (mentorship_availability IN ('active', 'unavailable'));

ALTER TABLE profiles
ALTER COLUMN mentorship_capacity SET DEFAULT 5;

UPDATE profiles
SET mentorship_capacity = 5
WHERE role = 'alumni' AND (mentorship_capacity IS NULL OR mentorship_capacity < 5);

CREATE TABLE mentorship_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mentor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  request_message TEXT NOT NULL CHECK (length(trim(request_message)) > 0),
  status mentorship_request_status NOT NULL DEFAULT 'pending',
  match_reasons TEXT[] NOT NULL DEFAULT '{}',
  match_score REAL NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  CHECK (student_id <> mentor_id)
);

CREATE UNIQUE INDEX mentorship_requests_one_open_per_pair
  ON mentorship_requests(student_id, mentor_id)
  WHERE status IN ('pending', 'accepted');

CREATE INDEX idx_mentorship_requests_student ON mentorship_requests(student_id, created_at DESC);
CREATE INDEX idx_mentorship_requests_mentor ON mentorship_requests(mentor_id, created_at DESC);
CREATE INDEX idx_mentorship_requests_status ON mentorship_requests(status);

CREATE TABLE mentorship_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL UNIQUE REFERENCES mentorship_requests(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mentor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mentorship_conversations_student ON mentorship_conversations(student_id, last_message_at DESC);
CREATE INDEX idx_mentorship_conversations_mentor ON mentorship_conversations(mentor_id, last_message_at DESC);

CREATE TABLE mentorship_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES mentorship_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (length(trim(content)) > 0),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mentorship_messages_conversation ON mentorship_messages(conversation_id, created_at);
CREATE INDEX idx_mentorship_messages_sender ON mentorship_messages(sender_id);

CREATE TABLE mentorship_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL UNIQUE REFERENCES mentorship_requests(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mentor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mentorship_reviews_mentor ON mentorship_reviews(mentor_id, created_at DESC);

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    full_name,
    role,
    student_number,
    field_of_study,
    graduation_year,
    university,
    department,
    current_grade,
    target_field,
    target_departments,
    target_universities,
    mentorship_expectations,
    education_status,
    is_working,
    company_name,
    company_logo,
    work_title,
    linkedin_url,
    mentorship_capacity,
    mentorship_topics,
    mentorship_availability,
    is_verified,
    is_profile_complete
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'student'),
    NEW.raw_user_meta_data->>'student_number',
    COALESCE(NEW.raw_user_meta_data->>'field_of_study', NEW.raw_user_meta_data->>'target_field'),
    NULLIF(NEW.raw_user_meta_data->>'graduation_year', '')::INTEGER,
    NEW.raw_user_meta_data->>'university',
    NEW.raw_user_meta_data->>'department',
    NEW.raw_user_meta_data->>'current_grade',
    COALESCE(NEW.raw_user_meta_data->>'target_field', NEW.raw_user_meta_data->>'field_of_study'),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'target_departments')), '{}'),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'target_universities')), '{}'),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'mentorship_expectations')), '{}'),
    NEW.raw_user_meta_data->>'education_status',
    COALESCE((NEW.raw_user_meta_data->>'is_working')::BOOLEAN, FALSE),
    NEW.raw_user_meta_data->>'company_name',
    NEW.raw_user_meta_data->>'company_logo',
    NEW.raw_user_meta_data->>'work_title',
    NEW.raw_user_meta_data->>'linkedin_url',
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'mentorship_capacity', '')::INTEGER, 5),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'mentorship_topics')), '{}'),
    COALESCE(NEW.raw_user_meta_data->>'mentorship_availability', 'active'),
    COALESCE((NEW.raw_user_meta_data->>'is_verified')::BOOLEAN, FALSE),
    COALESCE((NEW.raw_user_meta_data->>'is_profile_complete')::BOOLEAN, FALSE)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION accept_mentorship_request(request_id UUID)
RETURNS UUID AS $$
DECLARE
  target_request mentorship_requests%ROWTYPE;
  active_count INTEGER;
  conversation_id UUID;
BEGIN
  SELECT *
  INTO target_request
  FROM mentorship_requests
  WHERE id = request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mentorship request not found';
  END IF;

  IF target_request.mentor_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the mentor can accept this request';
  END IF;

  IF target_request.status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending requests can be accepted';
  END IF;

  SELECT COUNT(*)
  INTO active_count
  FROM mentorship_requests
  WHERE mentor_id = target_request.mentor_id
    AND status = 'accepted';

  IF active_count >= 5 THEN
    RAISE EXCEPTION 'Mentor active student capacity is full';
  END IF;

  UPDATE mentorship_requests
  SET status = 'accepted',
      responded_at = NOW()
  WHERE id = request_id;

  INSERT INTO mentorship_conversations (request_id, student_id, mentor_id)
  VALUES (target_request.id, target_request.student_id, target_request.mentor_id)
  ON CONFLICT (request_id) DO UPDATE
    SET last_message_at = mentorship_conversations.last_message_at
  RETURNING id INTO conversation_id;

  RETURN conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION touch_mentorship_conversation()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE mentorship_conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_mentorship_message_created
  AFTER INSERT ON mentorship_messages
  FOR EACH ROW EXECUTE FUNCTION touch_mentorship_conversation();

ALTER TABLE mentorship_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentorship_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentorship_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentorship_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view their mentorship requests"
  ON mentorship_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = student_id OR auth.uid() = mentor_id);

CREATE POLICY "Students can create mentorship requests"
  ON mentorship_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = student_id
    AND EXISTS (SELECT 1 FROM profiles WHERE id = student_id AND role = 'student')
    AND EXISTS (SELECT 1 FROM profiles WHERE id = mentor_id AND role = 'alumni')
  );

CREATE POLICY "Students can cancel own pending requests"
  ON mentorship_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = student_id AND status = 'pending')
  WITH CHECK (auth.uid() = student_id AND status = 'cancelled');

CREATE POLICY "Mentors can respond to pending requests"
  ON mentorship_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = mentor_id AND status = 'pending')
  WITH CHECK (auth.uid() = mentor_id AND status IN ('rejected', 'cancelled'));

CREATE POLICY "Participants can complete accepted mentorships"
  ON mentorship_requests FOR UPDATE
  TO authenticated
  USING ((auth.uid() = student_id OR auth.uid() = mentor_id) AND status = 'accepted')
  WITH CHECK ((auth.uid() = student_id OR auth.uid() = mentor_id) AND status = 'completed');

CREATE POLICY "Participants can view mentorship conversations"
  ON mentorship_conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = student_id OR auth.uid() = mentor_id);

CREATE POLICY "Participants can read mentorship messages"
  ON mentorship_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM mentorship_conversations
      WHERE mentorship_conversations.id = mentorship_messages.conversation_id
        AND (mentorship_conversations.student_id = auth.uid() OR mentorship_conversations.mentor_id = auth.uid())
    )
  );

CREATE POLICY "Participants can send mentorship messages"
  ON mentorship_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1
      FROM mentorship_conversations
      JOIN mentorship_requests ON mentorship_requests.id = mentorship_conversations.request_id
      WHERE mentorship_conversations.id = conversation_id
        AND mentorship_requests.status = 'accepted'
        AND (mentorship_conversations.student_id = auth.uid() OR mentorship_conversations.mentor_id = auth.uid())
    )
  );

CREATE POLICY "Participants can mark mentorship messages read"
  ON mentorship_messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM mentorship_conversations
      WHERE mentorship_conversations.id = mentorship_messages.conversation_id
        AND (mentorship_conversations.student_id = auth.uid() OR mentorship_conversations.mentor_id = auth.uid())
    )
  );

CREATE POLICY "Students can create private mentorship reviews"
  ON mentorship_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = student_id
    AND EXISTS (
      SELECT 1 FROM mentorship_requests
      WHERE mentorship_requests.id = request_id
        AND mentorship_requests.student_id = auth.uid()
        AND mentorship_requests.mentor_id = mentorship_reviews.mentor_id
        AND mentorship_requests.status IN ('accepted', 'completed')
    )
  );

CREATE POLICY "Admins can view mentorship reviews"
  ON mentorship_reviews FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Students can view own mentorship reviews"
  ON mentorship_reviews FOR SELECT
  TO authenticated
  USING (auth.uid() = student_id);

ALTER PUBLICATION supabase_realtime ADD TABLE mentorship_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE mentorship_conversations;
