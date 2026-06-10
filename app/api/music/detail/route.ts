import { NextRequest, NextResponse } from 'next/server';
import { getNeteaseCookies } from '@/lib/netease-auth';
import { parseLrc } from '@/lib/lrc';
import { logError } from '@/lib/logger';

const DOCKER_BASE = process.env.NETEASE_API_URL;

// GET /api/music/detail?id=<songId> → { data: SongDetail | null }
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id') ?? '';
  if (!id || !/^\d+$/.test(id)) {
    return NextResponse.json(
      { error: { code: 'invalid_id', message: 'id must be numeric' } },
      { status: 400 },
    );
  }

  if (!DOCKER_BASE) {
    return NextResponse.json({ data: null });
  }

  try {
    const cookies = await getNeteaseCookies();
    const h: Record<string, string> = { 'User-Agent': 'Mozilla/5.0 (compatible; molamaker/1.0)' };
    if (cookies) h['Cookie'] = cookies;

    const [detailRes, lyricRes] = await Promise.allSettled([
      fetch(`${DOCKER_BASE}/song/detail?ids=${id}`, { headers: h, signal: AbortSignal.timeout(5000) }),
      fetch(`${DOCKER_BASE}/lyric?id=${id}`, { headers: h, signal: AbortSignal.timeout(5000) }),
    ]);

    const detailJson = detailRes.status === 'fulfilled' ? await detailRes.value.json().catch(() => ({})) : {};
    const lyricJson  = lyricRes.status  === 'fulfilled' ? await lyricRes.value.json().catch(() => ({}))  : {};

    const song = ((detailJson?.songs ?? []) as Record<string, unknown>[])[0];
    if (!song) return NextResponse.json({ data: null });

    const album   = (song.al ?? {}) as Record<string, unknown>;
    const artists = ((song.ar ?? []) as Record<string, unknown>[])
      .map((a) => String(a.name ?? '')).join(' / ');
    const rawLrc  = (lyricJson?.lrc?.lyric ?? '') as string;
    const lyrics  = parseLrc(rawLrc).slice(0, 30);

    return NextResponse.json({
      data: {
        id,
        title:    String(song.name ?? 'Unknown'),
        artist:   artists || 'Unknown artist',
        album:    String(album.name ?? ''),
        cover:    String(album.picUrl ?? ''),
        duration: Math.floor(Number(song.dt ?? 0) / 1000),
        lyrics,
      },
    });
  } catch (err) {
    logError('music/detail', 'Failed to fetch song detail', err);
    return NextResponse.json({ data: null });
  }
}
