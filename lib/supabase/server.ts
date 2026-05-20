import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './env';

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Create a Supabase client for the **Next.js Server**.
 *
 * Usage context:
 * - Server Components (RSC) — e.g. data fetching in page.tsx
 * - Server Actions — e.g. form mutations in app/actions.ts
 * - Route Handlers — e.g. app/api/*\/route.ts
 *
 * Uses next/headers cookies for auth. The setAll callback may throw
 * when called from a Server Component (reading-only context); this is
 * expected and silently caught.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
 * environment variables.
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options));
          } catch {
            /* called from a Server Component — safe to ignore */
          }
        }
      }
    }
  );
}
