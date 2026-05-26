import { NextRequest, NextResponse } from 'next/server';
import { logError } from '@/lib/logger';

const DOCKER_BASE = process.env.NETEASE_API_URL;
const NE_FALLBACK = 'https://music.163.com/api';

// GET /api/music/search?q=<keywords>&limit=8
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') ?? '';
  const parsedLimit = Number.parseInt(req.nextUrl.searchParams.get('limit') ?? '8', 10);
  const limit = Math.min(Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 8, 20);

  if (!q.trim()) {
    return NextResponse.json(
      { error: { code: 'missing_query', message: 'q is required' } },
      { status: 400 },
    );
  }

  try {
    let songs: unknown[];
    if (DOCKER_BASE) {
      const res = await fetch(
        `${DOCKER_BASE}/search?keywords=${encodeURIComponent(q)}&limit=${limit}`,
      );
      const json = await res.json();
      songs = json?.result?.songs ?? [];
    } else {
      const res = await fetch(
        `${NE_FALLBACK}/search/get?s=${encodeURIComponent(q)}&type=1&limit=${limit}`,
        { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://music.163.com/' } },
      );
      const json = await res.json();
      songs = json?.result?.songs ?? [];
    }
    return NextResponse.json({ data: { songs } });
  } catch (err) {
    logError('music/search', 'Search failed', err);
    return NextResponse.json(
      { error: { code: 'upstream_error', message: 'Search failed' } },
      { status: 502 },
    );
  }
}
