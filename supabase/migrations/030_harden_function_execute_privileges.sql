-- Harden exposed function privileges and search paths.
-- NIST: Bu migration RPC yüzeyini daraltmak için var. Saldırı senaryosu:
-- anon/authenticated rollerinin trigger veya service-only SECURITY DEFINER
-- fonksiyonlarını doğrudan /rest/v1/rpc üzerinden çağırarak iş akışını,
-- bildirim kuyruğunu veya sayaçları manipüle etmesi.

-- Functions without an explicit search_path can be influenced through mutable
-- role search paths. Set deterministic paths for legacy helpers/triggers.
ALTER FUNCTION public.update_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.normalize_turkish_name(TEXT) SET search_path = public, pg_temp;
ALTER FUNCTION public.set_normalized_name() SET search_path = public, pg_temp;
ALTER FUNCTION public.create_chat_room_on_accept() SET search_path = public, pg_temp;
ALTER FUNCTION public.expire_chat_rooms() SET search_path = public, pg_temp;
ALTER FUNCTION public.touch_mentorship_conversation() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_comment_upvote_count() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_thread_comment_count() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_thread_upvote_count() SET search_path = public, pg_temp;
ALTER FUNCTION public.verify_alumni_by_name(TEXT, INTEGER) SET search_path = public, pg_temp;
ALTER FUNCTION public.verify_alumni_by_student_number(TEXT, TEXT) SET search_path = public, pg_temp;

-- Start closed: PostgreSQL grants EXECUTE on new functions to PUBLIC by
-- default. The grants below reopen only the application RPCs intentionally
-- needed by browser users or trusted server jobs.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;

-- Browser-callable RPCs. Each function enforces auth.uid() ownership/admin
-- logic internally, so authenticated access is required but not sufficient.
GRANT EXECUTE ON FUNCTION public.accept_mentorship_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_admins(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_social_messages_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_mentorship_messages_read(UUID) TO authenticated;

-- Server-only RPCs and operational helpers. The service role key must only live
-- in trusted server/deploy secrets, never in browser bundles.
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_due_notification_jobs(INTEGER) TO service_role;

NOTIFY pgrst, 'reload schema';
