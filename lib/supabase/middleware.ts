import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './env';

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Refresh the Supabase session in **Next.js Middleware**.
 *
 * Usage context: Middleware only (middleware.ts).
 * Do not use in Server Components, Route Handlers, or the Browser.
 *
 * Exchanges auth cookies between the incoming NextRequest and the
 * outgoing NextResponse. Calls supabase.auth.getUser() to
 * trigger a session refresh when the JWT is close to expiry.
 *
 * Always returns a response — the caller should return it as-is.
 *
 * @param request — the incoming Next.js request from middleware
 * @returns a NextResponse with refreshed auth cookies set
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    SUPABASE_URL!,
    SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options));
        }
      }
    }
  );

  await supabase.auth.getUser();
  return response;
}