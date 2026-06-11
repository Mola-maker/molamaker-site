'use client';

// MATLAB Studio — the GGB Math Studio pattern applied to MATLAB, LLM-powered,
// executed through the OFFICIAL MathWorks MCP server.
//
//   chat (left)     describe a computation → the model streams one runnable
//                   base-MATLAB script (curated function reference injected)
//   code (centre)   the parsed ```matlab block, editable in place
//   console (right) ▶ 运行 sends the script through MATLAB_MCP_URL —
//                   the official matlab-mcp-core-server's evaluate_matlab_code
//                   tool — and prints the real engine output; an engine error
//                   offers a one-click LLM repair (same loop as GeoGebra)
//
// Without the MCP bridge everything still works minus execution: copy the
// script or take it straight to the visitor's free MATLAB Online account.

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MATLAB_ONLINE_URL, parseMatlabBlock } from '@/lib/workplace/matlab/reference';

type Provider = 'anthropic' | 'deepseek' | 'dashscope' | 'coze';
const PROVIDER_ORDER: Provider[] = ['anthropic', 'deepseek', 'dashscope', 'coze'];
const PROVIDER_LABELS: Record<Provider, string> = {
  anthropic: 'Anthropic', deepseek: 'DeepSeek', dashscope: 'DashScope', coze: 'Coze',
};
const MODEL_STORAGE_KEY = 'wp-matlab-model';

type Message = { role: 'user' | 'assistant'; content: string };
type ModelRow = { id: string; ok?: boolean };
type McpStatus =
  | { state: 'probing' }
  | { state: 'off' }
  | { state: 'down'; error: string }
  | { state: 'up'; tools: string[]; canEvaluate: boolean; server?: { name: string; version: string } };

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function WorkplaceMatlab() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [providers, setProviders] = useState<Provider[]>([]);
  const [provider, setProvider] = useState<Provider>('anthropic');
  const [models, setModels] = useState<ModelRow[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [activeModel, setActiveModel] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState('');

  const [code, setCode] = useState('');
  const [output, setOutput] = useState('');
  const [outputIsError, setOutputIsError] = useState(false);
  const [figure, setFigure] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mcp, setMcp] = useState<McpStatus>({ state: 'probing' });

  const chatRef = useRef<HTMLDivElement>(null);
  const sendingRef = useRef(false);

  // ── probes ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    fetch('/api/workplace/math/providers')
      .then((r) => r.json())
      .then((j: { available?: string[] }) => {
        const list = (j.available ?? []).filter((p): p is Provider => PROVIDER_ORDER.includes(p as Provider));
        setProviders(list);
        if (list.length && !list.includes(provider)) setProvider(list[0]);
      })
      .catch(() => {});
    fetch('/api/workplace/matlab')
      .then((r) => r.json())
      .then((j: { configured?: boolean; reachable?: boolean; tools?: string[]; canEvaluate?: boolean; server?: { name: string; version: string }; error?: string }) => {
        if (!j.configured) setMcp({ state: 'off' });
        else if (!j.reachable) setMcp({ state: 'down', error: j.error ?? 'unreachable' });
        else setMcp({ state: 'up', tools: j.tools ?? [], canEvaluate: !!j.canEvaluate, server: j.server });
      })
      .catch(() => setMcp({ state: 'off' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // model list per provider (reuses the math studio's probe endpoint)
  useEffect(() => {
    if (!open || provider === 'coze' || !providers.includes(provider)) return;
    let cancelled = false;
    fetch(`/api/workplace/math/models?provider=${encodeURIComponent(provider)}`)
      .then((r) => r.json())
      .then((j: { models?: ModelRow[]; defaultModel?: string }) => {
        if (cancelled) return;
        const list = j.models ?? [];
        setModels(list);
        const stored = localStorage.getItem(`${MODEL_STORAGE_KEY}:${provider}`);
        const pick = (stored && list.some((m) => m.id === stored)) ? stored : (j.defaultModel || list[0]?.id || '');
        setSelectedModel(pick);
      })
      .catch(() => { if (!cancelled) setModels([]); });
    return () => { cancelled = true; };
  }, [open, provider, providers]);

  useEffect(() => {
    if (selectedModel) try { localStorage.setItem(`${MODEL_STORAGE_KEY}:${provider}`, selectedModel); } catch { /* ignore */ }
  }, [selectedModel, provider]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open]);

  // ── LLM stream (build / repair share the SSE shape) ──────────────
  const streamMatlab = useCallback(async (
    payload: Record<string, unknown>,
    onToken: (full: string) => void,
  ): Promise<{ code: string; fullText: string; serverError: string }> => {
    const r = await fetch('/api/workplace/matlab', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!r.ok || !r.body) {
      const j = await r.json().catch(() => ({})) as { error?: string };
      throw new Error(typeof j.error === 'string' ? j.error : `HTTP ${r.status}`);
    }
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let fullText = '';
    let parsedCode: string | null = null;
    let serverError = '';
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
          const frame = JSON.parse(raw) as {
            token?: string; model?: string; error?: string;
            matlabCode?: { code: string; safe: boolean };
          };
          if (typeof frame.model === 'string') { setActiveModel(frame.model); continue; }
          if (typeof frame.error === 'string' && frame.error) { serverError = frame.error; continue; }
          if (frame.matlabCode) { parsedCode = frame.matlabCode.code; continue; }
          if (typeof frame.token === 'string') { fullText += frame.token; onToken(fullText); }
        } catch { /* skip malformed frame */ }
      }
    }
    return { code: parsedCode ?? parseMatlabBlock(fullText), fullText, serverError };
  }, []);

  const send = useCallback(async () => {
    const problem = input.trim();
    if (!problem || streaming || sendingRef.current) return;
    if (provider !== 'coze' && !selectedModel) { setError('请先选择模型'); return; }
    sendingRef.current = true;
    setStreaming(true);
    setError('');
    setInput('');
    const history = messages.slice(-12);
    setMessages((m) => [...m, { role: 'user', content: problem }, { role: 'assistant', content: '' }]);
    try {
      const res = await streamMatlab(
        { mode: 'build', problem, history, provider, model: selectedModel },
        (txt) => setMessages((m) => [...m.slice(0, -1), { role: 'assistant', content: txt }]),
      );
      if (res.serverError) setError(`模型/接口错误：${res.serverError}`);
      if (res.code) { setCode(res.code); setOutput(''); setOutputIsError(false); }
      else if (!res.serverError) setError('未能从回复中解析出 ```matlab 代码块，请重试。');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setMessages((m) => m.slice(0, -1));
    } finally {
      setStreaming(false);
      sendingRef.current = false;
    }
  }, [input, streaming, provider, selectedModel, messages, streamMatlab]);

  // ── run via the official MCP bridge ───────────────────────────────
  const run = useCallback(async (codeOverride?: string) => {
    const src = (codeOverride ?? code).trim();
    if (!src || running) return;
    setRunning(true);
    setOutput('');
    setOutputIsError(false);
    setFigure(null);
    try {
      const r = await fetch('/api/workplace/matlab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'run', code: src }),
      });
      const j = await r.json().catch(() => ({})) as {
        data?: { output: string; isError: boolean; figure?: string | null };
        error?: { message?: string };
      };
      if (!r.ok || !j.data) {
        setOutput(j.error?.message ?? `HTTP ${r.status}`);
        setOutputIsError(true);
      } else {
        setOutput(j.data.output || (j.data.figure ? '' : '(无输出)'));
        setOutputIsError(j.data.isError);
        if (j.data.figure) setFigure(j.data.figure);
      }
    } catch (e) {
      setOutput(e instanceof Error ? e.message : 'run failed');
      setOutputIsError(true);
    } finally {
      setRunning(false);
    }
  }, [code, running]);

  /** Engine error → one LLM repair round, then re-run. Same loop as GGB. */
  const repairAndRerun = useCallback(async () => {
    if (!code.trim() || !output.trim() || repairing) return;
    setRepairing(true);
    setError('');
    try {
      const res = await streamMatlab(
        { mode: 'repair', code, errorText: output, provider, model: selectedModel },
        () => {},
      );
      if (res.code) {
        setCode(res.code);
        await run(res.code);
      } else {
        setError(res.serverError || '修复失败：未返回代码块');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'repair failed');
    } finally {
      setRepairing(false);
    }
  }, [code, output, repairing, provider, selectedModel, streamMatlab, run]);

  const showToolboxes = useCallback(async () => {
    setRunning(true);
    setOutputIsError(false);
    try {
      const r = await fetch('/api/workplace/matlab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'toolboxes' }),
      });
      const j = await r.json().catch(() => ({})) as { data?: { output: string }; error?: { message?: string } };
      setOutput(j.data?.output ?? j.error?.message ?? 'failed');
    } finally {
      setRunning(false);
    }
  }, []);

  const copyCode = useCallback(async () => {
    if (!code.trim()) return;
    if (await copyText(code)) { setCopied(true); setTimeout(() => setCopied(false), 1500); }
  }, [code]);

  const canRun = mcp.state === 'up' && mcp.canEvaluate;
  const mcpChip = mcp.state === 'up'
    ? `MCP ✓ ${mcp.server?.name ?? ''}`.trim()
    : mcp.state === 'down' ? 'MCP 离线' : mcp.state === 'off' ? 'MCP 未配置' : 'MCP…';

  return (
    <>
      <div
        className="wp-tile wp-tile--matlab"
        onClick={() => { setMounted(true); setOpen(true); }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setMounted(true); setOpen(true); } }}
      >
        <div className="wp-tile__head">
          <span className="wp-tile__name">MATLAB</span>
          <span className="wp-tile__status">
            <span className={`wp-tile__dot ${mcp.state === 'up' ? 'wp-tile__dot--live' : ''}`} />
            llm × mcp
          </span>
        </div>
        <div className="wp-tile__desc">
          Describe a computation and get one runnable MATLAB script — executed
          through the official MathWorks MCP server, or pasted into your free
          MATLAB Online.
        </div>
      </div>

      {mounted && typeof document !== 'undefined' && createPortal(
        <div className={`wp-studio wp-matlab-studio${open ? ' is-open' : ''}`} aria-hidden={!open}>
          {open && (
            <>
              <aside className="wp-matlab__side">
                <div className="wp-matlab__side-head">
                  <span className="wp-matlab__logo">MATLAB Studio</span>
                  <span className={`wp-matlab__mcp wp-matlab__mcp--${mcp.state}`} title={mcp.state === 'down' ? mcp.error : mcp.state === 'up' ? (mcp.tools.join(', ') || 'tools') : '设置 MATLAB_MCP_URL 后可直接运行'}>
                    {mcpChip}
                  </span>
                </div>

                <div className="wp-math__providers">
                  {PROVIDER_ORDER.map((p) => {
                    const available = providers.includes(p);
                    return (
                      <button
                        key={p}
                        className={`wp-math__pill${provider === p && available ? ' wp-math__pill--active' : ''}`}
                        onClick={() => available && setProvider(p)}
                        disabled={!available}
                      >{PROVIDER_LABELS[p]}</button>
                    );
                  })}
                </div>
                {provider !== 'coze' && (
                  <select
                    className="wp-math__model-select"
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    aria-label="模型"
                  >
                    {models.map((m) => <option key={m.id} value={m.id}>{m.id}</option>)}
                  </select>
                )}

                <div className="wp-matlab__chat" ref={chatRef}>
                  {messages.length === 0 && (
                    <p className="wp-matlab__empty">
                      描述一个计算 / 仿真 / 绘图任务，例如：<br />
                      {'「画出阻尼振动 x″+0.4x′+4x=0 的相图」'}<br />
                      「拟合这些点并画残差…」
                    </p>
                  )}
                  {messages.map((m, i) => (
                    <div key={i} className={`wp-matlab__msg wp-matlab__msg--${m.role}`}>
                      {m.content || (streaming && i === messages.length - 1 ? '…' : '')}
                    </div>
                  ))}
                </div>

                {error && <div className="wp-matlab__error">⚠ {error}</div>}

                <div className="wp-math__input-row">
                  <textarea
                    className="wp-math__textarea"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                    placeholder="要计算/绘制什么？（Enter 发送）"
                    rows={2}
                    disabled={streaming}
                  />
                  <button className="wp-math__send" onClick={send} disabled={streaming || !input.trim()}>
                    {streaming ? '…' : '↵'}
                  </button>
                </div>
              </aside>

              <div className="wp-matlab__main">
                <div className="wp-studio__stage-bar">
                  <span className="wp-studio__stage-label">
                    MATLAB{activeModel ? ` · ${activeModel}` : ''}
                  </span>
                  <span className="wp-studio__stage-tools">
                    <button type="button" className="wp-studio__magic" onClick={() => run()} disabled={!canRun || !code.trim() || running}
                      title={canRun ? '通过官方 MCP（evaluate_matlab_code）在真实 MATLAB 引擎中运行' : 'MCP 桥未配置 — 复制到 MATLAB Online 运行'}>
                      {running ? '运行中…' : '▶ 运行'}
                    </button>
                    {outputIsError && output.trim() && (
                      <button type="button" className="wp-studio__steps-toggle" onClick={repairAndRerun} disabled={repairing}
                        title="把引擎报错发给模型修复后重跑">
                        {repairing ? '修复中…' : '🔧 修复并重跑'}
                      </button>
                    )}
                    <button type="button" className="wp-studio__steps-toggle" onClick={copyCode} disabled={!code.trim()}>
                      {copied ? '已复制 ✓' : '复制脚本'}
                    </button>
                    <button type="button" className="wp-studio__steps-toggle" onClick={() => window.open(MATLAB_ONLINE_URL, '_blank', 'noopener')}
                      title="打开 MATLAB Online（免费账户），粘贴脚本即可运行">
                      ⬆ MATLAB Online
                    </button>
                    {canRun && (
                      <button type="button" className="wp-studio__steps-toggle" onClick={showToolboxes} disabled={running}
                        title="detect_matlab_toolboxes — 列出已装 MATLAB 与工具箱">
                        工具箱
                      </button>
                    )}
                    <button className="wp-studio__close" onClick={() => setOpen(false)} aria-label="Close MATLAB studio">×</button>
                  </span>
                </div>

                <div className="wp-matlab__panes">
                  <div className="wp-matlab__pane">
                    <div className="wp-matlab__pane-label">script.m {code && !running ? '· 可编辑' : ''}</div>
                    <textarea
                      className="wp-matlab__code"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="% 模型生成的 MATLAB 脚本会出现在这里"
                      spellCheck={false}
                      aria-label="MATLAB 脚本"
                    />
                  </div>
                  <div className="wp-matlab__pane">
                    <div className="wp-matlab__pane-label">
                      console {outputIsError ? '· ⚠ 引擎报错' : ''}{figure ? ' · 📈 图像' : ''}
                    </div>
                    {figure && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        className="wp-matlab__figure"
                        src={`data:image/png;base64,${figure}`}
                        alt="MATLAB figure"
                      />
                    )}
                    <pre className={`wp-matlab__console${outputIsError ? ' is-error' : ''}`}>
                      {output || (canRun
                        ? '▶ 运行后，真实 MATLAB 引擎的输出会显示在这里。'
                        : '未配置 MCP 桥：\n1. 下载官方 matlab-mcp-core-server（github.com/matlab/matlab-mcp-core-server）\n2. 用任意 stdio→HTTP MCP 网关暴露它（如 supergateway）\n3. 设置环境变量 MATLAB_MCP_URL\n\n或：复制脚本 → ⬆ MATLAB Online（免费账户）粘贴运行。')}
                    </pre>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
