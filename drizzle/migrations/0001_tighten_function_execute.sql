REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_profile_email() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.merge_webos_prefs(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_webos_prefs(jsonb) TO authenticated;
-- Intentionally public: the sign-up form checks usernames and the home page counts visits.
GRANT EXECUTE ON FUNCTION public.is_username_available(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_visit() TO anon, authenticated;