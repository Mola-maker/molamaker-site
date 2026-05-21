'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import BotStatusBadge from '@/components/bot-status-badge';
import MessageBubble from './message-bubble';
import TypingIndicator from './typing-indicator';

interface Message {
  id: string;
  role: 'user' | 'bot';
  text: string;
  ts: string;
}

const MAX_MESSAGES = 200;

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return '';
  let sid = sessionStorage.getItem('molabot:sid');
  if (!sid) {
    sid = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 18);
    sessionStorage.setItem('molabot:sid', sid);
  }
  return sid;
}

export default function ChatRoom() {
  const t = useTranslations('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [botOnline, setBotOnline] = useState<boolean | null>(null);
  const [botLatency, setBotLatency] = useState<number | null>(null);
  const [sessionId] = useState(() => getOrCreateSessionId());
  const msgCounter = useRef(0);
  const inputRef = useRef(input);
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const userScrolledUpRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    function poll() {
      fetch('/api/bot/status')
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled) {
            setBotOnline(d.online);
            setBotLatency(d.latencyMs);
          }
        })
        .catch(() => { if (!cancelled) setBotOnline(false); });
    }
    poll();
    const id = setInterval(poll, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    fetch(`/api/chat/history?sessionId=${encodeURIComponent(sessionId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.messages?.length) {
          const msgs: Message[] = d.messages.map((m: { role: string; content: string; ts: string }) => ({
            id: m.ts,
            role: m.role === 'assistant' ? 'bot' : 'user',
            text: m.content,
            ts: m.ts,
          }));
          msgCounter.current = msgs.length;
          setMessages(msgs);
        }
      })
      .catch(() => {});
  }, [sessionId]);

  useEffect(() => {
    if (!userScrolledUpRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    userScrolledUpRef.current = el.scrollHeight - el.scrollTop - el.clientHeight > 80;
  }, []);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    inputRef.current = value;
    setInput(value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 6 * 24)}px`;
  }, []);

  const addMessage = useCallback((role: 'user' | 'bot', text: string) => {
    const msg: Message = {
      id: `${role === 'user' ? 'u' : 'b'}-${++msgCounter.current}`,
      role,
      text,
      ts: new Date().toISOString(),
    };
    setMessages((prev) => {
      const next = [...prev, msg];
      return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
    });
  }, []);

  const send = useCallback(async () => {
    const text = inputRef.current.trim();
    if (!text || loading || botOnline === false) return;

    inputRef.current = '';
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    addMessage('user', text);
    setLoading(true);

    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId }),
      });
      const data = await res.json();
      addMessage('bot', res.ok && data.reply ? data.reply : t('error'));
    } catch {
      addMessage('bot', t('error'));
    }
    setLoading(false);
  }, [loading, botOnline, sessionId, t, addMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        send();
      }
    },
    [send],
  );

  const inputDisabled = loading || botOnline === false;

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <span className="chat-header-label">{t('bot')}</span>
        <BotStatusBadge online={botOnline} latencyMs={botLatency} />
      </div>

      <div
        className="chat-messages"
        ref={containerRef}
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
      >
        {messages.length === 0 && !loading && (
          <div className="chat-empty">{t('empty')}</div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} role={m.role} text={m.text} ts={m.ts} />
        ))}
        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      <form
        className="chat-input-row"
        onSubmit={(e) => { e.preventDefault(); send(); }}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={inputDisabled ? t('disabled') : t('placeholder')}
          disabled={inputDisabled}
          rows={1}
          aria-label={t('placeholder')}
        />
        <button type="submit" disabled={inputDisabled || !input.trim()}>
          {t('send')}
        </button>
      </form>
    </div>
  );
}
