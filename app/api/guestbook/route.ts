import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRate, RATE_GUESTBOOK } from '@/lib/rate-limit';
import { clientIp } from '@/lib/client-ip';
import { fmtRelative } from '@/lib/date';
import { guestbookSchema } from '@/lib/validation';
import { validateOrigin } from '@/lib/origin';

// GET /api/guestbook → { data: Guest[] }
export async function GET() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ data: [] });

  const { data, error } = await supabase
    .from('guestbook')
    .select('name, message, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json(
      { error: { code: 'db_error', message: 'Failed to fetch entries' } },
      { status: 502 },
    );
  }

  return NextResponse.json({
    data: (data ?? []).map((e) => ({
      name: e.name,
      message: e.message,
      t: fmtRelative(e.created_at),
    })),
  });
}

// POST /api/guestbook  body: { name, message } → 201 { data: { name, message, created_at } }
export async function POST(req: NextRequest) {
  const origin = validateOrigin(req);
  if (origin) return origin;

  const body = await req.json().catch(() => ({}));
  const parsed = guestbookSchema.safeParse({ name: body.name, message: body.message });
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'validation_error', message: parsed.error.issues[0]?.message ?? 'Invalid input' } },
      { status: 400 },
    );
  }
  const { name, message } = parsed.data;

  const ip = await clientIp();
  const rate = await checkRate(`gb:${ip}`, RATE_GUESTBOOK.limit, RATE_GUESTBOOK.windowMs);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: { code: 'rate_limited', message: 'Too many entries — slow down.' } },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rate.resetMs / 1000)) } },
    );
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json(
      { error: { code: 'service_unavailable', message: 'Database unavailable' } },
      { status: 503 },
    );
  }

  const { data, error } = await supabase
    .from('guestbook')
    .insert({ name, message })
    .select('name, message, created_at')
    .single();

  if (error) {
    return NextResponse.json(
      { error: { code: 'db_error', message: 'Could not sign guestbook' } },
      { status: 500 },
    );
  }

  return NextResponse.json({ data }, { status: 201 });
}

