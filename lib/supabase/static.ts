import { createClient } from '@supabase/supabase-js';

/** Vanilla client for build-time data fetching (no cookies needed). */
export function createStaticClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
