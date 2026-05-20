import { createClient } from '@supabase/supabase-js';

/**
 * Vanilla client for build-time data fetching (no cookies needed).
 * Returns `null` when Supabase env vars are not configured, so build-time
 * features (sitemap, generateStaticParams) can degrade gracefully.
 */
export function createStaticClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
