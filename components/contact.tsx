'use client';
import { useState, useTransition } from 'react';
import { sendContact } from '@/app/actions';

export default function Contact() {
  const [state, setState] = useState({
    name: '', email: '', subject: '', message: ''
  });
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof typeof state>(k: K, v: string) {
    setState((s) => ({ ...s, [k]: v }));
  }

  async function submit() {
    if (!state.message.trim()) return;
    setError(null);
    const fd = new FormData();
    Object.entries(state).forEach(([k, v]) => fd.set(k, v));

    startTransition(async () => {
      const res = await sendContact(fd);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setOk(true);
      setState({ name: '', email: '', subject: '', message: '' });
      setTimeout(() => setOk(false), 5000);
    });
  }

  return (
    <section id="contact">
      <div className="label">05 — Contact</div>
      <h2>Send a note.</h2>
      <p className="lead">
        For longer things, anything private, or just to say hi. I read
        everything, reply to most.
      </p>
      <div className="contact-form">
        <div className="row">
          <input
            type="text"
            placeholder="Name"
            value={state.name}
            onChange={(e) => set('name', e.target.value)}
          />
          <input
            type="email"
            placeholder="Email"
            value={state.email}
            onChange={(e) => set('email', e.target.value)}
          />
        </div>
        <input
          type="text"
          placeholder="Subject"
          value={state.subject}
          onChange={(e) => set('subject', e.target.value)}
        />
        <textarea
          placeholder="What's on your mind?"
          value={state.message}
          onChange={(e) => set('message', e.target.value)}
        />
        <button
          className="send"
          onClick={submit}
          disabled={pending || !state.message.trim()}
          style={{ justifySelf: 'start' }}
        >
          {pending ? 'Sending…' : 'Send message →'}
        </button>
        {ok && <div className="form-ok">Thanks — your message landed. I&apos;ll get back to you soon.</div>}
        {error && <div className="form-err">{error}</div>}
      </div>
    </section>
  );
}
