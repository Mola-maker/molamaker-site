import { NextResponse } from 'next/server';
import { getWPSession } from '@/lib/workplace/session';
import { listUsers } from '@/lib/workplace/db';

export const runtime = 'nodejs';

export async function GET() {
  const session = await getWPSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'admin' && session.role !== 'owner') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const users = await listUsers();
  // Mask phone middle digits for display
  const masked = users.map((u) => ({
    id: u.id, name: u.name,
    phone: u.phone ? u.phone.replace(/(\d{3})\d+(\d{2})/, '$1****$2') : null,
    email: u.email, role: u.role, authMethod: u.auth_method,
    lastIp: u.last_ip, lastSeenAt: u.last_seen_at, createdAt: u.created_at,
  }));
  return NextResponse.json({ data: { users: masked } });
}
