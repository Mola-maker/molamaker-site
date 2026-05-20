import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

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
