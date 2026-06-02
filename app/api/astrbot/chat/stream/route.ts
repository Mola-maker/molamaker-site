import { NextRequest } from 'next/server';
import { chatMessageSchema } from '@/lib/validation';
import { validateOrigin } from '@/lib/origin';
import { checkRate, RATE_CHAT } from '@/lib/rate-limit';
import { clientIp } from '@/lib/client-ip';

// Live token streaming for the chat widget. Mirrors the SSE pattern proven in
// app/api/workplace/math/route.ts: emit `data: {"token":"…"}` frames, end with
// `data: [DONE]`. Providers are tried in the same waterfall order (AstrBot →
// Coze → DeepSeek); a provider is only abandoned for the next one if it fails
// BEFORE emitting any token — once tokens flow we commit to that provider.
//
// Attachments still use the non-streaming JSON route (POST /api/astrbot/chat).

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ASTRBOT_URL  = process.env.ASTRBOT_INTERNAL_URL;
const ASTRBOT_KEY  = process.env.ASTRBOT_API_KEY;
const COZE_KEY     = process.env.COZE_API_KEY;
const COZE_BOT_ID  = process.env.COZE_BOT_ID;
const COZE_BASE    = (process.env.COZE_BASE_URL ?? 'https://api.coze.cn').replace(/\/$/, '');
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;

const anyConfigured = () => !!(ASTRBOT_URL || COZE_KEY || DEEPSEEK_KEY);

type Send = (token: string) => void;

function makeSseStream(gen: (send: Send) => Promise<void>): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send: Send = (token) => {
        try { controller.enqueue(enc.encode(`data: ${JSON.stringify({ token })}\n\n`)); }
        catch { /* client disconnected */ }
      };
      try {
        await gen(send);
      } finally {
        try {
          controller.enqueue(enc.encode('data: [DONE]\n\n'));
          controller.close();
        } catch { /* already closed */ }
      }
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// ── AstrBot — native SSE with enable_streaming:true, chunks are
//    { "type": "plain", "data": "<token>" } ──────────────────────────────────
async function streamAstrBot(message: string, sessionId: string | undefined, username: string, send: Send): Promise<void> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (ASTRBOT_KEY) headers['Authorization'] = `Bearer ${ASTRBOT_KEY}`;
  const payload: Record<string, unknown> = { message, username, enable_streaming: true };
  if (sessionId) payload.session_id = sessionId;

  const r = await fetch(`${ASTRBOT_URL}/api/v1/chat`, {
    method: 'POST', headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(60_000),
  });
  if (!r.ok || !r.body) throw new Error(`astrbot: ${r.status}`);

  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const raw = line.slice(5).trim();
      if (raw === '[DONE]') return;
      let j: Record<string, unknown>;
      try { j = JSON.parse(raw) as Record<string, unknown>; } catch { continue; }
      if (j.status === 'error') throw new Error(`astrbot: ${j.message ?? 'error'}`);
      if (j.type === 'plain' && typeof j.data === 'string' && j.data) send(j.data);
    }
  }
}

// ── Coze v3 — streaming chat (event: conversation.message.delta) ─────────────
async function streamCoze(message: string, userId: string, send: Send): Promise<void> {
  const r = await fetch(`${COZE_BASE}/v3/chat`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${COZE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bot_id: COZE_BOT_ID,
      user_id: userId,
      stream: true,
      auto_save_history: false,
      additional_messages: [{ role: 'user', content: message, content_type: 'text' }],
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!r.ok || !r.body) throw new Error(`coze: ${r.status}`);

  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split('\n\n');
    buf = parts.pop() ?? '';
    for (const part of parts) {
      const lines = part.split('\n');
      const event = lines.find((l) => l.startsWith('event:'))?.slice(6).trim();
      const dataLine = lines.find((l) => l.startsWith('data:'));
      if (event === 'done') return;
      if (event !== 'conversation.message.delta' || !dataLine) continue;
      try {
        const j = JSON.parse(dataLine.slice(5).trim()) as { role?: string; type?: string; content?: string };
        if (j.role === 'assistant' && j.type === 'answer' && j.content) send(j.content);
      } catch { /* skip malformed chunk */ }
    }
  }
}

// ── DeepSeek — OpenAI-compatible SSE (choices[].delta.content) ──────────────
async function streamDeepSeek(message: string, send: Send): Promise<void> {
  const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${DEEPSEEK_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: message }],
      stream: true,
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!r.ok || !r.body) throw new Error(`deepseek: ${r.status}`);

  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split('\n\n');
    buf = parts.pop() ?? '';
    for (const part of parts) {
      const dataLine = part.split('\n').find((l) => l.startsWith('data:'));
      if (!dataLine) continue;
      const raw = dataLine.slice(5).trim();
      if (raw === '[DONE]') return;
      try {
        const j = JSON.parse(raw) as { choices?: Array<{ delta?: { content?: string } }> };
        const token = j.choices?.[0]?.delta?.content;
        if (token) send(token);
      } catch { /* skip malformed chunk */ }
    }
  }
}

export async function POST(req: NextRequest) {
  const origin = validateOrigin(req);
  if (origin) return origin;

  if (!anyConfigured()) {
    return new Response(JSON.stringify({ error: { code: 'not_configured' } }), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    });
  }

  const ip = await clientIp();
  const rate = await checkRate(`chat:stream:${ip}`, RATE_CHAT.limit, RATE_CHAT.windowMs);
  if (!rate.allowed) {
    return new Response(JSON.stringify({ error: { code: 'rate_limited' } }), {
      status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(Math.ceil(rate.resetMs / 1000)) },
    });
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const rawMessage = String(body.message ?? '').trim().slice(0, 2000);
  const sessionId = String(body.session_id ?? '').slice(0, 64) || undefined;
  const username  = String(body.username  ?? 'web-visitor').slice(0, 64);

  if (!rawMessage) {
    return new Response(JSON.stringify({ error: { code: 'validation_error', message: 'message required' } }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }
  const parsed = chatMessageSchema.pick({ message: true }).safeParse({ message: rawMessage });
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: { code: 'validation_error', message: parsed.error.issues[0]?.message ?? 'Invalid input' } }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }
  const message = parsed.data.message;

  return makeSseStream(async (send) => {
    let emitted = false;
    const wrap: Send = (t) => { emitted = true; send(t); };

    const runners: Array<() => Promise<void>> = [];
    if (ASTRBOT_URL) runners.push(() => streamAstrBot(message, sessionId, username, wrap));
    if (COZE_KEY && COZE_BOT_ID) runners.push(() => streamCoze(message, sessionId ?? username, wrap));
    if (DEEPSEEK_KEY) runners.push(() => streamDeepSeek(message, wrap));

    for (const run of runners) {
      try {
        await run();
        if (emitted) return; // a provider answered — done
      } catch {
        if (emitted) return; // mid-stream failure: keep the partial reply, stop
        // otherwise fall through to the next provider
      }
    }
    if (!emitted) send('AI is temporarily unavailable — try again in a moment.');
  });
}
