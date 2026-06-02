import { NextRequest, NextResponse } from 'next/server';
import { generateOTP, verifyOTP } from '@/lib/workplace/otp';
import { createSessionToken, setSessionCookie } from '@/lib/workplace/session';
import { getOrCreateUser, writeAudit } from '@/lib/workplace/db';
import { sendOtpSms, isSmsConfigured } from '@/lib/workplace/sms';
import { checkRate } from '@/lib/rate-limit';
import { clientIp } from '@/lib/client-ip';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = await req.json() as { action?: string; phone?: string; code?: string; name?: string };
  const { action } = body;

  // Normalize: the UI shows a "+86" prefix and the user may type spaces
  // ("138 0000 0000"). Strip whitespace so the OTP key, SMS recipient, and
  // stored identity all share one canonical form.
  const phone = (body.phone ?? '').replace(/\s+/g, '');
  if (!phone) {
    return NextResponse.json({ error: 'phone required' }, { status: 400 });
  }

  if (action === 'send') {
    const isDev = process.env.NODE_ENV !== 'production';

    // Throttle only when SMS is live — real sends cost money, so guard against
    // bombing. When unconfigured the code is returned in the response (dev),
    // which has no cost and no abuse vector, so skip the limiter there.
    if (isSmsConfigured()) {
      const ip = await clientIp();
      const perPhone = await checkRate(`wp-otp:${phone}`, 1, 60_000);
      if (!perPhone.allowed) {
        return NextResponse.json({ error: 'a code was just sent — wait a moment' }, {
          status: 429, headers: { 'Retry-After': String(Math.ceil(perPhone.resetMs / 1000)) },
        });
      }
      const perIp = await checkRate(`wp-otp-ip:${ip}`, 10, 3_600_000);
      if (!perIp.allowed) {
        return NextResponse.json({ error: 'too many requests, try again later' }, {
          status: 429, headers: { 'Retry-After': String(Math.ceil(perIp.resetMs / 1000)) },
        });
      }
    }

    const code = await generateOTP(phone);

    if (!isSmsConfigured()) {
      // No provider wired: surface the code in dev so login is still testable.
      if (isDev) return NextResponse.json({ ok: true, debug_code: code });
      return NextResponse.json({ error: 'SMS service is not configured' }, { status: 503 });
    }

    const result = await sendOtpSms(phone, code);
    if (result.sent) return NextResponse.json({ ok: true });
    return NextResponse.json({ error: 'failed to send code, try again' }, { status: 502 });
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
