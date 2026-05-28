'use client';

// TopNav, Clock, VariantRail, Footer, Marquee — ported from app.jsx.

import { useEffect, useRef, useState } from 'react';
import type { I18nBlock, Locale } from './data';
import { molaData } from './data';

function fmtTime(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function Clock() {
  // Start blank to avoid SSR/client hydration mismatch — the server's
  // `new Date()` is always a second or two ahead/behind the client's,
  // and React 19 treats that as a hard recoverable error. We render the
  // first real value on the first post-mount tick, then once per second.
  const [now, setNow] = useState('');
  useEffect(() => {
    setNow(fmtTime(new Date()));
    const id = setInterval(() => setNow(fmtTime(new Date())), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums' }} suppressHydrationWarning>
      {now}
    </span>
  );
}

type TopNavProps = {
  locale: Locale;
  onLocale: (l: Locale) => void;
  t: I18nBlock;
};

export function TopNav({ locale, onLocale, t }: TopNavProps) {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setHidden(y > 200 && y > lastY.current);
      lastY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={`top-nav ${hidden ? 'is-hidden' : ''}`}>
      <div className="top-nav__inner">
        <a href="#top" className="brand" data-magnet
           onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('chat:open')); }}>
          <span className="brand__avatar" style={{ backgroundImage: `url(${molaData.avatarUrl})` }}></span>
          <span className="brand__name">molamaker</span>
          <span className="brand__dot">.</span>
        </a>
        <div className="top-nav__links">
          {t.nav.map((n, i) => {
            // Map nav item index to existing section IDs on the page
            const ids = ['#top', '#top', '#sec-2', '#sec-3', '#top', '#sec-5', '#sec-5'];
            const href = ids[i] ?? '#top';
            return (
              <a key={i} href={href} className="top-nav__link"
                 onClick={(e) => {
                   e.preventDefault();
                   document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
                 }}>
                {n}
              </a>
            );
          })}
        </div>
        <div className="top-nav__meta">
          <span className="pulse"></span>
          <span>{molaData.status.tz}</span>
          <Clock />
          <div className="locale" role="group" aria-label="Language">
            <button aria-pressed={locale === 'en'} onClick={() => onLocale('en')}>
              EN
            </button>
            <button aria-pressed={locale === 'zh'} onClick={() => onLocale('zh')}>
              中文
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

type VariantRailProps = {
  value: string;
  onChange: (v: string) => void;
};

export function VariantRail({ value, onChange }: VariantRailProps) {
  const items = [
    { id: 'terminal', label: 'Terminal' },
    { id: 'magazine', label: 'Magazine' },
    { id: 'atlas', label: 'Atlas' },
    { id: 'stream', label: 'Stream' },
    { id: 'workplace', label: 'Workplace' },
  ];
  return (
    <div className="variant-rail" role="tablist" aria-label="Home page variant">
      {items.map((it, i) => (
        <button key={it.id} aria-pressed={value === it.id} onClick={() => onChange(it.id)}>
          <span className="num">0{i + 1}</span> {it.label}
        </button>
      ))}
    </div>
  );
}

type FooterProps = { t: I18nBlock };

export function Footer({ t }: FooterProps) {
  return (
    <footer className="foot">
      <div className="foot__inner">
        <div className="foot__brand">
          <h3>
            molamaker<span style={{ color: 'var(--accent)' }}>.</span>
          </h3>
          <p>
            A quiet desk on the internet — for notes on GPU kernels, agentic systems, and other small fires worth keeping lit.
          </p>
        </div>
        <div className="foot__group">
          <h4>Read</h4>
          <ul>
            <li><a href="#sec-2">Writing</a></li>
            <li><a href="#sec-3">Selected work</a></li>
            <li><a href="#sec-4">Open source</a></li>
          </ul>
        </div>
        <div className="foot__group">
          <h4>Connect</h4>
          <ul>
            <li><a href="#sec-5">Guestbook</a></li>
            <li><a href="#sec-6">Chat with bot</a></li>
            <li><a href="mailto:hi@molamaker.com">Email</a></li>
          </ul>
        </div>
        <div className="foot__group">
          <h4>Elsewhere</h4>
          <ul>
            <li><a href="https://github.com/Mola-maker" target="_blank" rel="noopener noreferrer">GitHub ↗</a></li>
            <li><a href="https://mastodon.social/@molamaker" target="_blank" rel="noopener noreferrer">Mastodon ↗</a></li>
            <li><a href="/rss.xml" target="_blank" rel="noopener noreferrer">RSS ↗</a></li>
          </ul>
        </div>
      </div>
      <div className="foot__bottom">
        <span>
          © 2026 molamaker · made with <span className="heart">❤</span> and too much coffee
        </span>
        <span>built on a quiet desk in {t.based === 'based' ? 'Hangzhou' : '杭州'}</span>
      </div>
    </footer>
  );
}

// ── Brand Chat Modal ──────────────────────────────────────
const BRAND_CHAT_CSS = `
.brand-chat-overlay {
  position: fixed; inset: 0;
  z-index: 8000;
  background: rgba(26,22,18,0.55);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  pointer-events: none;
  transition: opacity 220ms ease;
}
.brand-chat-overlay.is-open {
  opacity: 1;
  pointer-events: auto;
}
.brand-chat-card {
  width: min(420px, 92vw);
  background: var(--bg-elev);
  border: 1px solid var(--rule);
  border-radius: 12px;
  box-shadow: 0 24px 60px -12px rgba(0,0,0,0.45);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transform: scale(0.9);
  opacity: 0;
  transition: transform 280ms cubic-bezier(0.22,1,0.36,1), opacity 280ms ease;
}
.brand-chat-overlay.is-open .brand-chat-card {
  transform: scale(1);
  opacity: 1;
}
.brand-chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--rule);
  font-family: var(--font-display);
  font-style: italic;
  font-size: 18px;
  font-weight: 500;
  letter-spacing: -0.01em;
}
.brand-chat-header span { color: var(--accent); font-style: normal; }
.brand-chat-close {
  font-family: var(--font-mono);
  font-size: 18px;
  color: var(--ink-soft);
  line-height: 1;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background 150ms, color 150ms;
}
.brand-chat-close:hover { background: var(--bg-deep); color: var(--ink); }
.brand-chat-feed {
  flex: 1;
  min-height: 220px;
  max-height: 320px;
  overflow-y: auto;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  scroll-behavior: smooth;
}
.brand-chat-bubble {
  max-width: 78%;
  padding: 9px 13px;
  border-radius: 10px;
  font-family: var(--font-mono);
  font-size: 12.5px;
  line-height: 1.55;
}
.brand-chat-bubble.is-me {
  align-self: flex-end;
  background: var(--ink);
  color: var(--bg-elev);
  border-bottom-right-radius: 3px;
}
.brand-chat-bubble.is-bot {
  align-self: flex-start;
  background: var(--bg-deep);
  color: var(--ink);
  border-bottom-left-radius: 3px;
}
.brand-chat-typing {
  align-self: flex-start;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--ink-soft);
  padding: 6px 13px;
  letter-spacing: 0.04em;
}
.brand-chat-form {
  display: flex;
  gap: 8px;
  padding: 12px 18px;
  border-top: 1px solid var(--rule);
}
.brand-chat-input {
  flex: 1;
  background: var(--bg-deep);
  border: 1px solid var(--rule);
  border-radius: 8px;
  padding: 9px 12px;
  font-family: var(--font-mono);
  font-size: 12.5px;
  color: var(--ink);
  outline: none;
  transition: border-color 150ms;
}
.brand-chat-input:focus { border-color: var(--accent); }
.brand-chat-send {
  background: var(--ink);
  color: var(--bg-elev);
  border-radius: 8px;
  padding: 9px 14px;
  font-family: var(--font-mono);
  font-size: 12px;
  transition: background 150ms;
}
.brand-chat-send:hover { background: var(--accent); }
`;

type ChatMessage = { role: 'me' | 'bot'; text: string };

type BrandChatModalProps = { locale: Locale; t: I18nBlock };

function makeSessionId(): string {
  const arr = new Uint8Array(12);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 24);
}

export function BrandChatModal({ locale }: BrandChatModalProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef<string>('');

  useEffect(() => {
    // Stable session ID per browser tab, generated client-side to avoid SSR mismatch
    if (!sessionIdRef.current) {
      sessionIdRef.current = makeSessionId();
    }
  }, []);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('chat:open', onOpen);
    return () => window.removeEventListener('chat:open', onOpen);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [messages, typing]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || typing) return;
    setMessages((m) => [...m, { role: 'me', text }]);
    setDraft('');
    setTyping(true);
    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId: sessionIdRef.current }),
      });
      const data = await res.json() as { reply?: string; error?: string };
      setTyping(false);
      if (data.reply) {
        setMessages((m) => [...m, { role: 'bot', text: data.reply! }]);
      } else {
        const fallback =
          locale === 'zh' ? '暂时无法连接到 mola，稍后再试。' : 'mola is away right now — try again later.';
        setMessages((m) => [...m, { role: 'bot', text: fallback }]);
      }
    } catch {
      setTyping(false);
      const fallback =
        locale === 'zh' ? '网络错误，请稍后重试。' : 'Connection error — please try again.';
      setMessages((m) => [...m, { role: 'bot', text: fallback }]);
    }
  };

  return (
    <>
      <style>{BRAND_CHAT_CSS}</style>
      <div className={`brand-chat-overlay${open ? ' is-open' : ''}`} onClick={() => setOpen(false)}>
        <div className="brand-chat-card" onClick={(e) => e.stopPropagation()}>
          <div className="brand-chat-header">
            Chat with mola<span>.</span>
            <button className="brand-chat-close" onClick={() => setOpen(false)} aria-label="Close">×</button>
          </div>
          <div className="brand-chat-feed" ref={feedRef}>
            {messages.map((m, i) => (
              <div key={i} className={`brand-chat-bubble is-${m.role}`}>{m.text}</div>
            ))}
            {typing && <div className="brand-chat-typing">mola is typing…</div>}
          </div>
          <form className="brand-chat-form" onSubmit={send}>
            <input
              className="brand-chat-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={locale === 'zh' ? '说点什么…' : 'Say something…'}
            />
            <button className="brand-chat-send" type="submit">
              {locale === 'zh' ? '发送' : 'Send'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

type MarqueeProps = { items: string[] };

export function Marquee({ items }: MarqueeProps) {
  const list = items.concat(items);
  return (
    <div className="marquee">
      <div className="marquee__track">
        {list.map((s, i) => (
          <span key={i}>
            {s}
            <span className="sep" style={{ marginLeft: 56 }}>
              ✦
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
