import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { clientIp } from '@/lib/client-ip';
import { createHmac } from 'crypto';
import { validateOrigin } from '@/lib/origin';
import { checkRate } from '@/lib/rate-limit';

// POST /api/posts/react  body: { slug, kind }
// Returns { data: { counts: Record<kind, number>, voted: boolean } }
export async function POST(req: NextRequest) {
  const origin = validateOrigin(req);
  if (origin) return origin;

  const body = await req.json().catch(() => ({}));
  const slug = (body.slug ?? '').trim().slice(0, 200);
  const kind = body.kind;

  if (!slug || !['heart', 'brain', 'fire'].includes(kind)) {
    return NextResponse.json(
      { error: { code: 'validation_error', message: 'slug and kind (heart|brain|fire) required' } },
      { status: 400 },
    );
  }

  const ip = await clientIp();

  const rate = await checkRate(`react:${ip}`, 30, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: { code: 'rate_limited', message: 'Too many reactions — slow down.' } },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rate.resetMs / 1000)) } },
    );
  }

  const ua = req.headers.get('user-agent') ?? '';
  const secret = process.env.HMAC_IP_SECRET || 'molamaker-voter';
  const voterKey = createHmac('sha256', secret).update(`${ip}:${ua.slice(0, 120)}`).digest('hex').slice(0, 32);

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json(
      { error: { code: 'service_unavailable', message: 'Database unavailable' } },
      { status: 503 },
    );
  }

  // Upsert reaction (ignore duplicate = toggle off not supported to keep it simple)
  const { error: insertError } = await supabase
    .from('reactions')
    .upsert({ slug, kind, voter_key: voterKey }, { onConflict: 'slug,kind,voter_key', ignoreDuplicates: true });

  if (insertError && insertError.code !== '23505') {
    return NextResponse.json(
      { error: { code: 'db_error', message: 'Could not save reaction' } },
      { status: 500 },
    );
  }

  // Get updated counts
  const { data: counts } = await supabase
    .from('reaction_counts')
    .select('kind, total')
    .eq('slug', slug);

  const totals: Record<string, number> = { heart: 0, brain: 0, fire: 0 };
  for (const row of counts ?? []) {
    totals[row.kind] = Number(row.total);
  }

  return NextResponse.json({ data: { counts: totals, voted: kind } });
}

// GET /api/posts/react?slug=...
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug') ?? '';
  if (!slug) {
    return NextResponse.json({ data: { counts: { heart: 0, brain: 0, fire: 0 } } });
  }

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ data: { counts: { heart: 0, brain: 0, fire: 0 } } });

  const { data } = await supabase
    .from('reaction_counts')
    .select('kind, total')
    .eq('slug', slug);

  const totals: Record<string, number> = { heart: 0, brain: 0, fire: 0 };
  for (const row of data ?? []) {
    totals[row.kind] = Number(row.total);
  }

  return NextResponse.json({ data: { counts: totals } });
}
