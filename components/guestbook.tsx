'use client';
import { useState, useTransition } from 'react';
import { signGuestbook } from '@/app/actions';

type Entry = {
  id: string;
  name: string;
  message: string;
  created_at: string;
};

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}

export default function Guestbook({ entries }: { entries: Entry[] }) {
  const [list, setList] = useState<Entry[]>(entries);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function submit() {
    if (!message.trim()) return;
    setError(null);

    // optimistic
    const optimistic: Entry = {
      id: 'tmp-' + Date.now(),
      name: name.trim() || 'anon',
      message: message.trim(),
      created_at: new Date().toISOString()
    };
    setList((l) => [optimistic, ...l]);
    const fd = new FormData();
    fd.set('name', name);
    fd.set('message', message);
    setName('');
    setMessage('');

    startTransition(async () => {
      const res = await signGuestbook(fd);
      if (res?.error) {
        setError(res.error);
        // rollback optimistic
        setList((l) => l.filter((e) => e.id !== optimistic.id));
      }
    });
  }

  return (
    <section id="guestbook">
      <div className="label">04 — Guestbook</div>
      <h2>Leave a trace. <em>If you&apos;d like.</em></h2>
      <p className="lead">
        A small, slow wall for passing thoughts. No accounts, no email —
        just a name and a note.
      </p>
      <div className="guestbook-form">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          maxLength={40}
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Say something kind…"
          maxLength={240}
          rows={1}
        />
        <button className="send" onClick={submit} disabled={pending || !message.trim()}>
          {pending ? 'Signing…' : 'Sign'}
        </button>
      </div>
      {error && <div className="form-err">{error}</div>}
      <div>
        {list.map((e) => (
          <div key={e.id} className="entry">
            <div className="entry-head">
              <span className="entry-name">{e.name}</span>
              <span className="entry-time">{timeAgo(e.created_at)}</span>
            </div>
            <div className="entry-msg">{e.message}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
