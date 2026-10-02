-- Add new fields for student registration matching
ALTER TABLE profiles
ADD COLUMN current_grade text,
ADD COLUMN target_field text,
ADD COLUMN target_departments text[],
ADD COLUMN target_universities text[],
ADD COLUMN mentorship_expectations text[];

-- Update the RLS policies if necessary (they should inherit from existing profiles policies, so no new policies are strictly required just for columns).
