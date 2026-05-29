import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createSessionToken, setSessionCookie } from '@/lib/workplace/session';
import { upsertUser, writeAudit } from '@/lib/workplace/db';
import { checkRate } from '@/lib/rate-limit';
import { clientIp } from '@/lib/client-ip';

export const runtime = 'nodejs';

// Stable identity for the admin-key owner so audit/role records persist.
const ADMIN_KEY_USER_ID = 'wp-admin-key';

// Constant-time string comparison that doesn't leak length via early return.
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) {
    // Still run a comparison to keep timing uniform, then fail.
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

// POST /api/workplace/auth/key — owner sign-in via shared admin key.
// Body: { key: string, name?: string }
export async function POST(req: NextRequest) {
  const ip = await clientIp();

  // Throttle attempts per IP to resist brute force (5 / minute).
  const rate = await checkRate(`wp-admin-key:${ip}`, 5, 60_000);
  if (!rate.allowed) {
    return NextResponse.json({ error: 'too many attempts, try again shortly' }, {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil(rate.resetMs / 1000)) },
    });
  }

  const expected = process.env.WORKPLACE_ADMIN_KEY?.trim();
  if (!expected) {
    // Feature disabled when no key is configured — fail closed.
    return NextResponse.json({ error: 'admin key sign-in is not enabled' }, { status: 503 });
  }

  const body = await req.json().catch(() => ({})) as { key?: string; name?: string };
  const key = String(body.key ?? '').trim();
  const name = String(body.name ?? '').trim().slice(0, 60) || 'Owner';
  if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 });

  if (!safeEqual(key, expected)) {
    await writeAudit({ action: 'login', userName: name, ip, detail: { method: 'admin_key', ok: false } });
    return NextResponse.json({ error: 'invalid key' }, { status: 401 });
  }

  // Persist a stable owner record and issue an owner session.
  await upsertUser({ id: ADMIN_KEY_USER_ID, name, ip, role: 'owner', authMethod: 'admin_key' });
  const token = createSessionToken({ userId: ADMIN_KEY_USER_ID, name, ip, role: 'owner' });
  await writeAudit({ action: 'login', userId: ADMIN_KEY_USER_ID, userName: name, ip, detail: { method: 'admin_key', ok: true } });

  const res = NextResponse.json({ ok: true });
  return setSessionCookie(res, token);
}
