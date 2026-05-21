import { NextResponse, type NextRequest } from 'next/server';
import { chatHistoryQuerySchema, astrbotHistorySchema } from '@/lib/validation';
import { checkRate, RATE_CHAT } from '@/lib/rate-limit';
import { clientIp } from '@/lib/client-ip';
import { logError } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const apiUrl = process.env.ASTRBOT_INTERNAL_URL;
  const apiKey = process.env.ASTRBOT_API_KEY;

  if (!apiUrl || !apiKey) {
    return NextResponse.json({ messages: [] });
  }

  const raw = { sessionId: request.nextUrl.searchParams.get('sessionId') ?? '' };
  const parsed = chatHistoryQuerySchema.safeParse(raw);

  if (!parsed.success) {
    return NextResponse.json({ messages: [] }, { status: 400 });
  }

  const ip = await clientIp();
  const rate = await checkRate(`history:ip:${ip}`, RATE_CHAT.limit, RATE_CHAT.windowMs);
  if (!rate.allowed) {
    return NextResponse.json({ messages: [] }, { status: 429 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(
      `${apiUrl}/api/chat/history?session_id=${encodeURIComponent(parsed.data.sessionId)}`,
      {
        headers: { 'X-API-Key': apiKey },
        signal: controller.signal,
      },
    );

    clearTimeout(timeout);

    if (!res.ok) {
      logError('chat/history', 'AstrBot returned non-ok', { status: res.status });
      return NextResponse.json({ messages: [] }, { status: 502 });
    }

    const data: unknown = await res.json();
    const validated = astrbotHistorySchema.safeParse(data);

    if (!validated.success) {
      logError('chat/history', 'AstrBot response failed validation');
      return NextResponse.json({ messages: [] }, { status: 502 });
    }

    return NextResponse.json({ messages: validated.data.messages });
  } catch (err) {
    logError('chat/history', 'Request to AstrBot failed', err);
    return NextResponse.json({ messages: [] }, { status: 502 });
  }
}
