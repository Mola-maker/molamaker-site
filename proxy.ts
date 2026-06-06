import { type NextRequest, type NextFetchEvent } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

export default async function proxy(request: NextRequest, event: NextFetchEvent) {
  const path = request.nextUrl.pathname;

  // Analytics ping (fire-and-forget)
  if (
    !path.startsWith('/_next') &&
    !path.startsWith('/api') &&
    !path.includes('.')
  ) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const ping = fetch(new URL('/api/views', request.url), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path }),
      signal: controller.signal,
    }).catch((err: unknown) => {
      const name = err instanceof Error ? err.name : '';
      if (process.env.NODE_ENV !== 'production' && name !== 'AbortError') {
        console.error('analytics ping failed:', err);
      }
    }).finally(() => clearTimeout(timeout));
    event.waitUntil(ping);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|auth|_next|_vercel|.*\\..*).*)'],
};
