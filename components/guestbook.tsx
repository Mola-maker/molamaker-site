'use client';
import { useState, useActionState, useRef } from 'react';
import { signGuestbook } from '@/app/actions';

type Entry = {
  id: string;
  name: string;
  message: string;
  created_at: string;
};

type ActionState = { error?: string; ok?: boolean } | null;

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
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    async (_prev: ActionState, formData: FormData) => {
      const nameVal = (formData.get('name') as string)?.trim() || 'anon';
      const msgVal = (formData.get('message') as string)?.trim();
      if (!msgVal) return null;

      // optimistic insert
      const optimistic: Entry = {
        id: 'tmp-' + Date.now(),
        name: nameVal,
        message: msgVal,
        created_at: new Date().toISOString()
      };
      setList((l) => [optimistic, ...l]);

      const res = await signGuestbook(formData);
      if (res?.error) {
        // rollback optimistic entry
        setList((l) => l.filter((e) => e.id !== optimistic.id));
        return res;
      }

      formRef.current?.reset();
      return res;
    },
    null
  );

  return (
    <section id="guestbook">
      <div className="label">04 — Guestbook</div>
      <h2>Leave a trace. <em>If you&apos;d like.</em></h2>
      <p className="lead">
        A small, slow wall for passing thoughts. No accounts, no email —
        just a name and a note.
      </p>
      <form ref={formRef} action={formAction} className="guestbook-form">
        <input
          type="text"
          name="name"
          placeholder="Your name"
          maxLength={40}
        />
        <textarea
          name="message"
          placeholder="Say something kind…"
          maxLength={240}
          rows={1}
          required
        />
        <button className="send" type="submit" disabled={isPending}>
          {isPending ? 'Signing…' : 'Sign'}
        </button>
      </form>
      {state?.error && <div className="form-err">{state.error}</div>}
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
