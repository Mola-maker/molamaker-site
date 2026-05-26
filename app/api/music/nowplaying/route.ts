import { NextResponse } from 'next/server';
import { getNeteaseCookies } from '@/lib/netease-auth';
import { parseLrc, type LrcLine } from '@/lib/lrc';
import { logError } from '@/lib/logger';

const DOCKER_BASE = process.env.NETEASE_API_URL;

export const revalidate = 60;

export interface NowPlayingData {
  id: string;
  title: string;
  artist: string;
  album: string;
  cover: string;           // album cover URL
  duration: number;        // seconds
  lyrics: LrcLine[];
  recent: string[];        // recent track names
}

export type { LrcLine };

// GET /api/music/nowplaying → { data: NowPlayingData | null }
export async function GET() {
  if (!DOCKER_BASE) {
    return NextResponse.json({ data: null });
  }

  try {
    const cookies = await getNeteaseCookies();
    const h: Record<string, string> = { 'User-Agent': 'Mozilla/5.0 (compatible; molamaker/1.0)' };
    if (cookies) h['Cookie'] = cookies;

    // Get personal FM for the current track
    const fmRes = await fetch(`${DOCKER_BASE}/personal_fm`, {
      headers: h,
      signal: AbortSignal.timeout(5000),
    });
    const fmJson = await fmRes.json().catch(() => ({}));
    const fmSongs: Record<string, unknown>[] = fmJson?.data ?? [];

    if (!fmSongs.length) {
      return NextResponse.json({ data: null });
    }

    const song = fmSongs[0] as Record<string, unknown>;
    const id = String(song.id ?? '');

    // Get full song details (cover, etc.) — do NOT call /personal_fm again (it advances the queue)
    const [detailRes, lyricRes] = await Promise.allSettled([
      fetch(`${DOCKER_BASE}/song/detail?ids=${id}`, { headers: h, signal: AbortSignal.timeout(5000) }),
      fetch(`${DOCKER_BASE}/lyric?id=${id}`, { headers: h, signal: AbortSignal.timeout(5000) }),
    ]);

    const detailJson = detailRes.status === 'fulfilled' ? await detailRes.value.json().catch(() => ({})) : {};
    const lyricJson  = lyricRes.status  === 'fulfilled' ? await lyricRes.value.json().catch(() => ({}))  : {};

    const detail = ((detailJson?.songs ?? []) as Record<string, unknown>[])[0] ?? {};
    const album  = (detail.al ?? song.album ?? {}) as Record<string, unknown>;
    const artists = ((detail.ar ?? song.artists ?? []) as Record<string, unknown>[])
      .map((a) => String(a.name ?? '')).join(' / ');

    // Parse LRC lyrics
    const rawLrc = (lyricJson?.lrc?.lyric ?? '') as string;
    const lyrics = parseLrc(rawLrc).slice(0, 30);

    // Use the rest of the FM queue as "recently played" to avoid a second API call
    const recentSongs: string[] = fmSongs.slice(1, 6).map((s) => String(s.name ?? ''));

    const data: NowPlayingData = {
      id,
      title:   String(song.name ?? detail.name ?? 'Unknown'),
      artist:  artists || 'Unknown artist',
      album:   String(album.name ?? ''),
      cover:   String(album.picUrl ?? ''),
      duration: Math.floor(Number(song.duration ?? detail.dt ?? 0) / 1000),
      lyrics,
      recent: recentSongs,
    };

    return NextResponse.json({ data });
  } catch (err) {
    logError('music/nowplaying', 'Failed to fetch now playing', err);
    return NextResponse.json({ data: null });
  }
}
