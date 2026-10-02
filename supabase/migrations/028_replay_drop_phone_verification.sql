-- Replay the phone verification table removal with a fresh migration number.
-- The repository previously reused migration version 026 for unrelated work;
-- Supabase tracks only the version prefix, so 026_drop_phone_verification.sql
-- may be skipped on databases where another 026 was already recorded.
drop table if exists public.private_user_contacts cascade;

notify pgrst, 'reload schema';
