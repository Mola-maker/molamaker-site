import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function POST(request: NextRequest) {
  const secret = process.env.BMAC_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'not configured' }, { status: 500 });
  }

  const signature = request.headers.get('bmac-signature');
  const body = await request.text();

  if (!signature) {
    return NextResponse.json({ error: 'missing signature' }, { status: 401 });
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );

  const sigBytes = new Uint8Array(signature.length / 2);
  for (let i = 0; i < signature.length; i += 2) {
    sigBytes[i / 2] = parseInt(signature.substring(i, i + 2), 16);
  }

  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    sigBytes,
    encoder.encode(body),
  );

  if (!valid) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  let payload: { supporter_email?: string; type?: string };
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const email = payload.supporter_email;
  if (!email) {
    return NextResponse.json({ error: 'missing email' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: users, error: userError } = await supabase
    .schema('auth')
    .from('users')
    .select('id')
    .eq('email', email)
    .limit(1);

  if (userError || !users?.length) {
    return NextResponse.json({ ok: true, note: 'user not registered yet' });
  }

  const { error: upsertError } = await supabase
    .from('supporters')
    .upsert({
      user_id: users[0].id,
      bmc_email: email,
      tier: 'coffee',
      verified_at: new Date().toISOString(),
    });

  if (upsertError) {
    return NextResponse.json({ error: 'db write failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
