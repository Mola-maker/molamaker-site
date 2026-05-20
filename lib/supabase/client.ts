import { createBrowserClient } from '@supabase/ssr';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './env';

/**
 * Create a Supabase client for the **Browser**.
 *
 * Usage context:
 * - Client Components ("use client")
 * - Browser-only code (event handlers, effects)
 *
 * Uses the @supabase/ssr browser client which handles cookie-based
 * auth automatically via the browser's native document.cookie.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
 * environment variables.
 */
export function createClient() {
  return createBrowserClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );
}
