import { NextRequest, NextResponse } from 'next/server';
import { SITE_CONFIG } from '@/lib/constants';

export function validateOrigin(req: NextRequest): NextResponse | null {
  const origin = req.headers.get('origin');
  if (!origin) {
    return NextResponse.json(
      { error: { code: 'csrf', message: 'Origin header required' } },
      { status: 403 },
    );
  }

  // Allow same-origin requests (Host header matches Origin host)
  const host = req.headers.get('host') || '';
  try {
    if (new URL(origin).host === host) return null;
  } catch { /* malformed origin URL */ }

  // Allow configured site URL
  if (origin.startsWith(SITE_CONFIG.siteUrl)) return null;

  // Allow localhost in development
  if (process.env.NODE_ENV === 'development' && origin.startsWith('http://localhost')) return null;

  return NextResponse.json(
    { error: { code: 'csrf', message: 'Invalid origin' } },
    { status: 403 },
  );
}
