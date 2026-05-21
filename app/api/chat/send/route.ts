import { NextResponse, type NextRequest } from 'next/server';
import { chatMessageSchema, astrbotReplySchema } from '@/lib/validation';
import { checkRate, RATE_CHAT } from '@/lib/rate-limit';
import { clientIp } from '@/lib/client-ip';
import { hashIp } from '@/lib/hmac-ip';
import { logError } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const apiUrl = process.env.ASTRBOT_INTERNAL_URL;
  const apiKey = process.env.ASTRBOT_API_KEY;

  if (!apiUrl || !apiKey) {
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

  const ipLimit = await checkRate(`chat:ip:${ip}`, RATE_CHAT.limit, RATE_CHAT.windowMs);
  if (!ipLimit.allowed) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const sidLimit = await checkRate(`chat:sid:${sessionId}`, RATE_CHAT.limit, RATE_CHAT.windowMs);
  if (!sidLimit.allowed) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  let userId: string;
  try {
    userId = hashIp(ip);
  } catch (err) {
    logError('chat/send', 'HMAC_IP_SECRET missing', err);
    return NextResponse.json({ error: 'bot_unavailable' }, { status: 503 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${apiUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({
        content: message,
        session_id: sessionId,
        user_id: userId,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      logError('chat/send', 'AstrBot returned non-ok', { status: res.status });
      return NextResponse.json({ error: 'bot_unavailable' }, { status: 503 });
    }

    const data: unknown = await res.json();
    const validated = astrbotReplySchema.safeParse(data);

    if (!validated.success) {
      logError('chat/send', 'AstrBot response failed validation');
      return NextResponse.json({ error: 'bot_unavailable' }, { status: 503 });
    }

    return NextResponse.json({
      reply: validated.data.reply,
      sessionId,
    });
  } catch (err) {
    logError('chat/send', 'Request to AstrBot failed', err);
    return NextResponse.json({ error: 'bot_unavailable' }, { status: 503 });
  }
}
