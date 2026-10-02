-- ============================================
-- Migration 014: Ensure Mentorship Availability Column
-- ============================================
-- Some environments were missing the column even though later app code uses it.
-- This migration is intentionally idempotent and asks PostgREST to reload its
-- schema cache after the change.

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS mentorship_availability TEXT NOT NULL DEFAULT 'active';

ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_mentorship_availability_check;

ALTER TABLE profiles
ADD CONSTRAINT profiles_mentorship_availability_check
CHECK (mentorship_availability IN ('active', 'unavailable'));

UPDATE profiles
SET mentorship_availability = 'active'
WHERE mentorship_availability IS NULL
   OR mentorship_availability NOT IN ('active', 'unavailable');

NOTIFY pgrst, 'reload schema';
