import { NextResponse, type NextRequest } from 'next/server';
import { chatMessageSchema } from '@/lib/validation';
import { checkRate, RATE_CHAT } from '@/lib/rate-limit';
import { clientIp } from '@/lib/client-ip';
import { logError } from '@/lib/logger';
import { parseSseReply } from '@/lib/sse-parser';
import { validateOrigin } from '@/lib/origin';
import { getAstrbotEnv } from '@/lib/chat/astrbot-env';

export async function POST(request: NextRequest) {
  const origin = validateOrigin(request);
  if (origin) return origin;

  const { url, key } = getAstrbotEnv();
  if (!url || !key) {
    return NextResponse.json({ error: 'bot_unavailable' }, { status: 503 });
  }

  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') {
    return NextResponse.json({ error: 'invalid_content_type' }, { status: 415 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = chatMessageSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation_failed' }, { status: 400 });
  }

  const { message, sessionId } = parsed.data;

  const ip = await clientIp();

  const rate = await checkRate(`chat:${ip}:${sessionId}`, RATE_CHAT.limit, RATE_CHAT.windowMs);
  if (!rate.allowed) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  try {
    const res = await fetch(`${url}/api/v1/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        message,
        username: 'brand-chat',
        session_id: sessionId,
        enable_streaming: false,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      logError('chat/send', 'AstrBot returned non-ok', { status: res.status });
      return NextResponse.json({ error: 'bot_unavailable' }, { status: 503 });
    }

    const body = await res.text();

    // AstrBot sometimes returns a JSON error envelope with HTTP 200
    try {
      const j = JSON.parse(body) as Record<string, unknown>;
      if (j.status === 'error') {
        logError('chat/send', 'AstrBot error envelope', j);
        return NextResponse.json({ error: 'bot_unavailable' }, { status: 503 });
      }
    } catch { /* not JSON — treat as SSE stream */ }

    const reply = parseSseReply(body);
    if (!reply) {
      logError('chat/send', 'Empty reply from AstrBot');
      return NextResponse.json({ error: 'bot_unavailable' }, { status: 503 });
    }

    return NextResponse.json(
      { reply, sessionId },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (err) {
    logError('chat/send', 'Request to AstrBot failed', err);
    return NextResponse.json({ error: 'bot_unavailable' }, { status: 503 });
  }
}
