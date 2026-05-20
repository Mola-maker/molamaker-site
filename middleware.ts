import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

/**
 * Next.js Edge Middleware — runs on every matched route.
 *
 * Path filtering: skips /_next/*, /api/*, and files containing '.'
 * to avoid recording analytics for static assets and internal routes.
 *
 * Analytics pipeline: fire-and-forget POST /api/views with the
 * current pathname. Failure is silently ignored (no retry, no logging).
 *
 * Session refresh: delegates to updateSession which reads
 * Supabase auth cookies and refreshes the session if needed.
 *
 * Matcher config (exported 'config'): runs on all routes except
 * _next/static, _next/image, and favicon.ico.
 */
export async function middleware(request: NextRequest) {
  // analytics ping (fire-and-forget)
  const path = request.nextUrl.pathname;
  if (
    !path.startsWith('/_next') &&
    !path.startsWith('/api') &&
    !path.includes('.')
  ) {
    fetch(new URL('/api/views', request.url), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path })
    }).catch(() => {});
  }
  return updateSession(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};
