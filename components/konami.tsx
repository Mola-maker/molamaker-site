'use client';
import { useEffect, useRef, useState } from 'react';

const SEQUENCE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

export default function Konami() {
  const [triggered, setTriggered] = useState(false);
  const idxRef = useRef(0);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (typeof e.key !== 'string') return;
      const expected = SEQUENCE[idxRef.current];
      if (expected && e.key.toLowerCase() === expected.toLowerCase()) {
        if (e.key.startsWith('Arrow')) e.preventDefault();
        idxRef.current++;
        if (idxRef.current === SEQUENCE.length) {
          setTriggered(true);
          idxRef.current = 0;
        }
      } else {
        idxRef.current = 0;
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
