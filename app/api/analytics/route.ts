import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';

// GET /api/analytics — owner/admin only (uses requireAdmin which checks the
// admin session, not the workplace session). Returns aggregated stats.

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let supabase;
  try { supabase = createServiceClient(); } catch {
    return NextResponse.json({ error: 'db unavailable' }, { status: 503 });
  }

  const [pvRes, reactRes, postRes, guestRes] = await Promise.allSettled([
    // Daily page views — last 30 days
    supabase
      .from('page_views')
      .select('path, created_at')
      .gte('created_at', new Date(Date.now() - 30 * 86400_000).toISOString())
      .order('created_at'),

    // Reaction counts
    supabase
      .from('reactions')
      .select('slug, kind'),

    // Posts with view counts
    supabase
      .from('posts')
      .select('slug, title, view_count, published')
      .eq('published', true)
      .order('view_count', { ascending: false })
      .limit(10),

    // Guestbook entry count
    supabase
      .from('guestbook')
      .select('id', { count: 'exact', head: true }),
  ]);

  // ── Build daily buckets ─────────────────────────────────────
  const pvData = pvRes.status === 'fulfilled' ? (pvRes.value.data ?? []) : [];
  const dailyMap: Record<string, number> = {};
  const pageMap: Record<string, number> = {};

  for (const row of pvData) {
    const day = String(row.created_at ?? '').slice(0, 10);
    dailyMap[day] = (dailyMap[day] ?? 0) + 1;
    const p = String(row.path ?? '/');
    pageMap[p] = (pageMap[p] ?? 0) + 1;
  }

  const daily = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  const topPages = Object.entries(pageMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([path, count]) => ({ path, count }));

  // ── Reactions ───────────────────────────────────────────────
  const reactions = reactRes.status === 'fulfilled' ? (reactRes.value.data ?? []) : [];
  const reactionTotals: Record<string, number> = { heart: 0, brain: 0, fire: 0 };
  for (const r of reactions) {
    reactionTotals[r.kind] = (reactionTotals[r.kind] ?? 0) + 1;
  }

  // ── Posts ───────────────────────────────────────────────────
  const posts = postRes.status === 'fulfilled' ? (postRes.value.data ?? []) : [];

  // ── Totals ──────────────────────────────────────────────────
  const totalViews = pvData.length;
  const guestCount = guestRes.status === 'fulfilled' ? (guestRes.value.count ?? 0) : 0;

  return NextResponse.json({
    data: {
      totalViews,
      daily,
      topPages,
      reactionTotals,
      topPosts: posts,
      guestCount,
    },
  });
}
