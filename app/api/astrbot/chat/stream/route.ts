import { NextRequest } from 'next/server';
import { chatMessageSchema } from '@/lib/validation';
import { validateOrigin } from '@/lib/origin';
import { checkRate, RATE_CHAT } from '@/lib/rate-limit';
import { clientIp } from '@/lib/client-ip';
import { getAstrbotEnv } from '@/lib/chat/astrbot-env';
import { getEffectiveProvider, type EffectiveProvider } from '@/lib/workplace/settings';
import { ATTACH_SEGMENT_TYPES, attachmentMarkdown, cleanAstrBotText, toolCallMarkdown } from '@/lib/sse-parser';

// Live token streaming for the chat widget. Mirrors the SSE pattern proven in
// app/api/workplace/math/route.ts: emit `data: {"token":"…"}` frames, end with
// `data: [DONE]`. Providers are tried in the same waterfall order (AstrBot →
// Coze → DeepSeek); a provider is only abandoned for the next one if it fails
// BEFORE emitting any token — once tokens flow we commit to that provider.
//
// Attachments still use the non-streaming JSON route (POST /api/astrbot/chat).
//
// `persona` (optional) is the per-character Live2D personality system prompt.
// DeepSeek receives it as a real system message; AstrBot/Coze get it prefixed
// to the turn so switching the Live2D character actually changes the voice.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function anyConfigured(): Promise<boolean> {
  if (getAstrbotEnv().configured) return true;
  const [coze, deepseek] = await Promise.all([
    getEffectiveProvider('coze'),
    getEffectiveProvider('deepseek'),
  ]);
  return coze.configured || deepseek.configured;
}

type Send = (token: string) => void;

// ── Timeouts ───────────────────────────────────────────────────────
// AstrBot MCP tools have a 120 s timeout each, and the agent may call
// several tools sequentially.  A fixed total-timeout would kill the
// proxy mid-tool-loop even when AstrBot is making progress (sending
// tool_call frames every few seconds).  Instead we use a generous
// overall timeout as a safety net, and a per-read idle timeout that
// resets on every received SSE frame.

/** Per-read idle timeout — just over AstrBot's 120 s MCP tool timeout. */
const IDLE_TIMEOUT_MS = 130_000;

/** Overall connection timeout — safety net for truly hung connections. */
const OVERALL_TIMEOUT_MS = 600_000;

function makeSseStream(gen: (send: Send) => Promise<void>): Response {
  const enc = new TextEncoder();
  // Keep nginx (proxy_read_timeout 60 s default) and browser connections
  // alive while AstrBot runs MCP tools — tool_call frames are skipped by
  // our parser, so the SSE stream would otherwise be silent for up to
  // 120 s per tool, triggering upstream timeouts.
  const HEARTBEAT_MS = 25_000;
  const stream = new ReadableStream({
    async start(controller) {
      const send: Send = (token) => {
        try { controller.enqueue(enc.encode(`data: ${JSON.stringify({ token })}\n\n`)); }
        catch { /* client disconnected */ }
      };
      const hb = setInterval(() => {
        try { controller.enqueue(enc.encode(': heartbeat\n\n')); }
        catch { clearInterval(hb); }
      }, HEARTBEAT_MS);
      try {
        await gen(send);
      } finally {
        clearInterval(hb);
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

async function streamAstrBot(
  message: string,
  sessionId: string | undefined,
  username: string,
  send: Send,
  persona?: string,
): Promise<void> {
  const { url, key } = getAstrbotEnv();
  if (!url) throw new Error('astrbot: not configured');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (key) headers['Authorization'] = `Bearer ${key}`;
  const text = persona ? `[Roleplay as: ${persona}]\n\n${message}` : message;
  const payload: Record<string, unknown> = { message: text, username, enable_streaming: true };
  if (sessionId) payload.session_id = sessionId;

  const r = await fetch(`${url}/api/v1/chat`, {
    method: 'POST', headers, body: JSON.stringify(payload),
    signal: AbortSignal.timeout(OVERALL_TIMEOUT_MS),
  });
  if (!r.ok || !r.body) throw new Error(`astrbot: ${r.status}`);

  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let sentText = '';
  let plainBuf = '';
  const emitText = (full: string) => {
    const clean = cleanAstrBotText(full);
    if (!clean || clean === sentText) return;
    send(clean);
    sentText = clean;
  };

  // Per-read idle timeout: if AstrBot sends no data for IDLE_TIMEOUT_MS
  // the MCP server is likely dead; abort so the waterfall can try the next provider.
  async function readNext(): Promise<ReadableStreamReadResult<Uint8Array>> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new DOMException('Idle timeout', 'TimeoutError')), IDLE_TIMEOUT_MS);
    });
    try {
      const result = await Promise.race([reader.read(), timedOut]);
      return result as ReadableStreamReadResult<Uint8Array>;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  for (;;) {
    const { done, value } = await readNext();
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
      const toolMd = toolCallMarkdown(j);
      if (toolMd) {
        send(toolMd);
      } else if (j.chain_type === 'tool_call' || j.chain_type === 'tool_call_result') {
        // Tool JSON is transport metadata; render only the user-facing result.
      } else if (j.type === 'plain' && typeof j.data === 'string' && j.data) {
        plainBuf += j.data;
      } else if (j.type === 'complete' && typeof j.data === 'string') {
        emitText(j.data);
      } else if (typeof j.type === 'string' && ATTACH_SEGMENT_TYPES.has(j.type)) {
        const md = attachmentMarkdown(j);
        if (md) send(md);
      }
    }
  }
  if (!sentText && plainBuf) emitText(plainBuf);
}

async function streamCoze(
  message: string,
  userId: string,
  send: Send,
  cfg: EffectiveProvider,
  persona?: string,
): Promise<void> {
  const COZE_BASE = cfg.baseUrl.replace(/\/$/, '');
  const content = persona ? `[Roleplay as: ${persona}]\n\n${message}` : message;
  const r = await fetch(`${COZE_BASE}/v3/chat`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bot_id: cfg.botId,
      user_id: userId,
      stream: true,
      auto_save_history: false,
      additional_messages: [{ role: 'user', content, content_type: 'text' }],
    }),
    signal: AbortSignal.timeout(OVERALL_TIMEOUT_MS),
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

async function streamDeepSeek(
  message: string,
  send: Send,
  cfg: EffectiveProvider,
  persona?: string,
): Promise<void> {
  const messages = persona
    ? [{ role: 'system', content: persona }, { role: 'user', content: message }]
    : [{ role: 'user', content: message }];
  const r = await fetch(`${cfg.baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      stream: true,
    }),
    signal: AbortSignal.timeout(OVERALL_TIMEOUT_MS),
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

  if (!(await anyConfigured())) {
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
  const persona   = String(body.persona ?? '').trim().slice(0, 800) || undefined;
  const astrbotOnly = Boolean(body.astrbot_only);

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

  const [cozeCfg, deepseekCfg] = await Promise.all([
    getEffectiveProvider('coze'),
    getEffectiveProvider('deepseek'),
  ]);

  return makeSseStream(async (send) => {
    let emitted = false;
    const wrap: Send = (t) => { emitted = true; send(t); };

    const runners: Array<() => Promise<void>> = [];
    if (getAstrbotEnv().configured) runners.push(() => streamAstrBot(message, sessionId, username, wrap, persona));
    if (!astrbotOnly) {
      if (cozeCfg.configured) runners.push(() => streamCoze(message, sessionId ?? username, wrap, cozeCfg, persona));
      if (deepseekCfg.configured) runners.push(() => streamDeepSeek(message, wrap, deepseekCfg, persona));
    }
    if (runners.length === 0) { send('AstrBot is not connected yet — start the AstrBot service to chat here.'); return; }

    for (const run of runners) {
      try {
        await run();
        if (emitted) return;
      } catch {
        if (emitted) return;
      }
    }
    if (!emitted) send('AI is temporarily unavailable — try again in a moment.');
  });
}
