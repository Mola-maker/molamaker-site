import { NextResponse } from 'next/server';
import { clearSessionCookie, getWPSession } from '@/lib/workplace/session';
import { writeAudit } from '@/lib/workplace/db';

export const runtime = 'nodejs';

export async function POST() {
  const session = await getWPSession();
  if (session) {
    await writeAudit({ action: 'logout', userId: session.userId, userName: session.name, ip: session.ip });
  }
  const res = NextResponse.json({ ok: true });
  return clearSessionCookie(res);
}
