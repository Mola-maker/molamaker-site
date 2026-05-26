'use client';

// Opening2 + MikuTransition — ported from opening.jsx. Boot-text reveal,
// orbit halo around Miku, and a per-variant transition sprite.

import { useEffect, useRef, useState } from 'react';

const ORBIT_TEXTS = [
  'systems', 'intelligence', 'CUDA', '边缘', 'kernel', 'agentic',
  'quiet', 'light', 'code', '思维', 'architecture', 'silence',
];

type Opening2Props = { onDone: () => void };

export function Opening2({ onDone }: Opening2Props) {
  const [out, setOut] = useState(false);
  const [typed, setTyped] = useState(0);

  // Capture the latest onDone in a ref so the rAF tick always calls the
  // current parent callback — and a `called` flag so we never double-fire.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);
  const calledRef = useRef(false);

  const lines = [
    { t: 'boot', s: 'molamaker', a: '00:00:01' },
    { t: 'preparing', s: 'paper stock · warm cream', a: 'ok' },
    { t: 'warming type', s: 'newsreader · jetbrains mono', a: 'ok' },
    { t: 'fetching', s: 'desk-side miku · live2d', a: 'ok' },
    { t: 'tuning', s: 'orbital glyphs', a: 'ok' },
    { t: 'settling', s: 'pixels', a: 'welcome' },
  ];
  const totalLines = lines.length;

  // rAF-driven schedule keyed off an absolute start time. This survives
  // React 19 dev StrictMode's double-effect-invocation (which would
  // otherwise cancel and recreate setTimeout/setInterval mid-flight),
  // and survives tab throttling — when the tab refocuses the elapsed
  // time will already be past 3900ms and onDone fires immediately.
  useEffect(() => {
    const startedAt = Date.now();
    let raf = 0;
    let cancelled = false;

    let outAt = 0; // absolute timestamp when exit animation was triggered

    const tick = () => {
      if (cancelled) return;
      const now = Date.now();
      const elapsed = now - startedAt;
      // Slower line reveal: 450 ms per line (was 360 ms)
      const i = Math.min(totalLines, Math.floor(elapsed / 450));
      setTyped(i);
      // Start exit fade at 4000 ms — ensures all lines have time to show
      if (elapsed >= 4000 && !outAt) {
        setOut(true);
        outAt = now;
      }
      // Fire onDone at least 800 ms after exit started — never on the same tick
      if (outAt && now - outAt >= 800) {
        if (!calledRef.current) {
          calledRef.current = true;
          onDoneRef.current?.();
        }
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // Belt-and-braces: even if rAF is paused (background tab) for a very
    // long time, a hard ceiling guarantees the opening always closes.
    const safety = window.setTimeout(() => {
      if (!calledRef.current) {
        calledRef.current = true;
        setOut(true);
        onDoneRef.current?.();
      }
    }, 6000);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(safety);
    };
  }, [totalLines]);

  const skip = () => {
    if (calledRef.current) return;
    setOut(true);
    window.setTimeout(() => {
      if (!calledRef.current) {
        calledRef.current = true;
        onDoneRef.current?.();
      }
    }, 500);
  };

  // Keyboard dismiss: Enter / Escape / Space skips the opening sequence
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') {
        e.preventDefault();
        skip();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const orbit1 = ORBIT_TEXTS.slice(0, 6);
  const orbit2 = ORBIT_TEXTS.slice(6);

  return (
    <div
      className={`opening2 ${out ? 'is-out' : ''}`}
      onClick={skip}
      role="dialog"
      aria-modal="true"
      aria-label="Opening sequence — press Enter or Escape to skip"
      tabIndex={0}
    >
      <div className="opening2__bg" aria-hidden="true">
        {/* Hi-fi mp4 background — replaces low-res GIF backdrop */}
        <video
          className="opening2__bg-video"
          autoPlay
          loop
          muted
          playsInline
          tabIndex={-1}
        >
          <source src="/photo/2677973855/miku-compressed.mp4" type="video/mp4" />
        </video>
      </div>
      <div className="opening2__rays"></div>
      <div className="opening2__mark">— mise en lumière —</div>

      <button
        className="opening2__hint"
        onClick={(e) => {
          e.stopPropagation();
          skip();
        }}
      >
        <span className="key">↵</span> enter
      </button>

      <div className="opening2__stage">
        <div className="opening2__sig"></div>

        <div className="opening2__halo opening2__halo--3"></div>
        <div className="opening2__halo opening2__halo--2"></div>
        <div className="opening2__halo"></div>

        <div className="opening2__miku">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/redesign/miku-dance.gif" alt="Miku" />
        </div>

        <div className="opening2__orbit">
          {orbit1.map((w, i) => {
            const angle = (i / orbit1.length) * 360;
            const radius = 220;
            return (
              <span
                key={i}
                className={`opening2__orbit-word ${i % 3 === 0 ? 'accent' : ''}`}
                style={{ transform: `rotate(${angle}deg) translateX(${radius}px) rotate(-${angle}deg)` }}
              >
                <span>· {w} ·</span>
              </span>
            );
          })}
        </div>
        <div className="opening2__orbit opening2__orbit--rev">
          {orbit2.map((w, i) => {
            const angle = (i / orbit2.length) * 360 + 30;
            const radius = 270;
            return (
              <span
                key={i}
                className="opening2__orbit-word"
                style={{ transform: `rotate(${angle}deg) translateX(${radius}px) rotate(-${angle}deg)` }}
              >
                <span>{w}</span>
              </span>
            );
          })}
        </div>
      </div>

      <div className="opening2__lines">
        {lines.slice(0, typed + 1).map((l, i) => (
          <div key={i} className={`row ${i === typed ? 'is-typed' : ''}`}>
            &gt;&nbsp; <i>{l.t}</i> {l.s} &nbsp;<b>{l.a}</b>
          </div>
        ))}
      </div>

      <div className="opening2__meta">
        Quiet desk · est. 2026
        <br />
        <span className="big">
          mola<em>maker</em>.
        </span>
      </div>
    </div>
  );
}

const MIKU_GESTURES: Record<string, { src: string; label: string; emoji: string }> = {
  terminal: { src: '/redesign/miku-preview.jpg', label: 'thumbs-up', emoji: '👍' },
  magazine: { src: '/redesign/miku-dance.gif', label: 'twirls in', emoji: '💃' },
  atlas: { src: '/redesign/miku-orbit.gif', label: 'flying', emoji: '✦' },
  stream: { src: '/redesign/miku-preview.jpg', label: 'waves', emoji: '👋' },
};

type MikuTransitionProps = { variant: string; label: string };

export function MikuTransition({ variant, label }: MikuTransitionProps) {
  const g = MIKU_GESTURES[variant];
  return (
    <div className="miku-transition is-active" aria-hidden="true">
      <div className="miku-transition__streak"></div>
      <div className="miku-transition__streak"></div>
      <div className="miku-transition__streak"></div>

      <div className="miku-transition__curtain"></div>

      <div className="miku-transition__trail"></div>
      <div className="miku-transition__trail"></div>
      <div className="miku-transition__trail"></div>
      <div className="miku-transition__trail"></div>
      <div className="miku-transition__trail"></div>
      <div className="miku-transition__trail"></div>

      <div className="miku-transition__sprite">
        {g ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={g.src} alt="" />
        ) : (
          <div className="placeholder">♬</div>
        )}
      </div>
      <div className="miku-transition__label">
        <span className="gesture">{g?.emoji || '✦'}</span>
        {g?.label || 'switching'} · {label}
      </div>
      <div className="miku-transition__banner">
        <span className="idx">{label}</span>
        <span>{variant}</span>
      </div>
    </div>
  );
}
