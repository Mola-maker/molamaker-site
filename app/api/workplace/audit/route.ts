import { NextResponse } from 'next/server';
import { getWPSession } from '@/lib/workplace/session';
import { listAudit } from '@/lib/workplace/db';

export const runtime = 'nodejs';

export async function GET() {
  const session = await getWPSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'admin' && session.role !== 'owner') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const rows = await listAudit(100);
  const events = rows.map((r) => ({
    id: r.id, action: r.action, userName: r.user_name,
    ip: r.ip, detail: r.detail ?? {}, createdAt: r.created_at,
  }));
  return NextResponse.json({ data: { events } });
}
