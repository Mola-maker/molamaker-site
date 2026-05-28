import { NextRequest, NextResponse } from 'next/server';
import { generateOTP, verifyOTP } from '@/lib/workplace/otp';
import { createSessionToken, setSessionCookie } from '@/lib/workplace/session';
import { getOrCreateUser, writeAudit } from '@/lib/workplace/db';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = await req.json() as { action?: string; phone?: string; code?: string; name?: string };
  const { action, phone } = body;

  if (!phone || typeof phone !== 'string') {
    return NextResponse.json({ error: 'phone required' }, { status: 400 });
  }

  if (action === 'send') {
    const code = await generateOTP(phone);
    // In production: send SMS via Twilio/Aliyun etc. using PHONE_SMS_KEY env
    // For dev/demo: return code in response so it can be tested
    const isDev = process.env.NODE_ENV !== 'production';
    return NextResponse.json({ ok: true, ...(isDev && { debug_code: code }) });
  }

  if (action === 'verify') {
    const { code, name } = body;
    if (!code || !name) return NextResponse.json({ error: 'code and name required' }, { status: 400 });
    const ok = await verifyOTP(phone, code);
    if (!ok) return NextResponse.json({ error: 'invalid or expired code' }, { status: 401 });

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? 'unknown';

    const { id: userId, role } = await getOrCreateUser({ name, phone, ip, authMethod: 'phone' });
    const token = createSessionToken({ userId, name, phone, ip, role });
    await writeAudit({ action: 'login', userId, userName: name, ip });

    const res = NextResponse.json({ ok: true });
    return setSessionCookie(res, token);
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}
