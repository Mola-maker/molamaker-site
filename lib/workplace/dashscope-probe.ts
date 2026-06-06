import type { EffectiveProvider } from '@/lib/workplace/settings';
import { chatCompletionsUrl } from '@/lib/workplace/openai-chat-url';
import { dashscopeModelMeta, dashscopeAcceptsThinkingToggle } from '@/lib/workplace/dashscope-models';

export type DashscopeProbeResult = {
  ok: boolean;
  ms: number;
  status?: number;
  error?: string;
};

/** Lightweight connectivity check — one non-stream token. */
export async function probeDashscopeModel(
  cfg: EffectiveProvider,
  model: string,
): Promise<DashscopeProbeResult> {
  const start = Date.now();
  if (!cfg.apiKey) {
    return { ok: false, ms: 0, error: 'no api key' };
  }
  const meta = dashscopeModelMeta(model);
  const body: Record<string, unknown> = {
    model,
    messages: [{ role: 'user', content: 'ping' }],
    max_tokens: 1,
    stream: false,
  };
  // Qwen3 / QwQ default to thinking mode; disable unless the catalog marks thinking.
  // DeepSeek-on-DashScope rejects enable_thinking, which previously made the probe
  // 400 and wrongly mark those models unavailable in the picker.
  if (dashscopeAcceptsThinkingToggle(model) && !meta?.thinking) {
    body.enable_thinking = false;
  }
  try {
    const r = await fetch(chatCompletionsUrl(cfg.baseUrl), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12_000),
    });
    const ms = Date.now() - start;
    if (r.ok) return { ok: true, ms, status: r.status };
    let detail = '';
    try {
      const j = await r.json() as { error?: { message?: string } };
      detail = j.error?.message ?? '';
    } catch { /* ignore */ }
    return {
      ok: false,
      ms,
      status: r.status,
      error: detail || `HTTP ${r.status}`,
    };
  } catch (e) {
    return {
      ok: false,
      ms: Date.now() - start,
      error: e instanceof Error ? e.message : 'fetch failed',
    };
  }
}

/** Probe catalog models with bounded concurrency. */
export async function probeDashscopeCatalog(
  cfg: EffectiveProvider,
  modelIds: string[],
  concurrency = 3,
): Promise<Record<string, DashscopeProbeResult>> {
  const out: Record<string, DashscopeProbeResult> = {};
  const queue = [...modelIds];
  async function worker() {
    for (;;) {
      const id = queue.shift();
      if (!id) return;
      out[id] = await probeDashscopeModel(cfg, id);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, modelIds.length) }, () => worker()),
  );
  return out;
}
