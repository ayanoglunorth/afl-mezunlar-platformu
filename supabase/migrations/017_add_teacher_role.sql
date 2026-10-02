-- Adds a non-student, non-alumni staff role. Protects role integrity by
-- allowing teacher assignment only through trusted admin/database operations;
-- public signup remains constrained by handle_new_user to student/alumni.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'teacher';
