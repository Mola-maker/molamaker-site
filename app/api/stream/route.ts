import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getAllPosts } from '@/lib/content';
import { getNeteaseCookies } from '@/lib/netease-auth';
import { SupabaseClient } from '@supabase/supabase-js';
import { fmtRelative } from '@/lib/date';
import { parseLrc } from '@/lib/lrc';
import { ACCENT_PALETTE } from '@/lib/constants';
import { checkRate } from '@/lib/rate-limit';
import { clientIp } from '@/lib/client-ip';

const GH_USERNAME = process.env.GITHUB_USERNAME ?? 'Mola-maker';
const GH_TOKEN = process.env.GITHUB_TOKEN;
const NETEASE_BASE = process.env.NETEASE_API_URL;
const WATCHED_REPOS = ['astrbot-plugins', 'kernel-notes', 'gstack', 'omc', 'molamaker-site'];

// GET /api/stream → { data: { signals: Signal[] } }
export async function GET(req: NextRequest) {
  const ip = await clientIp();
  const rate = await checkRate(`stream:${ip}`, 10, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: { code: 'rate_limited', message: 'Too many requests.' } },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rate.resetMs / 1000)) } },
    );
  }

  const supabase = await createClient();

  const [supabaseRes, postsRes, commitsRes, guestbookRes, nowPlayingRes, visitorRes] =
    await Promise.allSettled([
      fetchSupabaseSignals(supabase),
      getAllPosts(),
      fetchGithubCommits(),
      fetchGuestbook(supabase),
      fetchNowPlaying(),
      fetchVisitorStats(supabase),
    ]);

  const signals: Record<string, unknown>[] = [];

  // 1. Supabase custom signals (manual/webhook-inserted)
  if (supabaseRes.status === 'fulfilled') signals.push(...supabaseRes.value);

  // 2. Filesystem post signals
  const posts = postsRes.status === 'fulfilled' ? postsRes.value : [];
  for (const p of posts) {
    signals.push({
      kind: 'post',
      id: `post-${p.slug}`,
      time: fmtRelative(new Date(p.date).getTime()),
      title: p.title,
      slug: p.slug,
      meta: `${p.read_time} min read`,
      words: p.read_time * 200,
      tag: p.tag,
      excerpt: p.excerpt,
      toc: [],
      reactions: { heart: 0, brain: 0, fire: 0 },
      created_at: p.date,
    });
  }

  // 3. Real GitHub commits
  if (commitsRes.status === 'fulfilled') signals.push(...commitsRes.value);

  // 4. Real guestbook entries
  if (guestbookRes.status === 'fulfilled') signals.push(...guestbookRes.value);

  // 5. Now-playing song
  if (nowPlayingRes.status === 'fulfilled' && nowPlayingRes.value) {
    signals.push(nowPlayingRes.value);
  }

  // 6. Visitor signal (once per response)
  if (visitorRes.status === 'fulfilled' && visitorRes.value) {
    signals.push(visitorRes.value);
  }

  // Sort descending by created_at
  signals.sort((a, b) => {
    const at = a.created_at ? new Date(a.created_at as string).getTime() : 0;
    const bt = b.created_at ? new Date(b.created_at as string).getTime() : 0;
    return bt - at;
  });

  return NextResponse.json({ data: { signals: signals.slice(0, 40) } });
}

// ── Fetchers ─────────────────────────────────────────────────────────────────

async function fetchSupabaseSignals(supabase: SupabaseClient | null) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('signals')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(15);
  if (error || !data) return [];
  return data.map((s: Record<string, unknown>) => {
    const payload = (s.payload && typeof s.payload === 'object') ? s.payload as Record<string, unknown> : {};
    return { ...payload, id: s.id, kind: s.kind, time: s.time, created_at: s.created_at };
  });
}

async function fetchGithubCommits(): Promise<Record<string, unknown>[]> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'molamaker-site/1.0',
  };
  if (GH_TOKEN) headers.Authorization = `Bearer ${GH_TOKEN}`;

  const results = await Promise.allSettled(
    WATCHED_REPOS.map(async (repo) => {
      const res = await fetch(
        `https://api.github.com/repos/${GH_USERNAME}/${repo}/commits?per_page=3&sha=main`,
        { headers, next: { revalidate: 300 }, signal: AbortSignal.timeout(4500) },
      );
      if (!res.ok) return [];
      const commits: Record<string, unknown>[] = await res.json();
      return commits.map((c) => {
        const commit = c.commit as Record<string, unknown>;
        const author = ((commit.author ?? commit.committer) ?? {}) as Record<string, unknown>;
        const date = (author.date as string) ?? new Date().toISOString();
        const stats = (c.stats ?? {}) as Record<string, number>;
        return {
          kind: 'commit',
          id: `gh-${(c.sha as string).slice(0, 7)}`,
          repo,
          branch: 'main',
          message: ((commit.message as string) ?? '').split('\n')[0].slice(0, 120),
          hash: (c.sha as string).slice(0, 7),
          author: GH_USERNAME,
          meta: stats.additions ? `+${stats.additions} −${stats.deletions ?? 0}` : '',
          time: fmtRelative(new Date(date).getTime()),
          created_at: date,
          files: [],
          diff: '',
        };
      });
    }),
  );

  return results
    .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    .sort((a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime())
    .slice(0, 10);
}

async function fetchGuestbook(supabase: SupabaseClient | null): Promise<Record<string, unknown>[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('guestbook')
    .select('name, message, created_at')
    .order('created_at', { ascending: false })
    .limit(8);
  if (error || !data) return [];
  return (data as { name: string; message: string; created_at: string }[]).map((g, i) => ({
    kind: 'guestbook',
    id: `gb-${g.created_at}`,
    name: g.name,
    message: g.message,
    country: '🌏',
    accent: ACCENT_PALETTE[i % ACCENT_PALETTE.length],
    time: fmtRelative(new Date(g.created_at).getTime()),
    created_at: g.created_at,
  }));
}

async function fetchNowPlaying(): Promise<Record<string, unknown> | null> {
  if (!NETEASE_BASE) return null;
  try {
    const cookies = await getNeteaseCookies();
    const h: Record<string, string> = { 'User-Agent': 'Mozilla/5.0' };
    if (cookies) h['Cookie'] = cookies;

    const fmRes = await fetch(`${NETEASE_BASE}/personal_fm`, {
      headers: h, signal: AbortSignal.timeout(4000),
    });
    const fmJson = await fmRes.json().catch(() => ({}));
    const fmSongs: Record<string, unknown>[] = fmJson?.data ?? [];
    if (!fmSongs.length) return null;

    const song = fmSongs[0];
    const id = String(song.id ?? '');

    const [detailRes, lyricRes] = await Promise.allSettled([
      fetch(`${NETEASE_BASE}/song/detail?ids=${id}`, { headers: h, signal: AbortSignal.timeout(4000) }),
      fetch(`${NETEASE_BASE}/lyric?id=${id}`, { headers: h, signal: AbortSignal.timeout(4000) }),
    ]);

    const detailJson = detailRes.status === 'fulfilled' ? await detailRes.value.json().catch(() => ({})) : {};
    const lyricJson  = lyricRes.status  === 'fulfilled' ? await lyricRes.value.json().catch(() => ({}))  : {};

    const detail = ((detailJson?.songs ?? []) as Record<string, unknown>[])[0] ?? {};
    const album  = (detail.al ?? (song as Record<string, unknown>).album ?? {}) as Record<string, unknown>;
    const artists = (((detail.ar ?? (song as Record<string, unknown>).artists) ?? []) as Record<string, unknown>[])
      .map((a) => String(a.name ?? '')).join(' / ');

    const rawLrc = (lyricJson?.lrc?.lyric ?? '') as string;
    const lyrics = parseLrc(rawLrc).slice(0, 8);

    return {
      kind: 'song',
      id: `song-${id}`,
      time: 'now',
      title: String(song.name ?? detail.name ?? 'Unknown'),
      artist: artists || 'Unknown artist',
      album: String(album.name ?? ''),
      cover: String(album.picUrl ?? ''),
      progress: 0.42,
      length: formatDuration(Math.floor(Number((song as Record<string, unknown>).duration ?? detail.dt ?? 0) / 1000)),
      position: formatDuration(Math.floor(Number((song as Record<string, unknown>).duration ?? 0) * 0.42 / 1000)),
      bpm: 120,
      key: 'Cmaj',
      mood: 'lo-fi · warm',
      lyricsPreview: lyrics,
      recent: [],
      created_at: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function fetchVisitorStats(supabase: SupabaseClient | null): Promise<Record<string, unknown> | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase.from('visitor_stats').select('*').single();
    if (!data) return null;
    return {
      kind: 'visitor',
      id: 'visitor-live',
      time: 'live',
      value: data.total ?? 0,
      today: data.today ?? 0,
      week: data.week ?? 0,
      created_at: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
