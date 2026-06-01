import { NextRequest } from 'next/server';
import { getWPSession } from '@/lib/workplace/session';
import { checkRate } from '@/lib/rate-limit';
import { clientIp } from '@/lib/client-ip';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Provider = 'anthropic' | 'deepseek' | 'coze';
type Message = { role: 'user' | 'assistant'; content: string };

const SYSTEM_PROMPT = `You are a math assistant specialising in geometry, algebra, and calculus.
When the user describes a problem:
1. Give a concise explanation (2-5 sentences).
2. If the problem has a geometric component, output a GeoGebra script block:

\`\`\`geogebra
<commands, one per line, valid GeoGebra evalCommand syntax>
\`\`\`

Rules for the geogebra block:
- Use only evalCommand-compatible syntax (no XML, no JSON)
- Define points as A=(x,y), segments as Segment(A,B), circles as Circle(center,radius)
- Label key objects so they appear in the algebra view
- Keep it under 30 commands
- If the problem is purely algebraic (no geometry), omit the block entirely`;

function makeSseStream(gen: (send: (token: string) => void) => Promise<void>): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (token: string) => {
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

async function streamAnthropic(messages: Message[], send: (t: string) => void): Promise<void> {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'anthropic-version': '2023-06-01',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!r.ok || !r.body) throw new Error(`Anthropic ${r.status}`);

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
        const j = JSON.parse(raw) as {
          type?: string;
          delta?: { type?: string; text?: string };
        };
        if (j.type === 'content_block_delta' && j.delta?.type === 'text_delta' && j.delta.text) {
          send(j.delta.text);
        }
      } catch { /* skip malformed chunk */ }
    }
  }
}

async function streamDeepSeek(messages: Message[], send: (t: string) => void): Promise<void> {
  const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY!}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      stream: true,
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!r.ok || !r.body) throw new Error(`DeepSeek ${r.status}`);

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

async function streamCoze(messages: Message[], send: (t: string) => void): Promise<void> {
  const base = process.env.COZE_BASE_URL ?? 'https://api.coze.cn';
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const problem = lastUser?.content ?? '';

  const r = await fetch(`${base}/v3/chat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.COZE_API_KEY!}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      bot_id: process.env.COZE_BOT_ID!,
      user_id: 'wp-math',
      stream: true,
      auto_save_history: false,
      additional_messages: [
        { role: 'user', content: problem, content_type: 'text' },
      ],
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!r.ok || !r.body) throw new Error(`Coze ${r.status}`);

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
      const eventLine = lines.find((l) => l.startsWith('event:'));
      const dataLine = lines.find((l) => l.startsWith('data:'));
      const event = eventLine?.slice(6).trim();
      if (event === 'done') return;
      if (event !== 'conversation.message.delta') continue;
      if (!dataLine) continue;
      const raw = dataLine.slice(5).trim();
      try {
        const j = JSON.parse(raw) as {
          role?: string; type?: string; content?: string;
        };
        if (j.role === 'assistant' && j.type === 'answer' && j.content) send(j.content);
      } catch { /* skip malformed chunk */ }
    }
  }
}

export async function POST(req: NextRequest) {
  const session = await getWPSession();
  if (!session) return new Response('unauthenticated', { status: 401 });

  const ip = await clientIp();
  const rate = await checkRate(`math:${ip}`, 20, 60_000);
  if (!rate.allowed) {
    return new Response('rate limited', {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil(rate.resetMs / 1000)) },
    });
  }

  let body: { problem: string; history: Message[]; provider: Provider };
  try {
    body = await req.json() as { problem: string; history: Message[]; provider: Provider };
  } catch {
    return new Response('invalid json', { status: 400 });
  }

  const { problem, history, provider } = body;
  if (!problem?.trim()) return new Response('problem required', { status: 400 });
  if (!['anthropic', 'deepseek', 'coze'].includes(provider)) {
    return new Response('invalid provider', { status: 400 });
  }

  const missing =
    (provider === 'anthropic' && !process.env.ANTHROPIC_API_KEY) ||
    (provider === 'deepseek' && !process.env.DEEPSEEK_API_KEY) ||
    (provider === 'coze' && (!process.env.COZE_API_KEY || !process.env.COZE_BOT_ID));
  if (missing) {
    return new Response(JSON.stringify({ error: 'provider not configured' }), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    });
  }

  const messages: Message[] = (Array.isArray(history) ? history : []).slice(-20);

  return makeSseStream(async (send) => {
    if (provider === 'anthropic') await streamAnthropic(messages, send);
    else if (provider === 'deepseek') await streamDeepSeek(messages, send);
    else await streamCoze(messages, send);
  });
}
