'use client';

// Variant A: Terminal Editorial — ported from v-terminal.jsx.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { I18nBlock, Locale, Guest, Post, Repo } from './data';
import { mikuBoardReply } from '@/lib/miku/board-replies';
import { FluidText } from './fluid-text';
import { molaData } from './data';
import { HoverText, useReveal } from './atoms';

function NowCard({ locale }: { locale: Locale }) {
  const d = molaData;
  return (
    <aside className="nowcard reveal">
      <div className="nowcard__row">
        <span className="k">{'// status'}</span>
        <span className="v">
          <span className="pulse"></span>&nbsp; live
        </span>
      </div>
      <div className="nowcard__row">
        <span className="k">now playing</span>
        <span className="v">
          <strong>{d.nowPlaying.title}</strong>
        </span>
      </div>
      <div className="nowcard__row" style={{ marginTop: -8 }}>
        <span className="k">&nbsp;</span>
        <span className="v" style={{ color: 'var(--ink-soft)' }}>
          {d.nowPlaying.artist} — {d.nowPlaying.album}
        </span>
      </div>
      <div className="nowcard__progress">
        <i></i>
      </div>
      <hr />
      <div className="nowcard__row">
        <span className="k">desk</span>
        <span className="v">{locale === 'zh' ? d.status.locationCn : d.status.location}</span>
      </div>
      <div className="nowcard__row">
        <span className="k">learning</span>
        <span className="v">{d.status.learning}</span>
      </div>
      <div className="nowcard__row">
        <span className="k">signal</span>
        <span className="v">
          <span className="nowcard__bars">
            <i></i><i></i><i></i><i></i><i></i>
          </span>
        </span>
      </div>
    </aside>
  );
}

type Props = { t: I18nBlock; locale: Locale; posts?: Post[]; repos?: Repo[]; guestbook?: Guest[] };

export function VTerminal({ t, locale, posts, repos, guestbook }: Props) {
  const d = { ...molaData, posts: posts ?? molaData.posts, repos: repos ?? molaData.repos };
  const rootRef = useRef<HTMLDivElement>(null);
  const h1Ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      // Add is-in to the .v-term root so `.v-term.is-in .hero__lead span`
      // background-highlight animation fires correctly.
      rootRef.current?.classList.add('is-in');
      h1Ref.current?.classList.add('is-in');
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const [visitors, setVisitors] = useState(d.visitor);
  useEffect(() => {
    const id = setInterval(() => setVisitors((v) => v + (Math.random() < 0.7 ? 0 : 1)), 4000);
    return () => clearInterval(id);
  }, []);

  // Session ID and messages both live in sessionStorage so they survive locale
  // switches (router.replace changes the URL, which can remount client components).
  const sessionIdRef = useRef<string>(null!);
  if (!sessionIdRef.current) {
    try {
      const stored = sessionStorage.getItem('mola:chat-sid');
      sessionIdRef.current = stored ?? (() => {
        const id = `term-${Math.random().toString(36).slice(2, 14)}`;
        sessionStorage.setItem('mola:chat-sid', id);
        return id;
      })();
    } catch {
      sessionIdRef.current = `term-${Math.random().toString(36).slice(2, 14)}`;
    }
  }

  type ChatMsg = { role: 'bot' | 'me'; text: string };
  const defaultMessages: ChatMsg[] = [
    { role: 'bot', text: locale === 'zh' ? '你好 —— 这里是 mola 的小桌子。' : "Hello — this is mola's little desk." },
    { role: 'bot', text: locale === 'zh' ? '问点什么？' : 'Ask me anything.' },
  ];
  // Start with defaults (same on server + client) to avoid hydration mismatch.
  // useLayoutEffect loads saved history before the first paint.
  const [messages, setMessages] = useState<ChatMsg[]>(defaultMessages);
  useLayoutEffect(() => {
    try {
      const saved = sessionStorage.getItem('mola:chat-messages');
      if (saved) {
        const parsed = JSON.parse(saved) as Array<{ role: 'bot' | 'user'; text: string }>;
        if (parsed.length > 0)
          setMessages(parsed.map((m) => ({ role: (m.role === 'user' ? 'me' : 'bot') as 'bot' | 'me', text: m.text })));
      }
    } catch { /* ignore */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist to shared sessionStorage key + notify the floating AstrBot panel
  useEffect(() => {
    try {
      const normalized = JSON.stringify(messages.map((m) => ({ role: m.role === 'me' ? 'user' : m.role, text: m.text })));
      sessionStorage.setItem('mola:chat-messages', normalized);
      window.dispatchEvent(new CustomEvent('mola:chat-update'));
    } catch { /* ignore */ }
  }, [messages]);

  // Pull updates originating from the floating panel
  useEffect(() => {
    const handler = () => {
      try {
        const saved = sessionStorage.getItem('mola:chat-messages');
        if (!saved) return;
        const parsed = JSON.parse(saved) as Array<{ role: 'bot' | 'user'; text: string }>;
        const incoming = parsed.map((m) => ({ role: (m.role === 'user' ? 'me' : 'bot') as 'bot' | 'me', text: m.text }));
        setMessages((cur) => {
          const curSerialized = JSON.stringify(cur.map((m) => ({ role: m.role === 'me' ? 'user' : m.role, text: m.text })));
          return curSerialized === saved ? cur : incoming;
        });
      } catch { /* ignore */ }
    };
    window.addEventListener('mola:chat-update', handler);
    return () => window.removeEventListener('mola:chat-update', handler);
  }, []);

  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [messages, typing]);

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || typing) return;
    setMessages((m) => [...m, { role: 'me', text }]);
    setDraft('');
    setTyping(true);
    try {
      const r = await fetch('/api/astrbot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, session_id: sessionIdRef.current }),
      });
      const json = await r.json() as { data?: { message?: string }; error?: unknown };
      const reply = json.data?.message
        ?? (locale === 'zh' ? '暂时无法连接，稍后再试。' : 'mola is away right now — try again later.');
      setMessages((m) => [...m, { role: 'bot', text: reply }]);
    } catch {
      const fallback = locale === 'zh' ? '网络错误，请稍后重试。' : 'Connection error — please try again.';
      setMessages((m) => [...m, { role: 'bot', text: fallback }]);
    } finally {
      setTyping(false);
    }
  };

  const [gb, setGb] = useState<Guest[]>(guestbook ?? d.guestbook);
  useEffect(() => {
    if (guestbook) setGb(guestbook);
  }, [guestbook]);
  const [gbName, setGbName] = useState('');
  const [gbMsg, setGbMsg] = useState('');
  const [gbError, setGbError] = useState('');
  const postGB = (e: React.FormEvent) => {
    e.preventDefault();
    const name = gbName.trim();
    const message = gbMsg.trim();
    if (!name || !message) return;
    // Optimistic entry; Miku's hostess reply and the celebration event wait
    // for the server — moderation can reject with HTTP 400, and a censored
    // post must not stay on the wall or earn a thank-you.
    setGb([{ name, message, t: 'just now', _new: true }, ...gb]);
    setGbName('');
    setGbMsg('');
    setGbError('');
    const rollback = () =>
      setGb((prev) => prev.filter((g) => !(g._new && g.name === name && g.message === message)));
    fetch('/api/guestbook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, message }),
    }).then(async (res) => {
      if (!res.ok) {
        rollback();
        const j = await res.json().catch(() => ({})) as { error?: { message?: string } };
        setGbError(j.error?.message ?? (locale === 'zh' ? '发送失败，请稍后再试' : 'failed to post — try again'));
        return;
      }
      // accepted: the server may have masked profanity — show the stored text
      const j = await res.json().catch(() => ({})) as { data?: { message?: string } };
      const storedMessage = j.data?.message ?? message;
      setGb((prev) => prev.map((g) =>
        g._new && g.name === name && g.message === message
          ? { ...g, message: storedMessage, _mikuReply: mikuBoardReply(storedMessage, name) }
          : g,
      ));
      try { window.dispatchEvent(new CustomEvent('mola:guest-posted', { detail: { name, message: storedMessage } })); } catch { /* ignore */ }
    }).catch(() => {
      rollback();
      setGbError(locale === 'zh' ? '网络错误，请重试' : 'network error — try again');
    });
  };

  useReveal(locale);

  return (
    <div className="v-term" ref={rootRef}>
      <div className="system-bar">
        <div>
          <span className="k">tz</span> <span className="v">{d.status.tz}</span>
        </div>
        <div>
          <span className="k">where</span>{' '}
          <span className="v">{locale === 'zh' ? d.status.locationCn : d.status.location}</span>
        </div>
        <div>
          <span className="k">learning</span> <span className="v accent">{d.status.learning}</span>
        </div>
        <div>
          <span className="k">weather</span> <span className="v">{d.status.weather}</span>
        </div>
        <div>
          <span className="k">visitor</span>{' '}
          <span className="v" style={{ fontVariantNumeric: 'tabular-nums' }}>
            #{visitors.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="wrap" id="top">
        <section className="hero has-backdrop">
          <div className="miku-backdrop"></div>
          <div className="hero__grid">
            <div>
              <div className="eyebrow" style={{ marginBottom: 28 }}>
                {t.eyebrow}
              </div>
              <h1 className="hero__h1" ref={h1Ref}>
                <FluidText text={t.h1[0] + ' '} />
                <em>
                  <FluidText text={t.h1[1]} delay={3} />
                </em>
                <FluidText text={' ' + t.h1.slice(2).join(' ')} delay={5} />
              </h1>
              <p className="hero__lead">
                <span>{t.lead}</span>
              </p>
            </div>
            <NowCard locale={locale} />
          </div>
        </section>
      </div>

      <div className="wrap reveal" id="sec-2">
        <section className="panel">
          <div className="panel__head">
            <div className="panel__num">§ 01 — {t.writing}</div>
            <div className="panel__title">
              <HoverText text="$ tail -f" mode="glitch" tag="em" /> writing.log
            </div>
            <a className="panel__cta" href="#sec-2" data-magnet
               onClick={(e) => { e.preventDefault(); document.querySelector('#sec-2')?.scrollIntoView({ behavior: 'smooth' }); }}>
              {t.readAll}
            </a>
          </div>
          <div className="log">
            {d.posts.map((p) => (
              <a key={p.slug} className="log__row" href={`/${locale}/blog/${p.slug}`} data-magnet>
                <span className="date">{p.date}</span>
                <span className="tag">{p.tag}</span>
                <span className="title">{p.title}</span>
                <span className="meta">{p.readTime} min</span>
              </a>
            ))}
          </div>
        </section>
      </div>

      <div className="wrap reveal" id="sec-3">
        <section className="panel">
          <div className="panel__head">
            <div className="panel__num">§ 02 — {t.open}</div>
            <div className="panel__title">
              <HoverText text="git remote" mode="glitch" tag="em" /> — what I&apos;m shipping
            </div>
            <a className="panel__cta" href="https://github.com/Mola-maker" target="_blank" rel="noopener noreferrer" data-magnet>
              github →
            </a>
          </div>
          <div className="grid-cards">
            {d.repos.map((r) => (
              <a key={r.name} className="repo" href={`https://github.com/Mola-maker/${r.name}`} target="_blank" rel="noopener noreferrer" data-magnet>
                <span className="repo__arrow">↗</span>
                <div className="repo__head">
                  <div className="repo__name">
                    <b>~/</b>
                    {r.name}
                  </div>
                  <div className="repo__stars">★ {r.stars.toLocaleString()}</div>
                </div>
                <div className="repo__desc">{r.desc}</div>
                <div className="repo__foot">
                  <span className="repo__lang">
                    <i style={{ background: r.langColor }}></i>
                    {r.lang}
                  </span>
                  <span className="repo__updated">{r.updated}</span>
                </div>
              </a>
            ))}
          </div>
        </section>
      </div>

      <div className="wrap reveal" id="sec-5">
        <section className="panel">
          <div className="panel__head">
            <div className="panel__num">§ 03 — {t.guests} / chat</div>
            <div className="panel__title">
              leave a <HoverText text="trace" mode="glitch" tag="em" />
            </div>
            <a className="panel__cta" href="#sec-5" data-magnet
               onClick={(e) => { e.preventDefault(); document.querySelector('#sec-5')?.scrollIntoView({ behavior: 'smooth' }); }}>
              archive →
            </a>
          </div>
          <div className="talk-grid">
            <div className="guestbook">
              <div className="panel__sub">
                <span>guestbook.log</span>
                <span>
                  <span className="pulse"></span>
                </span>
              </div>
              <div className="gb__list">
                {gb.map((g, i) => (
                  <div
                    key={i}
                    className="gb__item"
                    style={g._new ? { animation: 'bubIn 360ms var(--ease-out-quart)' } : undefined}
                  >
                    <div className="gb__head">
                      <span className="gb__name">{g.name}</span>
                      <span>{g.t}</span>
                    </div>
                    <div className="gb__msg">{g.message}</div>
                    {g._mikuReply && (
                      <div className="gb__miku">
                        <span className="gb__miku-tag">Miku</span> {g._mikuReply}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {gbError && <div className="gb__error">⚠ {gbError}</div>}
              <form className="gb__form" onSubmit={postGB}>
                <input
                  value={gbName}
                  onChange={(e) => setGbName(e.target.value)}
                  placeholder={locale === 'zh' ? '名字' : 'name'}
                />
                <input
                  value={gbMsg}
                  onChange={(e) => setGbMsg(e.target.value)}
                  placeholder={locale === 'zh' ? '留点什么…' : 'leave something…'}
                />
                <button type="submit">{locale === 'zh' ? '寄出' : 'post'}</button>
              </form>
            </div>
            <div className="chat">
              <div className="panel__sub">
                <span>chat.bot</span>
                <span style={{ color: 'var(--ink-soft)' }}>ASRTBOT</span>
              </div>
              <div className="chat__feed" ref={feedRef}>
                {messages.map((m, i) => (
                  <div key={i} className={`bubble is-${m.role}`}>
                    {m.text}
                  </div>
                ))}
                {typing && (
                  <div className="bubble is-bot">
                    <span className="typing">
                      <i></i>
                      <i></i>
                      <i></i>
                    </span>
                  </div>
                )}
              </div>
              <form className="chat__form" onSubmit={send}>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={locale === 'zh' ? '问点什么…' : 'ask anything…'}
                />
                <button type="submit">↵</button>
              </form>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
