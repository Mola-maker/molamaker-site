// MATLAB Studio API — the GGB Math Studio pattern applied to MATLAB.
//
//   GET            → probe: is the MCP bridge configured/reachable, which
//                    official tools does it expose?
//   POST build     → stream an LLM-generated MATLAB script (SSE), parsing the
//                    ```matlab block server-side (matlabCode event).
//   POST repair    → same stream, but fixing a script against the engine's
//                    exact error text.
//   POST run       → execute code through the OFFICIAL MathWorks MCP server
//                    (matlab/matlab-mcp-core-server: evaluate_matlab_code).
//   POST toolboxes → detect_matlab_toolboxes via the same bridge.
//
// MATLAB_MCP_URL points at the official stdio binary behind any stdio→HTTP
// MCP gateway; MATLAB_MCP_TOKEN (optional) is sent as a Bearer token.

import { NextRequest } from 'next/server';

import { getWPSession } from '@/lib/workplace/session';
import { checkRate } from '@/lib/rate-limit';
import { clientIp } from '@/lib/client-ip';
import {
  getEffectiveProvider,
  PROVIDER_NAMES,
  type EffectiveProvider,
  type ProviderName,
} from '@/lib/workplace/settings';
import { chatCompletionsUrl } from '@/lib/workplace/openai-chat-url';
import { isSafeModelId, isThinkingModelId } from '@/lib/workplace/provider-models';
import {
  buildMatlabSystemPrompt,
  buildMatlabRepairPrompt,
  formatMatlabRepairContent,
  parseMatlabBlock,
  matlabCodeIsSafe,
} from '@/lib/workplace/matlab/reference';
import {
  MatlabMcpClient,
  MATLAB_MCP_TOOLS,
} from '@/lib/workplace/matlab/mcp-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Provider = ProviderName;
type Message = { role: 'user' | 'assistant'; content: string };

const MAX_TOKENS = 6144;
const TIMEOUT_MS = 150_000;

const MCP_URL = () => process.env.MATLAB_MCP_URL?.trim() || '';
const MCP_TOKEN = () => process.env.MATLAB_MCP_TOKEN?.trim() || undefined;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

// ── SSE plumbing (same shape the math route streams) ────────────────────────

type SendToken = (token: string) => void;
type SendEvent = (event: Record<string, unknown>) => void;

function makeSseStream(gen: (send: SendToken, sendEvent: SendEvent) => Promise<void>): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send: SendToken = (token) => {
        try { controller.enqueue(enc.encode(`data: ${JSON.stringify({ token })}\n\n`)); }
        catch { /* client disconnected */ }
      };
      const sendEvent: SendEvent = (event) => {
        try { controller.enqueue(enc.encode(`data: ${JSON.stringify(event)}\n\n`)); }
        catch { /* client disconnected */ }
      };
      try {
        await gen(send, sendEvent);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'stream failed';
        try { sendEvent({ error: message }); } catch { /* client gone */ }
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

async function readUpstreamError(r: Response): Promise<string> {
  try {
    const text = await r.text();
    if (!text) return '';
    try {
      const j = JSON.parse(text) as { error?: { message?: string } | string; message?: string };
      const msg = typeof j.error === 'string' ? j.error : (j.error?.message ?? j.message ?? '');
      return (msg || text).slice(0, 200);
    } catch {
      return text.slice(0, 200);
    }
  } catch {
    return '';
  }
}

async function streamAnthropic(
  messages: Message[], send: SendToken, cfg: EffectiveProvider, model: string, systemPrompt: string,
): Promise<string> {
  const r = await fetch(`${cfg.baseUrl.replace(/\/+$/, '')}/v1/messages`, {
    method: 'POST',
    headers: { 'anthropic-version': '2023-06-01', 'x-api-key': cfg.apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model, max_tokens: MAX_TOKENS, system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!r.ok || !r.body) throw new Error(`Anthropic ${r.status}：${await readUpstreamError(r)}`);
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let full = '';
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
      if (raw === '[DONE]') continue;
      try {
        const j = JSON.parse(raw) as { type?: string; delta?: { type?: string; text?: string } };
        if (j.type === 'content_block_delta' && j.delta?.type === 'text_delta' && j.delta.text) {
          send(j.delta.text);
          full += j.delta.text;
        }
      } catch { /* skip */ }
    }
  }
  if (!full.trim()) throw new Error('Anthropic: empty stream');
  return full;
}

async function streamOpenAICompatible(
  messages: Message[], send: SendToken, cfg: EffectiveProvider, model: string,
  provider: Provider, systemPrompt: string,
): Promise<string> {
  const body: Record<string, unknown> = {
    model,
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
    stream: true,
    max_tokens: MAX_TOKENS,
  };
  if (provider === 'dashscope' && !isThinkingModelId(model)) body.enable_thinking = false;

  const r = await fetch(chatCompletionsUrl(cfg.baseUrl), {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!r.ok || !r.body) throw new Error(`${provider} ${r.status}：${await readUpstreamError(r)}`);

  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let content = '';
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
      if (raw === '[DONE]') continue;
      try {
        const j = JSON.parse(raw) as { choices?: Array<{ delta?: { content?: string } }> };
        const tok = j.choices?.[0]?.delta?.content;
        if (tok) { send(tok); content += tok; }
      } catch { /* skip */ }
    }
  }
  if (!content.trim()) throw new Error(`${provider}: empty stream`);
  return content;
}

async function streamCoze(
  messages: Message[], send: SendToken, cfg: EffectiveProvider, systemPrompt: string,
): Promise<string> {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const r = await fetch(`${cfg.baseUrl}/v3/chat`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bot_id: cfg.botId,
      user_id: 'wp-matlab',
      stream: true,
      auto_save_history: false,
      additional_messages: [{
        role: 'user',
        content: `[MATLAB Studio — follow these rules]\n${systemPrompt}\n\n---\n\n${lastUser?.content ?? ''}`,
        content_type: 'text',
      }],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!r.ok || !r.body) throw new Error(`Coze ${r.status}：${await readUpstreamError(r)}`);
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let full = '';
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
      if (event === 'done') return full;
      if (event !== 'conversation.message.delta' || !dataLine) continue;
      try {
        const j = JSON.parse(dataLine.slice(5).trim()) as { role?: string; type?: string; content?: string };
        if (j.role === 'assistant' && j.type === 'answer' && j.content) { send(j.content); full += j.content; }
      } catch { /* skip */ }
    }
  }
  if (!full.trim()) throw new Error('Coze: empty stream');
  return full;
}

// ── GET: MCP bridge probe ────────────────────────────────────────────────────

export async function GET() {
  const session = await getWPSession();
  if (!session) return new Response('unauthenticated', { status: 401 });

  const url = MCP_URL();
  if (!url) return json({ configured: false });
  try {
    const client = new MatlabMcpClient(url, { token: MCP_TOKEN(), timeoutMs: 5_000 });
    const info = await client.initialize();
    const tools = await client.listTools();
    return json({
      configured: true,
      reachable: true,
      server: info,
      tools,
      canEvaluate: tools.includes(MATLAB_MCP_TOOLS.evaluate),
    });
  } catch (e) {
    return json({
      configured: true,
      reachable: false,
      error: e instanceof Error ? e.message : 'bridge unreachable',
    });
  }
}

// ── POST: build / repair / run / toolboxes ──────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getWPSession();
  if (!session) return new Response('unauthenticated', { status: 401 });

  let body: {
    mode?: 'build' | 'repair' | 'run' | 'toolboxes';
    problem?: string;
    history?: Message[];
    code?: string;
    errorText?: string;
    provider?: Provider;
    model?: string;
  };
  try {
    body = await req.json() as typeof body;
  } catch {
    return new Response('invalid json', { status: 400 });
  }

  const mode = body.mode ?? 'build';
  const ip = await clientIp();

  // ── run / toolboxes: straight through the official MCP server ────────────
  if (mode === 'run' || mode === 'toolboxes') {
    const rate = await checkRate(`matlab-run:${ip}`, 20, 60_000);
    if (!rate.allowed) return new Response('rate limited', { status: 429 });

    const url = MCP_URL();
    if (!url) return json({ error: { code: 'not_configured', message: 'MATLAB_MCP_URL 未配置 — 复制脚本到 MATLAB Online 运行，或配置官方 MCP 桥接' } }, 503);

    try {
      if (mode === 'toolboxes') {
        const client = new MatlabMcpClient(url, { token: MCP_TOKEN(), timeoutMs: 30_000 });
        await client.initialize();
        const result = await client.callTool(MATLAB_MCP_TOOLS.toolboxes, {});
        return json({ data: { output: result.text, isError: result.isError } });
      }
      const code = (body.code ?? '').trim();
      if (!code) return new Response('code required', { status: 400 });
      if (!matlabCodeIsSafe(code)) {
        return json({ error: { code: 'unsafe', message: '脚本包含被禁用的系统/文件操作（system、delete、web…），已拦截' } }, 400);
      }
      const client = new MatlabMcpClient(url, { token: MCP_TOKEN(), timeoutMs: 90_000 });
      await client.initialize();
      const result = await client.callTool(MATLAB_MCP_TOOLS.evaluate, { code });
      // Inline figure retrieval: the prompt contract makes plotting scripts
      // end with exportgraphics(gcf,"mola_fig.png"). Pull it back as base64
      // through the same MCP session, then clean up. Internal command — not
      // user code, so the delete here is ours and safe.
      let figure: string | null = null;
      if (!result.isError && /exportgraphics|saveas|print\s*\(/.test(code)) {
        try {
          const fig = await client.callTool(MATLAB_MCP_TOOLS.evaluate, {
            code: "if exist('mola_fig.png','file'), fid=fopen('mola_fig.png','rb'); b=fread(fid,inf,'*uint8')'; fclose(fid); disp(['MOLAFIG:' matlab.net.base64encode(b)]); delete('mola_fig.png'); end",
          });
          const m = fig.text.match(/MOLAFIG:([A-Za-z0-9+/=\s]+)/);
          if (m) figure = m[1].replace(/\s+/g, '');
        } catch { /* no figure — text output stands alone */ }
      }
      return json({ data: { output: result.text, isError: result.isError, figure } });
    } catch (e) {
      return json({ error: { code: 'mcp_failed', message: e instanceof Error ? e.message : 'MCP bridge failed' } }, 502);
    }
  }

  // ── build / repair: LLM stream ────────────────────────────────────────────
  const rate = await checkRate(`matlab:${ip}`, 20, 60_000);
  if (!rate.allowed) return new Response('rate limited', { status: 429 });

  const provider = body.provider as Provider;
  if (!provider || !PROVIDER_NAMES.includes(provider)) return new Response('invalid provider', { status: 400 });
  const cfg = await getEffectiveProvider(provider);
  if (!cfg.configured) return json({ error: 'provider not configured' }, 503);

  const requestedModel = typeof body.model === 'string' ? body.model.trim() : '';
  const model = provider === 'coze' ? cfg.botId : (requestedModel || cfg.model);
  if (provider !== 'coze' && !isSafeModelId(model)) return json({ error: 'invalid model' }, 400);

  let messages: Message[];
  let systemPrompt: string;

  if (mode === 'repair') {
    const code = (body.code ?? '').trim();
    const errorText = (body.errorText ?? '').trim();
    if (!code || !errorText) return new Response('code and errorText required', { status: 400 });
    systemPrompt = buildMatlabRepairPrompt();
    messages = [{ role: 'user', content: formatMatlabRepairContent(code, errorText) }];
  } else {
    const problem = (body.problem ?? '').trim();
    if (!problem) return new Response('problem required', { status: 400 });
    systemPrompt = buildMatlabSystemPrompt();
    const history = (Array.isArray(body.history) ? body.history : []).slice(-12);
    messages = [...history, { role: 'user', content: problem }];
  }

  return makeSseStream(async (send, sendEvent) => {
    sendEvent({ model: provider === 'coze' ? `coze:${cfg.botId}` : model, mode });
    const fullText = provider === 'anthropic'
      ? await streamAnthropic(messages, send, cfg, model, systemPrompt)
      : provider === 'coze'
        ? await streamCoze(messages, send, cfg, systemPrompt)
        : await streamOpenAICompatible(messages, send, cfg, model, provider, systemPrompt);
    const code = parseMatlabBlock(fullText);
    sendEvent({ matlabCode: { code, safe: matlabCodeIsSafe(code) } });
  });
}
