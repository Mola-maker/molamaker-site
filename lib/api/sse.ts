// SSE factory shared by chat/stream and workplace/math routes

export type Send = (token: string) => void;

// ── Timeouts ───────────────────────────────────────────────────────
// AstrBot MCP tools have a 120 s timeout each, and the agent may call
// several tools sequentially.  A fixed total-timeout would kill the
// proxy mid-tool-loop even when AstrBot is making progress (sending
// tool_call frames every few seconds).  Instead we use a generous
// overall timeout as a safety net, and a per-read idle timeout that
// resets on every received SSE frame.

/** Per-read idle timeout — just over AstrBot's 120 s MCP tool timeout. */
export const IDLE_TIMEOUT_MS = 130_000;

/** Overall connection timeout — safety net for truly hung connections. */
export const OVERALL_TIMEOUT_MS = 600_000;

export function makeSseStream(gen: (send: Send) => Promise<void>): Response {
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
