import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, setSessionCookie, generateUserId } from '@/lib/workplace/session';
import { writeAudit } from '@/lib/workplace/db';
import { checkRate } from '@/lib/rate-limit';
import { clientIp } from '@/lib/client-ip';
import { getPublicAccess, verifyVisitorPassword } from '@/lib/workplace/settings';

export const runtime = 'nodejs';

// POST /api/workplace/auth/visitor — visitor entry → viewer session.
// When visitor mode is OFF the workplace is open: a viewer session is issued
// with no password. When ON, the visitor password must match.
export async function POST(req: NextRequest) {
  const ip = await clientIp();

  const rate = await checkRate(`wp-visitor:${ip}`, 10, 60_000);
  if (!rate.allowed) {
    return NextResponse.json({ error: 'too many attempts, try again shortly' }, {
      status: 429, headers: { 'Retry-After': String(Math.ceil(rate.resetMs / 1000)) },
    });
  }

  const access = await getPublicAccess();
  const body = await req.json().catch(() => ({})) as { password?: string; name?: string };
  const name = String(body.name ?? '').trim().slice(0, 60) || 'Visitor';

  if (access.visitorMode) {
    const pw = String(body.password ?? '').trim();
    if (!pw) return NextResponse.json({ error: 'visitor password required' }, { status: 400 });
    if (!(await verifyVisitorPassword(pw))) {
      await writeAudit({ action: 'login', userName: name, ip, detail: { method: 'visitor', ok: false } });
      return NextResponse.json({ error: 'invalid visitor password' }, { status: 401 });
    }
  }

  // Open mode, or a correct visitor password → ephemeral viewer session.
  const userId = `wp-visitor-${generateUserId()}`;
  const token = createSessionToken({ userId, name, ip, role: 'viewer' });
  await writeAudit({
    action: 'login', userId, userName: name, ip,
    detail: { method: 'visitor', ok: true, open: !access.visitorMode },
  });

  const res = NextResponse.json({ ok: true });
  return setSessionCookie(res, token, req);
}
