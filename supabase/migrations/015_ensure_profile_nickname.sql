-- ============================================
-- Migration 015: Ensure Profile Nickname Column
-- ============================================
-- Idempotent safety migration for environments where nickname was introduced
-- in code before the database migration/schema cache was applied.

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS nickname TEXT;

UPDATE profiles
SET nickname = LOWER(TRIM(nickname))
WHERE nickname IS NOT NULL;

UPDATE profiles
SET nickname = NULL
WHERE nickname IS NOT NULL
  AND nickname !~ '^[a-z0-9][a-z0-9._]{1,30}[a-z0-9]$';

ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_nickname_format;

ALTER TABLE profiles
ADD CONSTRAINT profiles_nickname_format
CHECK (
  nickname IS NULL
  OR nickname ~ '^[a-z0-9][a-z0-9._]{1,30}[a-z0-9]$'
);

DROP INDEX IF EXISTS idx_profiles_nickname_unique;

CREATE UNIQUE INDEX idx_profiles_nickname_unique
  ON profiles (LOWER(nickname))
  WHERE nickname IS NOT NULL;

NOTIFY pgrst, 'reload schema';
