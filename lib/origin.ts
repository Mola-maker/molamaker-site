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

  // Allow configured site URL (compare host exactly — a prefix match would let
  // "https://molamaker.com.evil.com" pass).
  try {
    if (new URL(origin).host === new URL(SITE_CONFIG.siteUrl).host) return null;
  } catch { /* malformed site URL */ }

  // Allow localhost in development
  if (process.env.NODE_ENV === 'development') {
    try {
      if (new URL(origin).hostname === 'localhost') return null;
    } catch { /* malformed origin URL */ }
  }

  return NextResponse.json(
    { error: { code: 'csrf', message: 'Invalid origin' } },
    { status: 403 },
  );
}
