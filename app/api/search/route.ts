import { NextRequest, NextResponse } from 'next/server';
import { getAllPosts } from '@/lib/content';
import { createClient } from '@/lib/supabase/server';
import { checkRate } from '@/lib/rate-limit';
import { clientIp } from '@/lib/client-ip';

export const dynamic = 'force-dynamic';

type SearchHit = {
  kind: 'post' | 'project' | 'guest';
  slug?: string;
  title: string;
  excerpt: string;
  tag?: string;
  date?: string;
  url?: string;
};

function score(text: string, q: string): number {
  const lower = text.toLowerCase();
  const ql = q.toLowerCase();
  if (lower === ql) return 10;
  if (lower.startsWith(ql)) return 7;
  if (lower.includes(ql)) return 4;
  // word boundary match
  if (lower.split(/\W+/).some((w) => w.startsWith(ql))) return 3;
  return 0;
}

function matches(fields: string[], q: string): number {
  return fields.reduce((acc, f) => acc + score(f, q), 0);
}

// GET /api/search?q=...&locale=en
export async function GET(req: NextRequest) {
  const ip = await clientIp();
  const rate = await checkRate(`search:${ip}`, 20, 60_000);
  if (!rate.allowed) {
    return NextResponse.json({ data: [] }, {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil(rate.resetMs / 1000)) },
    });
  }

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 100);
  const locale = req.nextUrl.searchParams.get('locale') ?? 'en';
  if (q.length < 2) return NextResponse.json({ data: [] });

  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hits: (SearchHit & { _score: number })[] = [];

  // ── Posts ─────────────────────────────────────────────────
  const posts = await getAllPosts().catch(() => []);
  for (const p of posts) {
    const s = terms.reduce((acc, t) =>
      acc + matches([p.title, p.excerpt, p.tag, p.content.slice(0, 500)], t), 0);
    if (s > 0) hits.push({
      kind: 'post',
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt.slice(0, 140),
      tag: p.tag,
      date: p.date.slice(0, 10),
      url: `/${locale}/blog/${p.slug}`,
      _score: s,
    });
  }

  // ── Guestbook entries ──────────────────────────────────────
  const supabase = await createClient();
  if (supabase) {
    // Supabase query builders are thenables without a .catch(); guard with try/catch.
    let guests: Array<{ name: unknown; message: unknown; created_at: unknown }> | null = null;
    try {
      const { data } = await supabase
        .from('guestbook')
        .select('name, message, created_at')
        .order('created_at', { ascending: false })
        .limit(200);
      guests = data;
    } catch { guests = null; }

    for (const g of guests ?? []) {
      const s = terms.reduce((acc, t) =>
        acc + matches([String(g.name ?? ''), String(g.message ?? '')], t), 0);
      if (s > 0) hits.push({
        kind: 'guest',
        title: String(g.name ?? 'Anonymous'),
        excerpt: String(g.message ?? '').slice(0, 140),
        date: String(g.created_at ?? '').slice(0, 10),
        url: `/${locale}/guestbook`,
        _score: s,
      });
    }
  }

  // Sort by score desc, cap at 20 results
  hits.sort((a, b) => b._score - a._score);
  const results = hits.slice(0, 20).map(({ _score: _s, ...h }) => h);

  return NextResponse.json({ data: results });
}
