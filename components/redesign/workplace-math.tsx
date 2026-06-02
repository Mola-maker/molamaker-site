'use client';

// Workplace — Math assistant with live GeoGebra canvas.
// Left pane: provider selector + chat (streaming SSE).
// Right pane: GeoGebra geometry applet (commands accumulate across turns).

import { useState, useEffect, useRef, useCallback } from 'react';

type Provider = 'anthropic' | 'deepseek' | 'coze';
type Message = { role: 'user' | 'assistant'; content: string };
type GGBApi = { evalCommand: (cmd: string) => void };

const PROVIDER_LABELS: Record<Provider, string> = {
  anthropic: 'Anthropic',
  deepseek: 'DeepSeek',
  coze: 'Coze',
};

const GGB_CONTAINER_ID = 'wp-ggb-applet';

// GeoGebra deploy-script sources, tried in order. A self-hosted mirror
// (NEXT_PUBLIC_GEOGEBRA_BASE_URL — point it at the unzipped bundle's `GeoGebra/`
// folder, which holds deployggb.js + HTML5/5.0/web3d/) is preferred because
// cdn.geogebra.org is slow/blocked in mainland China; the public CDNs stay as
// automatic fallbacks. The CDN's deployggb.js auto-resolves its codebase, but
// the bundle's does NOT — so for a self-hosted source we pin it via
// setHTML5Codebase (see setupApplet). Layout/hosting: deploy/geogebra/SETUP.md.
const GGB_SELF = process.env.NEXT_PUBLIC_GEOGEBRA_BASE_URL?.replace(/\/+$/, '');
const GGB_SOURCES: Array<{ url: string; selfHosted: boolean }> = [
  ...(GGB_SELF ? [{ url: GGB_SELF, selfHosted: true }] : []),
  { url: 'https://cdn.geogebra.org/apps', selfHosted: false },
  { url: 'https://www.geogebra.org/apps', selfHosted: false },
];

function parseGgbBlock(text: string): string[] {
  const m = text.match(/```geogebra\n([\s\S]*?)```/m);
  if (!m) return [];
  return m[1].trim().split('\n').map((l) => l.trim()).filter(Boolean);
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 10,
    }}>
      <div style={{
        maxWidth: '85%',
        padding: '9px 13px',
        borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
        background: isUser ? 'var(--accent)' : 'var(--bg-elev)',
        border: isUser ? 'none' : '1px solid var(--rule)',
        color: isUser ? 'var(--bg)' : 'var(--ink)',
        fontFamily: 'var(--font-mono, monospace)',
        fontSize: 12,
        lineHeight: 1.65,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {msg.content || <span style={{ opacity: 0.5 }}>…</span>}
      </div>
    </div>
  );
}

export function WorkplaceMath() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [provider, setProvider] = useState<Provider>('anthropic');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [ggbReady, setGgbReady] = useState(false);
  const [ggbError, setGgbError] = useState<string | null>(null);
  const [ggbAttempt, setGgbAttempt] = useState(0);
  const [error, setError] = useState('');

  const apiRef = useRef<GGBApi | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  // Load available providers
  useEffect(() => {
    fetch('/api/workplace/math/providers')
      .then((r) => r.json())
      .then((j: { available?: string[] }) => {
        const avail = (j.available ?? []) as Provider[];
        setProviders(avail);
        if (avail.length > 0 && !avail.includes(provider)) {
          setProvider(avail[0]);
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll chat to bottom when messages change
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  // Load the GeoGebra applet from the first reachable source in GGB_SOURCES,
  // auto-advancing on a failed/slow source (15s timeout + onerror) and surfacing
  // a retryable error only once every source is exhausted — so it never hangs on
  // "Loading GeoGebra…". Re-runs when ggbAttempt changes (each value = one source).
  useEffect(() => {
    const win = window as Window & {
      GGBApplet?: new (params: Record<string, unknown>, html5: boolean) => {
        inject: (id: string) => void;
        setHTML5Codebase?: (path: string) => void;
      };
    };
    const source = GGB_SOURCES[ggbAttempt];
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    // Move to the next source, or report failure once all are exhausted.
    const fail = () => {
      if (cancelled) return;
      if (timer) clearTimeout(timer);
      if (ggbAttempt + 1 < GGB_SOURCES.length) setGgbAttempt(ggbAttempt + 1);
      else setGgbError('Could not load GeoGebra from any source. Check your network/region, then retry.');
    };

    const setupApplet = () => {
      if (cancelled) return;
      if (!win.GGBApplet || !source) { fail(); return; }
      try {
        const container = document.getElementById(GGB_CONTAINER_ID);
        if (container) container.innerHTML = ''; // clean slate on retry
        const applet = new win.GGBApplet({
          appName: 'geometry',
          width: 600,
          height: 500,
          showToolBar: true,
          showAlgebraInput: true,
          showMenuBar: false,
          enableRightClick: false,
          appletOnLoad: (api: GGBApi) => {
            if (cancelled) return;
            if (timer) clearTimeout(timer);
            apiRef.current = api;
            setGgbReady(true);
            setGgbError(null);
          },
        }, true);
        // Self-hosted bundle: pin the app codebase to the mirror (the bundle's
        // deployggb.js doesn't auto-resolve like the CDN's does).
        if (source.selfHosted && typeof applet.setHTML5Codebase === 'function') {
          applet.setHTML5Codebase(`${source.url}/HTML5/5.0/web3d/`);
        }
        applet.inject(GGB_CONTAINER_ID);
      } catch {
        fail();
      }
    };

    // Fail-safe: if this source hasn't initialized in 15s, advance / show retry.
    timer = setTimeout(() => {
      if (!cancelled && !apiRef.current) fail();
    }, 15_000);

    if (win.GGBApplet) {
      // deployggb.js already loaded from an earlier source — reuse it.
      setupApplet();
    } else if (!source) {
      fail();
    } else {
      // Fresh <script> each attempt so advancing/retry actually re-fetches.
      document.getElementById('ggb-deploy-script')?.remove();
      const script = document.createElement('script');
      script.id = 'ggb-deploy-script';
      script.src = `${source.url}/deployggb.js`;
      script.onload = setupApplet;
      script.onerror = fail;
      document.head.appendChild(script);
    }

    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [ggbAttempt]);

  const retryGgb = useCallback(() => {
    setGgbError(null);
    setGgbReady(false);
    setGgbAttempt(0); // restart from the preferred (self-hosted) source
  }, []);

  const applyCommands = useCallback((text: string) => {
    const cmds = parseGgbBlock(text);
    if (!cmds.length || !apiRef.current) return;
    for (const cmd of cmds) {
      try { apiRef.current.evalCommand(cmd); }
      catch { /* invalid command — skip */ }
    }
  }, []);

  const send = useCallback(async () => {
    const problem = input.trim();
    if (!problem || streaming) return;
    setInput('');
    setError('');

    const history: Message[] = [...messages, { role: 'user', content: problem }];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setStreaming(true);

    let fullText = '';
    try {
      const r = await fetch('/api/workplace/math', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problem, history, provider }),
      });
      if (!r.ok || !r.body) {
        const j = await r.json().catch(() => ({})) as { error?: string };
        throw new Error(j.error ?? `HTTP ${r.status}`);
      }

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
          if (!part.startsWith('data: ')) continue;
          const raw = part.slice(6).trim();
          if (raw === '[DONE]') break;
          try {
            const { token } = JSON.parse(raw) as { token: string };
            fullText += token;
            setMessages((m) => {
              const last = m[m.length - 1];
              return [...m.slice(0, -1), { ...last, content: fullText }];
            });
          } catch { /* skip malformed SSE frame */ }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      setMessages((m) => m.slice(0, -1));
    } finally {
      setStreaming(false);
      if (fullText) applyCommands(fullText);
    }
  }, [input, streaming, messages, provider, applyCommands]);

  const resetCanvas = useCallback(() => {
    apiRef.current?.evalCommand('DeleteAll()');
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    setError('');
  }, []);

  return (
    <div className="wp-math">
      <div className="wp-section-label">
        <span>Math</span>
        <span style={{ fontSize: '9.5px', color: 'var(--ink-soft)' }}>
          geometry · GeoGebra
        </span>
      </div>

      <div className="wp-math__layout">
        {/* ── Left: Chat pane ───────────────────────────── */}
        <div className="wp-math__chat">
          {/* Provider selector */}
          <div className="wp-math__providers">
            {(['anthropic', 'deepseek', 'coze'] as Provider[]).map((p) => {
              const available = providers.includes(p);
              return (
                <button
                  key={p}
                  className={`wp-math__pill${provider === p && available ? ' wp-math__pill--active' : ''}`}
                  onClick={() => available && setProvider(p)}
                  disabled={!available}
                  title={available ? `Use ${PROVIDER_LABELS[p]}` : `${PROVIDER_LABELS[p]} not configured`}
                >
                  {PROVIDER_LABELS[p]}
                </button>
              );
            })}
          </div>

          {/* Conversation */}
          <div className="wp-math__messages" ref={chatRef}>
            {messages.length === 0 && (
              <div className="wp-math__hint">
                <div>Describe a math or geometry problem.</div>
                <div style={{ marginTop: 6, opacity: 0.6 }}>e.g. &quot;Draw a right triangle with legs 3 and 4&quot;</div>
              </div>
            )}
            {messages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} />
            ))}
          </div>

          {error && (
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 11,
              color: 'var(--signal-red, #c0392b)', padding: '6px 0',
            }}>
              ⚠ {error}
            </div>
          )}

          {/* Input row */}
          <div className="wp-math__input-row">
            <textarea
              className="wp-math__textarea"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              placeholder="Describe a math problem… (Enter to send, Shift+Enter for newline)"
              disabled={streaming}
              rows={2}
            />
            <button
              className="wp-math__send"
              onClick={send}
              disabled={streaming || !input.trim()}
            >
              {streaming ? '…' : '↵'}
            </button>
          </div>

          {/* Actions */}
          <div className="wp-math__actions">
            <button className="wp-math__action-btn" onClick={clearChat} disabled={streaming}>
              Clear chat
            </button>
            <button className="wp-math__action-btn" onClick={resetCanvas} disabled={!ggbReady}>
              Reset canvas
            </button>
          </div>
        </div>

        {/* ── Right: GeoGebra pane ───────────────────────── */}
        <div className="wp-math__canvas">
          {!ggbReady && !ggbError && (
            <div className="wp-math__ggb-loading">
              Loading GeoGebra…
            </div>
          )}
          {!ggbReady && ggbError && (
            <div className="wp-math__ggb-error">
              <span className="wp-math__ggb-error-msg">⚠ {ggbError}</span>
              <button className="wp-math__action-btn" onClick={retryGgb}>Retry</button>
            </div>
          )}
          <div
            id={GGB_CONTAINER_ID}
            style={{ width: '100%', minHeight: 500, display: ggbReady ? 'block' : 'none' }}
          />
        </div>
      </div>
    </div>
  );
}
