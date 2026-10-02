REVOKE ALL ON FUNCTION public.get_current_profile_edit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_profile_edit() TO authenticated;

REVOKE ALL ON FUNCTION public.get_settings_profile() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_settings_profile() TO authenticated;

NOTIFY pgrst, 'reload schema';
