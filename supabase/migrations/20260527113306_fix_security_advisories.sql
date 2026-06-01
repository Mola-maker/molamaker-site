-- Fix Supabase security advisories: set explicit search_path on all public functions.
ALTER FUNCTION public.check_rate(bucket_key text, max_count integer, window_ms integer)
  SET search_path = 'public';

ALTER FUNCTION public.increment_view(post_slug text)
  SET search_path = 'public';

ALTER FUNCTION public.is_site_owner()
  SET search_path = 'public';
