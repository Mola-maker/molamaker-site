'use client';

// Live2D corner mascot + AstrBot chat — the bottom-right bubble replacement.
// Loads the live2d-widget (stevenjoezhang/live2d-widget), renders the Live2D
// character at bottom-left, and opens the full AstrBot chat panel anchored to
// the left when the character is clicked. All chat logic is shared with the
// standalone AstrbotChat via useAstrbotChat.

import { useEffect, useRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAstrbotChat } from '@/lib/chat/use-astrbot-chat';
import { initLive2dLife } from '@/lib/live2d/interactions';
import {
  personaForModel,
  currentModelId,
  currentModelTexturesId,
  DEFAULT_PERSONA,
  type Persona,
} from '@/lib/chat/personas';
import { ChatPanel } from './chat-panel';

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

  // Ambient life: greetings, petting, sing-along, board hosting (one init).
  useEffect(() => {
    if (!widgetOn) return;
    return initLive2dLife();
  }, [widgetOn]);

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

  const initial = persona.name.trim().charAt(0).toUpperCase();

  return chat.open && typeof document !== 'undefined' ? createPortal(
    <ChatPanel
      messages={chat.messages}
      loading={chat.loading}
      input={chat.input}
      attachment={chat.attachment}
      uploading={chat.uploading}
      configured={chat.configured}
      avatarContent={<span>{initial}</span>}
      avatarClass="ab-panel__avatar--mono"
      name={persona.name}
      extraClass="ab-panel--live2d"
      bodyRef={bodyRef}
      fileRef={chat.fileRef}
      style={{ ...chat.panelStyle('bottom-left'), '--ab-accent': persona.accent } as React.CSSProperties}
      onMouseDown={chat.onMouseDown}
      onReset={() => { chat.setMessages([{ id: `persona-${persona.id}`, role: 'bot', text: persona.greeting, ts: 0 }]); chat.setInput(''); }}
      onClose={() => chat.setOpen(false)}
      onAttachClick={() => chat.fileRef.current?.click()}
      onPickFile={chat.onPickFile}
      onClearAttachment={chat.clearAttachment}
      onInputChange={(e) => chat.setInput(e.target.value)}
      onKeyDown={chat.onKeyDown}
      onSend={chat.send}
      activeAnimation={chat.activeAnimation}
      onDismissAnimation={chat.dismissAnimation}
    />,
    document.body,
  ) : null;
}
