/**
 * Validate that required Supabase environment variables are set at import time.
 *
 * This runs once when the module is first loaded, throwing an early
 * startup error instead of a cryptic "undefined" later in production.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY'
  );
}

export const SUPABASE_URL = url;
export const SUPABASE_ANON_KEY = key;
