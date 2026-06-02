import { NextRequest, NextResponse } from 'next/server';
import { parseSseReply } from '@/lib/sse-parser';
import { chatMessageSchema } from '@/lib/validation';
import { validateOrigin } from '@/lib/origin';
import { checkRate, RATE_CHAT } from '@/lib/rate-limit';
import { clientIp } from '@/lib/client-ip';

// ── env ───────────────────────────────────────────────────────────────────
const ASTRBOT_URL  = process.env.ASTRBOT_INTERNAL_URL;
const ASTRBOT_KEY  = process.env.ASTRBOT_API_KEY;
const COZE_KEY     = process.env.COZE_API_KEY;
const COZE_BOT_ID  = process.env.COZE_BOT_ID;
const COZE_BASE    = (process.env.COZE_BASE_URL ?? 'https://api.coze.cn').replace(/\/$/, '');
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;

const anyConfigured = () => !!(ASTRBOT_URL || COZE_KEY || DEEPSEEK_KEY);

// ── Provider result type ──────────────────────────────────────────────────
type ProviderResult =
  | { ok: true;  reply: string; provider: string }
  | { ok: false; reason: string };

// ── Provider 1: AstrBot ───────────────────────────────────────────────────
async function tryAstrBot(
  message: string | Array<Record<string, unknown>>,
  sessionId: string | undefined,
  username: string,
): Promise<ProviderResult> {
  if (!ASTRBOT_URL) return { ok: false, reason: 'astrbot: not configured' };

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (ASTRBOT_KEY) headers['Authorization'] = `Bearer ${ASTRBOT_KEY}`;

  try {
    const payload: Record<string, unknown> = { message, username, enable_streaming: false };
    if (sessionId) payload.session_id = sessionId;

    const res = await fetch(`${ASTRBOT_URL}/api/v1/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) return { ok: false, reason: `astrbot: ${res.status}` };

    const raw = await res.text();
    // AstrBot returns its own error envelope with HTTP 200
    try {
      const j = JSON.parse(raw) as Record<string, unknown>;
      if (j.status === 'error') return { ok: false, reason: `astrbot: ${j.message ?? 'error'}` };
    } catch { /* not JSON — treat as SSE stream */ }

    const reply = parseSseReply(raw);
    return reply ? { ok: true, reply, provider: 'astrbot' } : { ok: false, reason: 'astrbot: empty reply' };
  } catch (err) {
    return { ok: false, reason: `astrbot: ${err instanceof Error ? err.message : 'timeout'}` };
  }
}

// ── Provider 2: Coze v3 ───────────────────────────────────────────────────
// Flow: POST /v3/chat → poll /v3/chat/retrieve → GET /v3/chat/messages
// Ref: github.com/coze-dev/coze-js
async function tryCoze(
  message: string,
  userId: string,
): Promise<ProviderResult> {
  if (!COZE_KEY || !COZE_BOT_ID) return { ok: false, reason: 'coze: not configured' };

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${COZE_KEY}`,
  };

  try {
    // Step 1: create chat
    const createRes = await fetch(`${COZE_BASE}/v3/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        bot_id: COZE_BOT_ID,
        user_id: userId,
        additional_messages: [{ role: 'user', content: message, content_type: 'text' }],
        stream: false,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!createRes.ok) return { ok: false, reason: `coze: create ${createRes.status}` };

    const created = await createRes.json() as { code: number; data?: { id: string; conversation_id: string; status: string } };
    if (created.code !== 0 || !created.data) return { ok: false, reason: `coze: create code ${created.code}` };

    const { id: chatId, conversation_id: convId } = created.data;

    // Step 2: poll until completed (max 30s, 200ms interval)
    const deadline = Date.now() + 30_000;
    let status = created.data.status;
    while (status === 'in_progress' || status === 'created') {
      if (Date.now() > deadline) return { ok: false, reason: 'coze: timeout waiting for completion' };
      await new Promise((r) => setTimeout(r, 300));
      const pollRes = await fetch(
        `${COZE_BASE}/v3/chat/retrieve?conversation_id=${convId}&chat_id=${chatId}`,
        { headers, signal: AbortSignal.timeout(5_000) },
      );
      if (!pollRes.ok) break;
      const poll = await pollRes.json() as { code: number; data?: { status: string } };
      status = poll.data?.status ?? 'failed';
    }

    if (status !== 'completed') return { ok: false, reason: `coze: ended with status ${status}` };

    // Step 3: fetch messages
    const msgRes = await fetch(
      `${COZE_BASE}/v3/chat/messages?conversation_id=${convId}&chat_id=${chatId}`,
      { headers, signal: AbortSignal.timeout(5_000) },
    );
    if (!msgRes.ok) return { ok: false, reason: `coze: messages ${msgRes.status}` };

    const msgs = await msgRes.json() as { code: number; data?: Array<{ role: string; type: string; content: string }> };
    if (msgs.code !== 0) return { ok: false, reason: `coze: messages code ${msgs.code}` };

    const answer = msgs.data?.find((m) => m.role === 'assistant' && m.type === 'answer');
    const reply = answer?.content ?? '';
    return reply ? { ok: true, reply, provider: 'coze' } : { ok: false, reason: 'coze: no answer message' };
  } catch (err) {
    return { ok: false, reason: `coze: ${err instanceof Error ? err.message : 'timeout'}` };
  }
}

// ── Provider 3: DeepSeek ──────────────────────────────────────────────────
async function tryDeepSeek(message: string): Promise<ProviderResult> {
  if (!DEEPSEEK_KEY) return { ok: false, reason: 'deepseek: not configured' };

  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: message }],
        max_tokens: 1000,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) return { ok: false, reason: `deepseek: ${res.status}` };

    const json = await res.json() as { choices?: Array<{ message: { content: string } }> };
    const reply = json.choices?.[0]?.message?.content ?? '';
    return reply ? { ok: true, reply, provider: 'deepseek' } : { ok: false, reason: 'deepseek: empty reply' };
  } catch (err) {
    return { ok: false, reason: `deepseek: ${err instanceof Error ? err.message : 'timeout'}` };
  }
}

// ── GET: status probe (widget shows if any provider configured) ───────────
export async function GET() {
  if (!anyConfigured()) {
    return NextResponse.json({ error: { code: 'not_configured' } }, { status: 503 });
  }
  return NextResponse.json({ status: 'ok' });
}

// ── POST: waterfall AstrBot → Coze → DeepSeek ────────────────────────────
export async function POST(req: NextRequest) {
  const origin = validateOrigin(req);
  if (origin) return origin;

  if (!anyConfigured()) {
    return NextResponse.json({ error: { code: 'not_configured' } }, { status: 503 });
  }

  const ip = await clientIp();
  const rate = await checkRate(`chat:waterfall:${ip}`, RATE_CHAT.limit, RATE_CHAT.windowMs);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: { code: 'rate_limited', message: 'Too many messages — slow down.' } },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rate.resetMs / 1000)) } },
    );
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const rawMessage = String(body.message ?? '').trim().slice(0, 2000);
  const sessionId = String(body.session_id ?? '').slice(0, 64) || undefined;
  const username  = String(body.username  ?? 'web-visitor').slice(0, 64);

  // Optional attachments — image/file/record/video referencing AstrBot
  // attachment_ids from POST /api/astrbot/upload. Coze/DeepSeek can't resolve
  // these ids, so attachment messages skip the fallback and go AstrBot-only.
  const ATTACH_TYPES = new Set(['image', 'file', 'record', 'video']);
  const attachments = (Array.isArray(body.attachments) ? body.attachments : [])
    .map((a) => (a && typeof a === 'object' ? a as Record<string, unknown> : {}))
    .map((a) => ({ type: String(a.type ?? ''), attachment_id: String(a.attachment_id ?? '') }))
    .filter((a) => ATTACH_TYPES.has(a.type) && /^[A-Za-z0-9_-]{8,64}$/.test(a.attachment_id))
    .slice(0, 6);

  if (!rawMessage && attachments.length === 0) {
    return NextResponse.json({ error: { code: 'validation_error', message: 'message required' } }, { status: 400 });
  }

  let text = '';
  if (rawMessage) {
    const msgParsed = chatMessageSchema.pick({ message: true }).safeParse({ message: rawMessage });
    if (!msgParsed.success) {
      return NextResponse.json(
        { error: { code: 'validation_error', message: msgParsed.error.issues[0]?.message ?? 'Invalid input' } },
        { status: 400 },
      );
    }
    text = msgParsed.data.message;
  }

  // Attachment messages: build an AstrBot message chain, AstrBot only.
  if (attachments.length > 0) {
    const chain: Array<Record<string, unknown>> = [];
    if (text) chain.push({ type: 'plain', text });
    for (const a of attachments) chain.push({ type: a.type, attachment_id: a.attachment_id });
    const result = await tryAstrBot(chain, sessionId, username);
    if (result.ok) {
      return NextResponse.json({ data: { message: result.reply, provider: result.provider } });
    }
    return NextResponse.json(
      { error: { code: 'astrbot_unavailable', message: 'Attachments need AstrBot, which is currently unavailable.', detail: result.reason } },
      { status: 502 },
    );
  }

  // Text-only: AstrBot → Coze → DeepSeek waterfall.
  const attempts: string[] = [];
  for (const run of [
    () => tryAstrBot(text, sessionId, username),
    () => tryCoze(text, sessionId ?? username),
    () => tryDeepSeek(text),
  ]) {
    const result = await run();
    if (result.ok) {
      return NextResponse.json({ data: { message: result.reply, provider: result.provider } });
    }
    attempts.push(result.reason);
  }

  return NextResponse.json(
    { error: { code: 'all_providers_failed', attempts } },
    { status: 502 },
  );
}
