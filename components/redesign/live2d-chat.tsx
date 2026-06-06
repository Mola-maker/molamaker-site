'use client';

// Live2D corner mascot + AstrBot chat — the bottom-right bubble replacement.
// Loads the live2d-widget (stevenjoezhang/live2d-widget), renders the Live2D
// character at bottom-left, and opens the full AstrBot chat panel anchored to
// the left when the character is clicked. All chat logic is shared with the
// standalone AstrbotChat via useAstrbotChat.

import { useEffect, useRef, useCallback, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAstrbotChat, toMarkdown } from '@/lib/chat/use-astrbot-chat';
import {
  personaForModel,
  currentModelId,
  currentModelTexturesId,
  DEFAULT_PERSONA,
  type Persona,
} from '@/lib/chat/personas';

// ── Live2D autoload ────────────────────────────────────────────

const LIVE2D_BASE =
  process.env.NEXT_PUBLIC_LIVE2D_BASE?.replace(/\/+$/, '') || '/live2d';

function useLive2DLoader(enabled: boolean) {
  const scriptRef = useRef<boolean>(false);

  useEffect(() => {
    if (!enabled) return;
    if (scriptRef.current) return;
    if (document.getElementById('live2d-autoload')) {
      scriptRef.current = true;
      return;
    }
    scriptRef.current = true;

    // Suppress benign Live2D widget races: pointer hit-testing can run while the
    // model is null during outfit/model switches (hitTest / getHitAreasCount).
    const isLive2dBenign = (msg: string | undefined) => !!msg && (
      msg.includes('hitTest')
      || msg.includes('getHitAreasCount')
      // Widget toolbar (hitokoto CDN, asteroids script) or model CDN hiccups
      || (msg.includes('Failed to fetch') && (
        msg.includes('hitokoto')
        || msg.includes('waifu-tips')
        || msg.includes('live2d')
        || msg.includes('jsdelivr')
      ))
    );
    const onErr = (ev: ErrorEvent) => {
      const src = ev.filename ?? '';
      if (isLive2dBenign(ev.message) || (ev.message?.includes('Failed to fetch') && src.includes('/live2d/'))) {
        ev.preventDefault();
        // Capture phase + stopImmediatePropagation so this also pre-empts Next's
        // dev error-overlay listener (the model is momentarily null during
        // outfit/character switches — followPointer → hitTest throws harmlessly).
        ev.stopImmediatePropagation();
        return false;
      }
    };
    const onRejection = (ev: PromiseRejectionEvent) => {
      const msg = ev.reason instanceof Error ? ev.reason.message : String(ev.reason ?? '');
      if (isLive2dBenign(msg)) { ev.preventDefault(); ev.stopImmediatePropagation(); }
    };
    window.addEventListener('error', onErr, true);
    window.addEventListener('unhandledrejection', onRejection, true);

    const s = document.createElement('script');
    s.id = 'live2d-autoload';
    s.src = `${LIVE2D_BASE}/autoload.js`;
    s.async = true;
    document.body.appendChild(s);

    return () => {
      window.removeEventListener('error', onErr, true);
      window.removeEventListener('unhandledrejection', onRejection, true);
    };
  }, [enabled]);
}

// ── Detect #waifu creation + bind click ────────────────────────

function useWaifuClick(onClick: () => void) {
  const bound = useRef(false);

  useEffect(() => {
    // Poll until it appears, then bind click on the #waifu container
    // (NOT the canvas — the widget owns canvas events). Toolbar buttons are
    // excluded so model/outfit switching still works via the widget's own UI.
    let timer: ReturnType<typeof setInterval> | undefined;
    let attempts = 0;

    const bind = () => {
      if (bound.current) return;
      const waifu = document.getElementById('waifu');
      if (!waifu) {
        attempts++;
        if (attempts > 60) {
          if (timer) clearInterval(timer);
        }
        return;
      }
      if (timer) clearInterval(timer);
      bound.current = true;

      const onWaifuClick = (e: MouseEvent) => {
        try {
          const target = e.target as HTMLElement;
          // Toolbar has its own click handlers (switch-model / switch-texture).
          if (target.closest('#waifu-tool')) return;
          // Open chat only from the character canvas, not tips or chrome.
          if (!target.closest('#waifu-canvas, #live2d')) return;
          e.stopPropagation();
          onClick();
        } catch {
          // Harmless during model / texture transitions
        }
      };
      waifu.addEventListener('click', onWaifuClick);
    };

    timer = setInterval(bind, 100);
    return () => { if (timer) clearInterval(timer); };
  }, [onClick]);
}

// ── Markdown renderer ──────────────────────────────────────────

// Graceful image: AstrBot attachments are served through the same-origin proxy
// (/api/astrbot/file). If that 404s — file gone from the ECS host, expired id,
// path the proxy can't resolve — swap the broken <img> for a tappable link so
// the visitor sees a fallback instead of a broken-image glyph.
function MdImage({ src, alt }: { src?: string; alt?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src) return null;
  if (failed) {
    return (
      <a className="ab-md__img-fail" href={src} target="_blank" rel="noopener noreferrer">
        🖼️ {alt?.trim() || 'image unavailable — tap to open'}
      </a>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="ab-msg__img" src={src} alt={alt ?? ''} loading="lazy" onError={() => setFailed(true)} />
  );
}

const MD_COMPONENTS: Components = {
  img: ({ src, alt }) => (
    <MdImage src={typeof src === 'string' ? src : undefined} alt={typeof alt === 'string' ? alt : undefined} />
  ),
};

function BotMarkdown({ text }: { text: string }) {
  return (
    <div className="ab-md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>{toMarkdown(text)}</ReactMarkdown>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────

export function Live2DChat({ autoLoad = true }: { autoLoad?: boolean } = {}) {
  // Live2D chat is served exclusively by AstrBot's LLM (the per-character
  // persona is injected there); no DeepSeek/Coze fallback for this surface.
  const chat = useAstrbotChat({ astrbotOnly: true });
  const bodyRef = useRef<HTMLDivElement>(null);
  const [persona, setPersonaState] = useState<Persona>(DEFAULT_PERSONA);
  const lastPersonaId = useRef<string | null>(null);
  // The 看板娘 mascot is lazy off-workplace: it loads on first toggle so marketing
  // variants don't pay for the widget unless summoned via the MikuHub.
  const [widgetOn, setWidgetOn] = useState(autoLoad);
  const [mascotVisible, setMascotVisible] = useState(true);

  // Wire the hook's bodyRef to our local ref for auto-scroll
  (chat.bodyRef as { current: HTMLDivElement | null }).current = bodyRef.current;

  // Load Live2D widget script once the mascot is enabled
  useLive2DLoader(widgetOn);

  // Toggle chat on Live2D character click
  const toggleChat = useCallback(() => chat.setOpen((v) => !v), [chat]);
  useWaifuClick(toggleChat);

  // MikuHub main button → open/close the persona chat (works with or without
  // the mascot loaded; persona falls back to the default).
  useEffect(() => {
    const h = () => chat.setOpen((v) => !v);
    window.addEventListener('mola:chat-toggle', h);
    return () => window.removeEventListener('mola:chat-toggle', h);
  }, [chat]);

  // MikuHub 看板娘 satellite → load the mascot on first use, then show/hide it.
  useEffect(() => {
    const h = () => {
      if (!widgetOn) { setWidgetOn(true); setMascotVisible(true); }
      else setMascotVisible((v) => !v);
    };
    window.addEventListener('mola:live2d-toggle', h);
    return () => window.removeEventListener('mola:live2d-toggle', h);
  }, [widgetOn]);

  // Reflect mascot visibility onto the widget DOM.
  useEffect(() => {
    const el = document.getElementById('waifu');
    if (el) el.classList.toggle('waifu-hidden', !mascotVisible);
  }, [mascotVisible, widgetOn]);

  // Surface workflow activity as the mascot's speech bubble
  useEffect(() => {
    const onBus = (e: Event) => {
      const d = (e as CustomEvent).detail as { text?: string; level?: string } | undefined;
      const w = window as unknown as { showMessage?: (t: string, timeout?: number, priority?: number) => void };
      if (d?.text && typeof w.showMessage === 'function') {
        w.showMessage(d.level === 'error' ? `⚠ ${d.text}` : d.text, 4000, 9);
      }
    };
    window.addEventListener('wp:bus', onBus);
    return () => window.removeEventListener('wp:bus', onBus);
  }, []);

  // Poll modelId + modelTexturesId; outfit switches (coat icon) and character
  // switches (street-view icon) both update the AstrBot header + system prompt.
  useEffect(() => {
    const apply = () => {
      const p = personaForModel(currentModelId(), currentModelTexturesId());
      if (p.id === lastPersonaId.current) return;
      const isFirst = lastPersonaId.current === null;
      lastPersonaId.current = p.id;
      setPersonaState(p);
      chat.setPersona(p.systemPrompt);
      chat.setMessages([{ id: `persona-${p.id}`, role: 'bot', text: p.greeting, ts: Date.now() }]);
      if (!isFirst) chat.resetSession();
    };
    apply();
    const t = setInterval(apply, 800);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const panelPos = chat.panelStyle('bottom-left');
  // Re-theme the dialog per Live2D character — the persona accent flows into the
  // header gradient + body tint via CSS vars (see .ab-panel--live2d).
  const panelStyle = { ...panelPos, '--ab-accent': persona.accent } as CSSProperties;
  const initial = persona.name.trim().charAt(0).toUpperCase();

  return chat.open ? createPortal(
    <div className="ab-panel ab-panel--live2d" style={panelStyle}>
      <div className="ab-panel__header" onMouseDown={chat.onMouseDown}>
        <div className="ab-panel__avatar ab-panel__avatar--mono" aria-hidden="true">
          <span>{initial}</span>
        </div>
        <div className="ab-panel__title">
          <span className="ab-panel__name">{persona.name}</span>
          <span className="ab-panel__status">
            <span className="ab-status-dot" />
            {chat.configured ? 'online' : 'connecting…'}
          </span>
        </div>
        <button
          className="ab-panel__reset"
          onClick={() => { chat.setMessages([{ id: `persona-${persona.id}`, role: 'bot', text: persona.greeting, ts: 0 }]); chat.setInput(''); }}
          onMouseDown={(e) => e.stopPropagation()}
          aria-label="Reset chat"
          title="Reset chat"
        >↺</button>
        <button className="ab-panel__close" onClick={() => chat.setOpen(false)} onMouseDown={(e) => e.stopPropagation()} aria-label="Close">×</button>
      </div>

      <div className="ab-panel__body" ref={bodyRef}>
        {chat.messages.map((msg) => (
          <div key={msg.id} className={`ab-msg ab-msg--${msg.role}`}>
            {msg.role === 'bot' && (
              <span className="ab-msg__avatar" aria-hidden="true">✦</span>
            )}
            <div className="ab-msg__bubble">
              {msg.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="ab-msg__img" src={msg.image} alt="" />
              )}
              {msg.text && (msg.role === 'bot'
                ? <BotMarkdown text={msg.text} />
                : <span className="ab-msg__usertext">{msg.text}</span>)}
            </div>
          </div>
        ))}
        {chat.loading && chat.messages[chat.messages.length - 1]?.role !== 'bot' && (
          <div className="ab-msg ab-msg--bot">
            <span className="ab-msg__avatar" aria-hidden="true">✦</span>
            <div className="ab-msg__bubble ab-typing">
              <span /><span /><span />
            </div>
          </div>
        )}
      </div>

      <div className="ab-panel__footer">
        {chat.attachment && (
          <div className="ab-attach">
            {chat.attachment.type === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="ab-attach__thumb" src={chat.attachment.previewUrl} alt="" />
            ) : (
              <span className="ab-attach__file" aria-hidden="true">📄</span>
            )}
            <span className="ab-attach__name">{chat.attachment.file.name}</span>
            <button className="ab-attach__remove" onClick={chat.clearAttachment} onMouseDown={(e) => e.stopPropagation()} aria-label="Remove attachment">×</button>
          </div>
        )}
        <div className="ab-panel__input-row">
          <button
            className="ab-panel__attach"
            onClick={() => chat.fileRef.current?.click()}
            disabled={chat.loading || chat.uploading}
            aria-label="Attach a photo or file"
            title="Attach a photo or file"
          >📎</button>
          <input
            ref={chat.fileRef}
            type="file"
            accept="image/*,application/pdf,text/plain"
            hidden
            onChange={chat.onPickFile}
          />
          <textarea
            className="ab-panel__input"
            value={chat.input}
            onChange={(e) => chat.setInput(e.target.value)}
            onKeyDown={chat.onKeyDown}
            placeholder="Ask anything… (Enter to send)"
            rows={1}
            disabled={chat.loading}
          />
          <button
            className="ab-panel__send"
            onClick={chat.send}
            disabled={chat.loading || chat.uploading || (!chat.input.trim() && !chat.attachment)}
            aria-label="Send"
          >
            {chat.uploading ? '…' : '↑'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  ) : null;
}
