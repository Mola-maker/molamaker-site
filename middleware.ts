import { type NextRequest } from 'next/server';

/**
 * Next.js Edge Middleware — runs on every matched route.
 *
 * Analytics pipeline: fire-and-forget POST /api/views with a 3s timeout.
 * Paths starting with /_next, /api or containing '.' are excluded.
 * Failure is logged but never blocks the response.
 *
 * updateSession was removed — the site has no authenticated routes,
 * so refreshing Supabase auth cookies on every request was unnecessary.
 */
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (
    !path.startsWith('/_next') &&
    !path.startsWith('/api') &&
    !path.includes('.')
  ) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    fetch(new URL('/api/views', request.url), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path }),
      signal: controller.signal,
    }).catch((err) => {
      console.error('analytics ping failed:', err);
    }).finally(() => clearTimeout(timeout));
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};
