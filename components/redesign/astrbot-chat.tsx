'use client';

// AstrBot floating chat widget.
// A draggable Miku bubble (bottom-right) that expands into a chat panel
// communicating with the AstrBot proxy at /api/astrbot/chat.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { assetUrl } from '@/lib/asset-url';

interface Message {
  id: string;
  role: 'user' | 'bot';
  text: string;
  ts: number;
  image?: string; // local preview URL for a photo the visitor sent
}

type Attachment = { file: File; previewUrl: string; type: 'image' | 'file' };

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// Render message text: markdown images ![](url) and bare image URLs become
// inline <img>; all other text keeps its line breaks. Used for bot replies so
// AstrBot/Coze image responses show as photos instead of raw URLs.
const IMG_RE = /!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s"'<>]+?\.(?:png|jpe?g|gif|webp|svg)(?:\?[^\s"'<>]*)?)/gi;

function renderLines(chunk: string, baseKey: number) {
  const lines = chunk.split('\n');
  return lines.map((line, i) => (
    <span key={`t-${baseKey}-${i}`}>{line}{i < lines.length - 1 && <br />}</span>
  ));
}

function renderMessage(text: string): React.ReactNode {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  IMG_RE.lastIndex = 0;
  while ((m = IMG_RE.exec(text)) !== null) {
    if (m.index > last) nodes.push(...renderLines(text.slice(last, m.index), key++));
    const url = m[1] ?? m[2];
    // eslint-disable-next-line @next/next/no-img-element
    nodes.push(<img key={`img-${key++}`} className="ab-msg__img" src={url} alt="" loading="lazy" />);
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(...renderLines(text.slice(last), key++));
  return nodes;
}

const INITIAL_MESSAGE: Message = {
  id: 'init',
  role: 'bot',
  text: 'こんにちは！ I\'m Miku × AstrBot ✦\nAsk me anything about this site, or just chat!',
  ts: 0,
};

export function AstrbotChat() {
  const [open, setOpen] = useState(false);
  // Start with the initial message (same on server+client); load history in useLayoutEffect
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // Share session ID with the terminal chat so both talk to the same AstrBot conversation
  const [sessionId] = useState(() => {
    try {
      const stored = sessionStorage.getItem('mola:chat-sid');
      if (stored) return stored;
      const id = `chat-${uid()}`;
      sessionStorage.setItem('mola:chat-sid', id);
      return id;
    } catch {
      return `chat-${uid()}`;
    }
  });
  const [configured, setConfigured] = useState<boolean | null>(null);

  // Dragging state
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const bubbleRef = useRef<HTMLDivElement>(null);

  const bodyRef = useRef<HTMLDivElement>(null);

  // Probe whether AstrBot is configured (GET returns 200 if configured, 503 if not)
  useEffect(() => {
    fetch('/api/astrbot/chat')
      .then((r) => setConfigured(r.status !== 503))
      .catch(() => setConfigured(false));
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages, open]);

  // Load shared history from sessionStorage before first paint
  useLayoutEffect(() => {
    try {
      const saved = sessionStorage.getItem('mola:chat-messages');
      if (saved) {
        const parsed = JSON.parse(saved) as Array<{ role: 'bot' | 'user'; text: string }>;
        if (parsed.length > 0)
          setMessages(parsed.map((m, i) => ({ id: `stored-${i}`, role: m.role as 'user' | 'bot', text: m.text, ts: 0 })));
      }
    } catch { /* ignore */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist to shared key + notify terminal chat on every change
  useEffect(() => {
    try {
      sessionStorage.setItem('mola:chat-messages', JSON.stringify(messages.map((m) => ({ role: m.role, text: m.text }))));
      window.dispatchEvent(new CustomEvent('mola:chat-update'));
    } catch { /* ignore */ }
  }, [messages]);

  // Pull updates that originated from the terminal chat
  useEffect(() => {
    const handler = () => {
      try {
        const saved = sessionStorage.getItem('mola:chat-messages');
        if (!saved) return;
        const parsed = JSON.parse(saved) as Array<{ role: 'bot' | 'user'; text: string }>;
        const incoming = parsed.map((m, i) => ({ id: `stored-${i}`, role: m.role as 'user' | 'bot', text: m.text, ts: 0 }));
        setMessages((cur) => {
          const curSerialized = JSON.stringify(cur.map((c) => ({ role: c.role, text: c.text })));
          return curSerialized === saved ? cur : incoming;
        });
      } catch { /* ignore */ }
    };
    window.addEventListener('mola:chat-update', handler);
    return () => window.removeEventListener('mola:chat-update', handler);
  }, []);

  const clearAttachment = useCallback(() => {
    setAttachment((cur) => {
      if (cur?.previewUrl) URL.revokeObjectURL(cur.previewUrl);
      return null;
    });
    if (fileRef.current) fileRef.current.value = '';
  }, []);

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!f) return;
    const isImg = f.type.startsWith('image/');
    setAttachment((cur) => {
      if (cur?.previewUrl) URL.revokeObjectURL(cur.previewUrl);
      return { file: f, previewUrl: isImg ? URL.createObjectURL(f) : '', type: isImg ? 'image' : 'file' };
    });
  };

  const send = async () => {
    const text = input.trim();
    if ((!text && !attachment) || loading || uploading) return;

    let attachPayload: { type: string; attachment_id: string } | null = null;
    let localImage: string | undefined;

    // Upload the attachment first to obtain an AstrBot attachment_id.
    if (attachment) {
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append('file', attachment.file);
        const up = await fetch('/api/astrbot/upload', { method: 'POST', body: fd });
        const uj = await up.json().catch(() => ({})) as { data?: { attachment_id: string; type: string }; error?: { message?: string } };
        if (!up.ok || !uj.data) {
          setMessages((m) => [...m, { id: uid(), role: 'bot', text: uj.error?.message ?? 'Upload failed — try a smaller file.', ts: Date.now() }]);
          setUploading(false);
          return;
        }
        attachPayload = { type: uj.data.type, attachment_id: uj.data.attachment_id };
        if (attachment.type === 'image') localImage = attachment.previewUrl;
      } catch {
        setMessages((m) => [...m, { id: uid(), role: 'bot', text: 'Upload failed — please retry.', ts: Date.now() }]);
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    setInput('');
    const userMsg: Message = { id: uid(), role: 'user', text, ts: Date.now(), image: localImage };
    setMessages((m) => [...m, userMsg]);
    // The preview URL now belongs to the sent message; just drop it from the composer.
    setAttachment(null);
    if (fileRef.current) fileRef.current.value = '';
    setLoading(true);

    // Attachments use the non-streaming JSON route (AstrBot returns the reply
    // once it has processed the file).
    if (attachPayload) {
      try {
        const r = await fetch('/api/astrbot/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, session_id: sessionId, attachments: [attachPayload] }),
        });
        if (!r.ok) {
          const j = await r.json().catch(() => ({})) as { error?: { message?: string } };
          setMessages((m) => [...m, { id: uid(), role: 'bot', text: j.error?.message ?? 'AI is temporarily unavailable — try again in a moment.', ts: Date.now() }]);
          return;
        }
        const json = await r.json() as { data?: { message?: string; reply?: string } };
        const reply = json.data?.message ?? json.data?.reply ?? 'AI is temporarily unavailable — try again in a moment.';
        setMessages((m) => [...m, { id: uid(), role: 'bot', text: reply, ts: Date.now() }]);
      } catch {
        setMessages((m) => [...m, { id: uid(), role: 'bot', text: 'Connection lost — please retry.', ts: Date.now() }]);
      } finally {
        setLoading(false);
      }
      return;
    }

    // Text messages stream live, token by token, into one growing bot bubble.
    const botId = uid();
    let acc = '';
    let started = false;
    const pushToken = (tok: string) => {
      acc += tok;
      if (!started) {
        started = true;
        setMessages((m) => [...m, { id: botId, role: 'bot', text: acc, ts: Date.now() }]);
      } else {
        setMessages((m) => m.map((x) => (x.id === botId ? { ...x, text: acc } : x)));
      }
    };

    try {
      const r = await fetch('/api/astrbot/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, session_id: sessionId }),
      });
      if (!r.ok || !r.body) {
        setMessages((m) => [...m, { id: uid(), role: 'bot', text: 'AI is temporarily unavailable — try again in a moment.', ts: Date.now() }]);
        return;
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
          const line = part.split('\n').find((l) => l.startsWith('data:'));
          if (!line) continue;
          const raw = line.slice(5).trim();
          if (raw === '[DONE]') { buf = ''; break; }
          try {
            const { token } = JSON.parse(raw) as { token?: string };
            if (token) pushToken(token);
          } catch { /* skip malformed frame */ }
        }
      }
      if (!started) {
        setMessages((m) => [...m, { id: uid(), role: 'bot', text: 'AI is temporarily unavailable — try again in a moment.', ts: Date.now() }]);
      }
    } catch {
      if (started) {
        setMessages((m) => m.map((x) => (x.id === botId ? { ...x, text: `${acc} …(connection lost)` } : x)));
      } else {
        setMessages((m) => [...m, { id: uid(), role: 'bot', text: 'Connection lost — please retry.', ts: Date.now() }]);
      }
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  // Drag handlers
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (!bubbleRef.current) return;
    dragging.current = true;
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
    e.preventDefault();
  }, [pos]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      setPos({
        x: dragStart.current.px + (e.clientX - dragStart.current.mx),
        y: dragStart.current.py + (e.clientY - dragStart.current.my),
      });
    };
    const onMouseUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  // Don't render bubble if AstrBot is definitely not configured
  if (configured === false) return null;

  const bubbleStyle: React.CSSProperties = {
    transform: `translate(${pos.x}px, ${pos.y}px)`,
  };

  // Compute a fixed panel position that stays fully in-viewport.
  // The widget sits at CSS right:28px, bottom:28px and is dragged via pos.x/pos.y.
  // Prefer: open to the upper-left of the bubble. Flip to right or down if there's no room.
  const getPanelPos = (): React.CSSProperties => {
    if (typeof window === 'undefined') return {};
    const W = 340;
    const H = Math.min(480, window.innerHeight - 80);
    const BUBBLE = 52;
    const GAP = 8;
    const EDGE = 8; // min margin from viewport edges

    // Bubble's visual viewport coordinates (CSS anchor + drag offset)
    const bRight  = window.innerWidth  - 24 + pos.x;
    const bLeft   = bRight - BUBBLE;
    const bBottom = window.innerHeight - 24 + pos.y;
    const bTop    = bBottom - BUBBLE;

    // Horizontal: align panel's right edge with bubble's right edge, fall back to left-align
    let left = bRight - W;
    if (left < EDGE) left = bLeft;

    // Vertical: open above bubble, fall back to below
    let top = bTop - GAP - H;
    if (top < EDGE) top = bBottom + GAP;

    // Hard clamp so the panel never clips any edge
    left = Math.max(EDGE, Math.min(left, window.innerWidth  - W - EDGE));
    top  = Math.max(EDGE, Math.min(top,  window.innerHeight - H - EDGE));

    return { top, left, height: H };
  };

  return (
    <>
      <div className="ab-widget" style={bubbleStyle} ref={bubbleRef}>
        {/* Floating bubble — hidden while panel is open */}
        {!open && (
          <button
            className="ab-bubble"
            onClick={() => setOpen(true)}
            onMouseDown={onMouseDown}
            aria-label="Open AstrBot chat"
            title="Chat with AstrBot"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={assetUrl('/redesign/miku-dance.gif')} alt="Miku" className="ab-bubble__gif" />
            <span className="ab-bubble__badge" aria-hidden="true">✦</span>
          </button>
        )}
      </div>

      {/* Panel portaled to body so position:fixed is relative to the viewport,
          not the transformed .ab-widget parent */}
      {open && createPortal(
        <div className="ab-panel" style={getPanelPos()}>
          <div className="ab-panel__header" onMouseDown={onMouseDown}>
            <div className="ab-panel__avatar">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={assetUrl('/redesign/miku-dance.gif')} alt="" />
            </div>
            <div className="ab-panel__title">
              <span className="ab-panel__name">AstrBot × Miku</span>
              <span className="ab-panel__status">
                <span className="ab-status-dot" />
                {configured ? 'online' : 'connecting…'}
              </span>
            </div>
            <button
              className="ab-panel__reset"
              onClick={() => { setMessages([INITIAL_MESSAGE]); setInput(''); }}
              onMouseDown={(e) => e.stopPropagation()}
              aria-label="Reset chat"
              title="Reset chat"
            >↺</button>
            <button className="ab-panel__close" onClick={() => setOpen(false)} onMouseDown={(e) => e.stopPropagation()} aria-label="Close">×</button>
          </div>

          <div className="ab-panel__body" ref={bodyRef}>
            {messages.map((msg) => (
              <div key={msg.id} className={`ab-msg ab-msg--${msg.role}`}>
                {msg.role === 'bot' && (
                  <span className="ab-msg__avatar" aria-hidden="true">✦</span>
                )}
                <div className="ab-msg__bubble">
                  {msg.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="ab-msg__img" src={msg.image} alt="" />
                  )}
                  {msg.text && renderMessage(msg.text)}
                </div>
              </div>
            ))}
            {loading && messages[messages.length - 1]?.role !== 'bot' && (
              <div className="ab-msg ab-msg--bot">
                <span className="ab-msg__avatar" aria-hidden="true">✦</span>
                <div className="ab-msg__bubble ab-typing">
                  <span /><span /><span />
                </div>
              </div>
            )}
          </div>

          <div className="ab-panel__footer">
            {attachment && (
              <div className="ab-attach">
                {attachment.type === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="ab-attach__thumb" src={attachment.previewUrl} alt="" />
                ) : (
                  <span className="ab-attach__file" aria-hidden="true">📄</span>
                )}
                <span className="ab-attach__name">{attachment.file.name}</span>
                <button className="ab-attach__remove" onClick={clearAttachment} onMouseDown={(e) => e.stopPropagation()} aria-label="Remove attachment">×</button>
              </div>
            )}
            <div className="ab-panel__input-row">
              <button
                className="ab-panel__attach"
                onClick={() => fileRef.current?.click()}
                disabled={loading || uploading}
                aria-label="Attach a photo or file"
                title="Attach a photo or file"
              >📎</button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf,text/plain"
                hidden
                onChange={onPickFile}
              />
              <textarea
                className="ab-panel__input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Ask anything… (Enter to send)"
                rows={1}
                disabled={loading}
              />
              <button
                className="ab-panel__send"
                onClick={send}
                disabled={loading || uploading || (!input.trim() && !attachment)}
                aria-label="Send"
              >
                {uploading ? '…' : '↑'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
