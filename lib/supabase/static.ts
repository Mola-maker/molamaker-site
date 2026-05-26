import { createClient } from '@supabase/supabase-js';

/**
 * Vanilla client for build-time data fetching (no cookies needed).
 * Returns `null` when Supabase env vars are not configured, so build-time
 * features (sitemap, generateStaticParams) can degrade gracefully.
 */
export function createStaticClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[supabase/static] Supabase env vars missing — features like sitemap and RSS will be empty.');
    }
    return null;
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
