import { NextRequest, NextResponse } from 'next/server';
import { checkRate } from '@/lib/rate-limit';
import { clientIp } from '@/lib/client-ip';
import { getAstrbotEnv, astrbotAuthHeaders } from '@/lib/chat/astrbot-env';
import { workspaceRelativeFromPath } from '@/lib/sse-parser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Same-origin download proxy for attachments AstrBot returns in a reply
// (images the bot generates, files it produces, etc). The browser can't reach
// the ECS-internal AstrBot directly and has no API key, so it requests
//   GET /api/astrbot/file?id=<attachment_id>   (preferred)
//   GET /api/astrbot/file?name=<filename>      (legacy webchat images)
// and we forward to AstrBot with the server key, streaming the bytes back.
//
// This is a GET for <img>/<a> consumption, so there is no Origin/CSRF check
// (those don't apply to embeddable media); access is still rate-limited.

const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

// A bare filename only — block path separators and traversal, allow unicode
// (bot-produced files often have Chinese/Japanese names). Bounded length.
function isSafeName(name: string): boolean {
  if (!name || name.length > 150) return false;
  if (name.includes('/') || name.includes('\\') || name.includes('..')) return false;
  if (name.includes('\0')) return false;
  return true;
}

export async function GET(req: NextRequest) {
  const { url, key } = getAstrbotEnv();
  if (!url) {
    return NextResponse.json(
      { error: { code: 'not_configured', message: 'Attachments require AstrBot.' } },
      { status: 503 },
    );
  }

  const ip = await clientIp();
  const rate = await checkRate(`astrbot:file:${ip}`, 60, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: { code: 'rate_limited' } },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rate.resetMs / 1000)) } },
    );
  }

  const qp = req.nextUrl.searchParams;
  const id = (qp.get('id') ?? '').trim();
  const name = (qp.get('name') ?? '').trim();
  const wsRaw = (qp.get('ws') ?? '').trim();

  if (id && !ID_RE.test(id)) {
    return NextResponse.json({ error: { code: 'bad_request', message: 'invalid id' } }, { status: 400 });
  }
  if (name && !isSafeName(name)) {
    return NextResponse.json({ error: { code: 'bad_request', message: 'invalid name' } }, { status: 400 });
  }
  const ws = wsRaw
    ? workspaceRelativeFromPath(`/AstrBot/data/workspaces/${wsRaw.replace(/^\/+/, '')}`)
    : null;
  if (wsRaw && !ws) {
    return NextResponse.json({ error: { code: 'bad_request', message: 'invalid ws' } }, { status: 400 });
  }
  if (!id && !name && !ws) {
    return NextResponse.json({ error: { code: 'bad_request', message: 'id, name, or ws required' } }, { status: 400 });
  }

  const base = url.replace(/\/+$/, '');
  const headers: Record<string, string> = {};
  Object.assign(headers, astrbotAuthHeaders(key));

  // Try the public API first, then the dashboard webchat fallbacks. Different
  // AstrBot versions expose attachments under different paths, so we probe in
  // priority order and return the first that resolves.
  const candidates: string[] = [];
  if (id) {
    candidates.push(`${base}/api/v1/file?attachment_id=${encodeURIComponent(id)}`);
    candidates.push(`${base}/api/v1/chat/get_attachment?attachment_id=${encodeURIComponent(id)}`);
    candidates.push(`${base}/chat/get_attachment?attachment_id=${encodeURIComponent(id)}`);
  }
  if (name) {
    candidates.push(`${base}/api/v1/chat/get_file?filename=${encodeURIComponent(name)}`);
    candidates.push(`${base}/chat/get_file?filename=${encodeURIComponent(name)}`);
  }
  if (ws) {
    const wsFile = ws.split('/').pop() ?? '';
    candidates.push(`${base}/api/v1/chat/get_file?filename=${encodeURIComponent(ws)}`);
    candidates.push(`${base}/chat/get_file?filename=${encodeURIComponent(ws)}`);
    if (wsFile && wsFile !== ws) {
      candidates.push(`${base}/api/v1/chat/get_file?filename=${encodeURIComponent(wsFile)}`);
      candidates.push(`${base}/chat/get_file?filename=${encodeURIComponent(wsFile)}`);
    }
  }

  for (const target of candidates) {
    try {
      const res = await fetch(target, {
        headers: { ...headers, accept: req.headers.get('accept') ?? '*/*' },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok || !res.body) continue;
      const ct = res.headers.get('content-type') ?? '';
      // AstrBot returns a JSON error envelope (HTTP 200) when the file is
      // missing — skip those and keep probing the remaining candidates.
      if (ct.includes('application/json')) continue;
      const out = new Headers();
      out.set('content-type', ct || 'application/octet-stream');
      const len = res.headers.get('content-length');
      if (len) out.set('content-length', len);
      out.set('cache-control', 'private, max-age=300');
      return new NextResponse(res.body, { status: 200, headers: out });
    } catch {
      // try the next candidate
    }
  }

  return NextResponse.json(
    { error: { code: 'not_found', message: 'Attachment not reachable.' } },
    { status: 404 },
  );
}
