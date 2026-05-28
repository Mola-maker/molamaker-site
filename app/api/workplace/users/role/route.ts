import { NextRequest, NextResponse } from 'next/server';
import { getWPSession } from '@/lib/workplace/session';
import { setUserRole, writeAudit, type WPRole } from '@/lib/workplace/db';

export const runtime = 'nodejs';

const VALID: WPRole[] = ['owner', 'admin', 'contributor', 'viewer'];

export async function POST(req: NextRequest) {
  const session = await getWPSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'owner') {
    return NextResponse.json({ error: 'forbidden — owner only' }, { status: 403 });
  }
  const body = await req.json() as { userId?: string; role?: string };
  if (!body.userId || !body.role || !VALID.includes(body.role as WPRole)) {
    return NextResponse.json({ error: 'userId and valid role required' }, { status: 400 });
  }
  const ok = await setUserRole(body.userId, body.role as WPRole);
  if (!ok) return NextResponse.json({ error: 'update failed (no DB?)' }, { status: 500 });
  await writeAudit({ action: 'role_change', userId: session.userId, userName: session.name, ip: session.ip, detail: { changedUser: body.userId, newRole: body.role } });
  return NextResponse.json({ ok: true });
}
