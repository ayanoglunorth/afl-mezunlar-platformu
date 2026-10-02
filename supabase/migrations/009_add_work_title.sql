-- Add the missing work_title column
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS work_title text;
