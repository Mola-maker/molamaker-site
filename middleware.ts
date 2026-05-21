import { type NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

export default async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Analytics ping (fire-and-forget)
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
      if (process.env.NODE_ENV !== 'production') {
        console.error('analytics ping failed:', err);
      }
    }).finally(() => clearTimeout(timeout));
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
