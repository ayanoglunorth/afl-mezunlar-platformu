-- ============================================
-- Migration 003: Matching System
-- ============================================

CREATE TYPE match_status AS ENUM ('pending', 'accepted', 'rejected', 'expired');

-- Matches between users
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status match_status DEFAULT 'pending',
  match_score REAL DEFAULT 0.0,
  match_reasons TEXT[] DEFAULT '{}',
  requested_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  UNIQUE(user_a, user_b),
  CHECK (user_a <> user_b)
);

CREATE INDEX idx_matches_user_a ON matches(user_a);
CREATE INDEX idx_matches_user_b ON matches(user_b);
CREATE INDEX idx_matches_status ON matches(status);

-- System-generated match suggestions
CREATE TABLE match_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  for_user UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  suggested_user UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  score REAL DEFAULT 0.0,
  reasons TEXT[] DEFAULT '{}',
  is_dismissed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(for_user, suggested_user)
);

CREATE INDEX idx_match_suggestions_for_user ON match_suggestions(for_user);
