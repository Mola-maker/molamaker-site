'use client';
import { useEffect, useState } from 'react';

const SEQUENCE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

export default function Konami() {
  const [triggered, setTriggered] = useState(false);
  let idx = 0;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === SEQUENCE[idx].toLowerCase()) {
        idx++;
        if (idx === SEQUENCE.length) {
          setTriggered(true);
          idx = 0;
        }
      } else {
        idx = 0;
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  if (!triggered) return null;

  return (
    <div className="konami-overlay" onClick={() => setTriggered(false)}>
      <div className="konami-toast">
        <p style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontStyle: 'italic', marginBottom: 12 }}>
          between the kernel<br />and the user&apos;s hand —<br />a coral light blinks once
        </p>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-soft)' }}>
          you found it. press any key to dismiss.
        </p>
      </div>
    </div>
  );
}
