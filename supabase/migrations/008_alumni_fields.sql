-- Add new fields for alumni profile matching and details
ALTER TABLE profiles
ADD COLUMN education_status text,
ADD COLUMN is_working boolean DEFAULT false,
ADD COLUMN company_name text,
ADD COLUMN company_logo text,
ADD COLUMN linkedin_url text,
ADD COLUMN mentorship_capacity integer DEFAULT 1,
ADD COLUMN mentorship_topics text[];
