'use client';

// Shared AstrBot chat logic — extracted from astrbot-chat.tsx so both the
// bottom-right bubble and the Live2D mascot renderers share one truth.
// The hook manages all state, SSE streaming, file-upload, sessionStorage sync,
// drag tracking and panel positioning. Renderers consume it via the returned
// API and supply their own JSX.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

// ── Types ────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'bot';
  text: string;
  ts: number;
  image?: string; // local preview URL for a photo the visitor sent
}

export type ChatAttachment = { file: File; previewUrl: string; type: 'image' | 'file' };

export type PanelAnchor = 'bottom-right' | 'bottom-left';

// ── Helpers ──────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export function toMarkdown(text: string): string {
  return text.replace(
    /(^|[^(\]])(https?:\/\/[^\s)]+\.(?:png|jpe?g|gif|webp|svg)(?:\?\S*)?)/gi,
    '$1![]($2)',
  );
}

export const INITIAL_MESSAGE: ChatMessage = {
  id: 'init',
  role: 'bot',
  text: 'こんにちは！ I\'m Miku × AstrBot ✦\nAsk me anything about this site, or just chat!',
  ts: 0,
};

// ── Panel-position calculator ─────────────────────────────────────
// Shared so both renderers can position the chat panel near the right
// corner (bubble) or left corner (Live2D).

export function getPanelPos(
  pos: { x: number; y: number },
  anchor: PanelAnchor = 'bottom-right',
): React.CSSProperties {
  if (typeof window === 'undefined') return {};
  const W = 340;
  const H = Math.min(480, window.innerHeight - 80);
  const BUBBLE = 52;
  const GAP = 8;
  const EDGE = 8;

  if (anchor === 'bottom-left') {
    // Live2D character sits at bottom-left and occupies ~280px width.
    // Place the chat panel to its RIGHT so it never covers the character's face.
    // Also lift it ~60px from the very bottom so it floats above the character's head.
    const CHAR_WIDTH = 280;
    const CHAR_HEIGHT_OFFSET = 60;

    let left = EDGE + CHAR_WIDTH;
    let top  = window.innerHeight - H - GAP - CHAR_HEIGHT_OFFSET;

    left = Math.max(EDGE, Math.min(left, window.innerWidth  - W - EDGE));
    top  = Math.max(EDGE, Math.min(top,  window.innerHeight - H - EDGE));

    return { top, left, height: H };
  }

  // bottom-right (existing bubble behaviour)
  const bRight  = window.innerWidth  - 24 + pos.x;
  const bLeft   = bRight - BUBBLE;
  const bBottom = window.innerHeight - 24 + pos.y;
  const bTop    = bBottom - BUBBLE;

  let left = bRight - W;
  if (left < EDGE) left = bLeft;

  let top = bTop - GAP - H;
  if (top < EDGE) top = bBottom + GAP;

  left = Math.max(EDGE, Math.min(left, window.innerWidth  - W - EDGE));
  top  = Math.max(EDGE, Math.min(top,  window.innerHeight - H - EDGE));

  return { top, left, height: H };
}

// ── Hook ──────────────────────────────────────────────────────────

export function useAstrbotChat(options?: {
  hideBubble?: boolean; // renderers that provide their own toggle skip the internal bubble-open logic
  astrbotOnly?: boolean; // route this chat through AstrBot's LLM only (no DeepSeek/Coze fallback)
}) {
  const astrbotOnly = options?.astrbotOnly ?? false;
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [attachment, setAttachment] = useState<ChatAttachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Share session ID with the terminal chat so both talk to the same conversation
  const [sessionId, setSessionId] = useState(() => {
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

  // Per-character personality system prompt (set by the Live2D renderer when
  // the visitor switches the model; the bottom-right bubble leaves it undefined).
  const [persona, setPersona] = useState<string | undefined>(undefined);

  // Start a fresh server-side conversation — used when the persona changes so
  // the new character doesn't inherit the previous one's context.
  const resetSession = useCallback(() => {
    const id = `chat-${uid()}`;
    try { sessionStorage.setItem('mola:chat-sid', id); } catch { /* ignore */ }
    setSessionId(id);
    return id;
  }, []);

  // Dragging state
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const bubbleRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // ── Effects ────────────────────────────────────────────────────

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

  // ── Attachment ─────────────────────────────────────────────────

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

  // ── Send ───────────────────────────────────────────────────────

  const send = useCallback(async () => {
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
    const userMsg: ChatMessage = { id: uid(), role: 'user', text, ts: Date.now(), image: localImage };
    setMessages((m) => [...m, userMsg]);
    setAttachment(null);
    if (fileRef.current) fileRef.current.value = '';
    setLoading(true);

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

    // Text messages stream live, token by token
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
        body: JSON.stringify({ message: text, session_id: sessionId, persona, astrbot_only: astrbotOnly }),
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
  }, [input, loading, uploading, attachment, sessionId, persona, astrbotOnly]);

  // ── Keyboard ────────────────────────────────────────────────────

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  // ── Drag handlers ───────────────────────────────────────────────

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

  // ── Panel position helper ───────────────────────────────────────

  const panelStyle = useCallback((anchor: PanelAnchor = 'bottom-right') => {
    return getPanelPos(pos, anchor);
  }, [pos]);

  return {
    // State
    open, setOpen,
    messages, setMessages,
    input, setInput,
    loading,
    attachment,
    uploading,
    sessionId,
    configured,
    persona, setPersona,
    // Refs
    fileRef, bodyRef, bubbleRef,
    // Actions
    send, clearAttachment, onPickFile, onKeyDown, resetSession,
    // Drag
    onMouseDown, pos,
    // Panel
    panelStyle,
    // Constants
    INITIAL_MESSAGE,
  } as const;
}
