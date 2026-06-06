import { NextRequest, NextResponse } from 'next/server';
import { getNeteaseCookies, clearNeteaseCookies } from '@/lib/netease-auth';

const DOCKER_BASE = process.env.NETEASE_API_URL;
const REAL_IP = process.env.NETEASE_REAL_IP;
const QUALITY_LEVELS = ['exhigh', 'higher', 'standard', 'lossless'];

// GET /api/music/<id>  → proxied audio stream
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id || !/^\d+$/.test(id)) {
    return NextResponse.json(
      { error: { code: 'invalid_id', message: 'Song id must be numeric' } },
      { status: 400 },
    );
  }

  try {
    let cdnUrl: string | null = null;

    if (DOCKER_BASE) {
      const cookies = await getNeteaseCookies();
      const headers: HeadersInit = {};
      if (cookies) headers['Cookie'] = cookies;
      // realIP is only needed when the API server sits OUTSIDE China (to forward
      // a CN IP past geo-blocking). On the China-hosted ECS the container's own
      // outbound IP already passes, so it is optional there.
      const realIp = REAL_IP ? `&realIP=${REAL_IP}` : '';

      for (const level of QUALITY_LEVELS) {
        const r = await fetch(
          `${DOCKER_BASE}/song/url/v1?id=${id}&level=${level}${realIp}`,
          { headers },
        );
        const j = await r.json();
        cdnUrl = j?.data?.[0]?.url ?? null;
        if (cdnUrl) break;

        if (j?.code === 301 && cookies) {
          clearNeteaseCookies();
          const fresh = await getNeteaseCookies();
          if (fresh) {
            const r2 = await fetch(
              `${DOCKER_BASE}/song/url/v1?id=${id}&level=${level}${realIp}`,
              { headers: { Cookie: fresh } },
            );
            const j2 = await r2.json();
            cdnUrl = j2?.data?.[0]?.url ?? null;
            if (cdnUrl) break;
          }
        }
      }
    } else {
      cdnUrl = `https://music.163.com/song/media/outer/url?id=${id}.mp3`;
    }

    if (!cdnUrl) {
      return NextResponse.json(
        { error: { code: 'not_found', message: 'No stream URL available for this track' } },
        { status: 404 },
      );
    }

    // SSRF guard: only allow NetEase CDN origins (re-checked after each redirect hop)
    const isTrustedHost = (host: string) =>
      host.endsWith('.music.126.net') || host.endsWith('.163.com') || host === 'music.163.com';

    let parsedCdn: URL;
    try { parsedCdn = new URL(cdnUrl); } catch {
      return NextResponse.json({ error: { code: 'invalid_url', message: 'Bad upstream URL' } }, { status: 502 });
    }
    if (!isTrustedHost(parsedCdn.hostname)) {
      return NextResponse.json({ error: { code: 'invalid_url', message: 'Untrusted CDN origin' } }, { status: 502 });
    }

    // Follow redirects manually, validating each hop's host.
    // Use a manual AbortController: 10 s to establish the connection (get response headers),
    // then clear the timeout so the body stream is never aborted mid-transfer.
    const rangeHeader = req.headers.get('range');
    const followHeaders: Record<string, string> = {
      Referer: 'https://music.163.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      ...(rangeHeader ? { Range: rangeHeader } : {}),
    };
    let upstream: Response | null = null;
    let nextUrl: string = cdnUrl;
    for (let hop = 0; hop < 5; hop++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);
      let r: Response;
      try {
        r = await fetch(nextUrl, { signal: controller.signal, redirect: 'manual', headers: followHeaders });
      } finally {
        // Headers received — disarm the timeout so body streaming is never cut off
        clearTimeout(timeoutId);
      }
      if (r.status >= 300 && r.status < 400) {
        const loc = r.headers.get('location');
        if (!loc) { upstream = r; break; }
        let nextParsed: URL;
        try { nextParsed = new URL(loc, nextUrl); } catch {
          return NextResponse.json({ error: { code: 'invalid_url', message: 'Bad redirect URL' } }, { status: 502 });
        }
        if (!isTrustedHost(nextParsed.hostname)) {
          return NextResponse.json({ error: { code: 'invalid_url', message: 'Untrusted redirect origin' } }, { status: 502 });
        }
        nextUrl = nextParsed.toString();
        continue;
      }
      upstream = r;
      break;
    }
    if (!upstream) {
      return NextResponse.json({ error: { code: 'too_many_redirects', message: 'Redirect loop' } }, { status: 502 });
    }

    // Sanitize Content-Type — never reflect arbitrary types from upstream
    const rawCt = upstream.headers.get('Content-Type') ?? '';
    const safeCt = /^audio\/(mpeg|mp4|ogg|webm|aac|flac|x-m4a)/.test(rawCt) ? rawCt : 'audio/mpeg';

    const out = new Headers();
    out.set('Content-Type', safeCt);
    out.set('Accept-Ranges', 'bytes');
    out.set('Cache-Control', 'no-store');
    const cl = upstream.headers.get('Content-Length');
    if (cl) out.set('Content-Length', cl);
    const cr = upstream.headers.get('Content-Range');
    if (cr) out.set('Content-Range', cr);

    return new NextResponse(upstream.body, { status: upstream.status, headers: out });
  } catch {
    return NextResponse.json(
      { error: { code: 'upstream_error', message: 'Stream failed' } },
      { status: 502 },
    );
  }
}
