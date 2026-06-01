-- Revoke public/anon/authenticated execute on SECURITY DEFINER RPC functions.
-- is_site_owner is SECURITY INVOKER and safe for public execute; excluded.
REVOKE EXECUTE ON FUNCTION public.check_rate(bucket_key text, max_count integer, window_ms integer)
  FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.increment_view(post_slug text)
  FROM PUBLIC;
