import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/workplace/session';

export const runtime = 'nodejs';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  return clearSessionCookie(res);
}
