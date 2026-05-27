import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { pageViewSchema } from '@/lib/validation';
import { checkRate, RATE_VIEWS } from '@/lib/rate-limit';
import { insertPageView } from '@/lib/data/page-views';
import { clientIp } from '@/lib/client-ip';
import { logError } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * POST /api/views — record a page view.
 *
 * Request body: JSON with a 'path' field (string, 1-500 chars,
 * must start with '/' and not contain '..').
 *
 * Responses:
 * - 200 { ok: true } — view recorded
 * - 400 { ok: false } — invalid request body
 * - 429 { ok: false } with Retry-After header — rate limited
 * - 500 { ok: false } — internal error
 *
 * Rate limit: per-IP token bucket (see RATE_VIEWS).
 * Called by middleware as a fire-and-forget fetch; no auth required.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = pageViewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const ip = await clientIp();
    const rate = await checkRate(`pv:${ip}`, RATE_VIEWS.limit, RATE_VIEWS.windowMs);
    if (!rate.allowed) {
      return NextResponse.json({ ok: false }, {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rate.resetMs / 1000)) },
      });
    }

    // Hash the IP so we never store PII; truncate to 16 hex chars for brevity
    const visitorId = createHash('sha256').update(ip).digest('hex').slice(0, 16);

    await Promise.all([
      insertPageView(parsed.data.path),
      createServiceClient()
        .from('visitors')
        .insert({ visitor_id: visitorId, path: parsed.data.path })
        .then(({ error }) => { if (error) logError('views', 'Failed to record visitor', error); }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    logError('views', 'Failed to record page view', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
