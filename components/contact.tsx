'use client';
import { useState, useActionState, useRef } from 'react';
import { sendContact } from '@/app/actions';

type ActionState = { error?: string; ok?: boolean } | null;

export default function Contact() {
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [, formAction, isPending] = useActionState<ActionState, FormData>(
    async (_prev: ActionState, formData: FormData) => {
      setError(null);
      const msgVal = (formData.get('message') as string)?.trim();
      if (!msgVal) return null;

      const res = await sendContact(formData);
      if (res?.error) {
        setError(res.error);
        return res;
      }

      setOk(true);
      formRef.current?.reset();
      setTimeout(() => setOk(false), 5000);
      return res;
    },
    null
  );

  return (
    <section id="contact">
      <div className="label">05 — Contact</div>
      <h2>Send a note.</h2>
      <p className="lead">
        For longer things, anything private, or just to say hi. I read
        everything, reply to most.
      </p>
      <form ref={formRef} action={formAction} className="contact-form">
        <div className="row">
          <input
            type="text"
            name="name"
            placeholder="Name"
          />
          <input
            type="email"
            name="email"
            placeholder="Email"
          />
        </div>
        <input
          type="text"
          name="subject"
          placeholder="Subject"
        />
        <textarea
          name="message"
          placeholder="What's on your mind?"
          required
        />
        <button
          className="send"
          type="submit"
          disabled={isPending}
          style={{ justifySelf: 'start' }}
        >
          {isPending ? 'Sending…' : 'Send message →'}
        </button>
        {ok && <div className="form-ok">Thanks — your message landed. I&apos;ll get back to you soon.</div>}
        {error && <div className="form-err">{error}</div>}
      </form>
    </section>
  );
}
