-- The message email flow now uses notification_jobs plus DB triggers.
-- This legacy scheduled-email table has no application references left.
DROP TABLE IF EXISTS public.message_email_notifications CASCADE;
