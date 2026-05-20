/**
 * Validated Supabase environment variables.
 *
 * When missing at build time (CI, cold builds without env vars), exports
 * `null` so consumers degrade gracefully. At runtime with env vars set
 * (Vercel, local .env.local), these are always strings.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || null;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || null;
