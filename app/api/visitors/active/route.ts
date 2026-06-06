import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRate } from '@/lib/rate-limit';
import { clientIp } from '@/lib/client-ip';
import { dedupeActiveVisitors } from '@/lib/visitors';

// GET /api/visitors/active
// Returns anonymous visitor dots: { data: { visitors: Dot[] } }
// A Dot has: country (ISO2), page (first 40 chars), age_s (seconds since last seen).
// No PII — IP is never returned, only the country derived from it.

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const ip = await clientIp();
  const rate = await checkRate(`visitors:${ip}`, 10, 60_000);
  if (!rate.allowed) {
    return NextResponse.json({ data: { visitors: [] } }, {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil(rate.resetMs / 1000)) },
    });
  }
  void req;

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ data: { visitors: [] } });

  try {
    // Active: seen in the last 5 minutes
    const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('page_views')
      .select('path, created_at, session_id')
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(500);

    // One dot per DISTINCT visitor (session_id), not per page-view event.
    const visitors = dedupeActiveVisitors(data ?? []);

    return NextResponse.json({ data: { visitors } });
  } catch {
    return NextResponse.json({ data: { visitors: [] } });
  }
}
