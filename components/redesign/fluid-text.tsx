'use client';

// FluidText — chenglou/pretext-powered fluid typography.
//
// pretext does the text engine's job without touching the DOM: it measures
// and line-breaks the string with the browser's own font engine (canvas), so
// we know every word's line BEFORE rendering — no getBoundingClientRect
// thrash, no layout shift. That knowledge choreographs three layers:
//
//   1. entrance  — words cascade in (blur + rise), staggered per word AND
//                  per pretext-computed line, so multi-line headlines break
//                  like a wave instead of a flat fade
//   2. idle flow — a slow liquid drift, each word phase-shifted
//   3. ripple    — the cursor pushes a fluid bulge through the words with
//                  distance falloff (centers cached once per layout)
//
// On resize only pretext's cheap layout() path reruns to re-derive line
// assignments. SSR renders plain text; the fluid layer hydrates in.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext';

interface FluidWord {
  text: string;
  /** global word index (drives stagger + wave phase) */
  wi: number;
  /** pretext-computed line index (drives the line cascade) */
  li: number;
}

/** Assign each word of `text` to its pretext-computed line. Exported for tests. */
export function assignLines(lineTexts: string[], text: string): FluidWord[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: FluidWord[] = [];
  let li = 0;
  let cursor = 0; // position within lineTexts[li]
  for (let wi = 0; wi < words.length; wi++) {
    const w = words[wi];
    // advance to the line that contains this word next
    while (li < lineTexts.length) {
      const at = lineTexts[li].indexOf(w, cursor);
      if (at >= 0) { cursor = at + w.length; break; }
      li++;
      cursor = 0;
    }
    out.push({ text: w, wi, li: Math.min(li, Math.max(0, lineTexts.length - 1)) });
  }
  return out;
}

/** CJK has no spaces — flow per character instead of per word. */
function splitUnits(text: string): string[] {
  if (/[一-鿿぀-ヿ]/.test(text) && !/\s/.test(text.trim())) {
    return [...text.trim()];
  }
  return text.split(/\s+/).filter(Boolean);
}

type Props = {
  text: string;
  className?: string;
  tag?: 'span' | 'h1' | 'h2' | 'p' | 'em';
  /** stagger offset in word-slots (continue a cascade across segments) */
  delay?: number;
  /** cursor ripple (default true; disable for small/secondary text) */
  ripple?: boolean;
};

export function FluidText({ text, className = '', tag = 'span', delay = 0, ripple = true }: Props) {
  const Tag = tag;
  const hostRef = useRef<HTMLElement>(null);
  const [words, setWords] = useState<FluidWord[] | null>(null);
  const reducedRef = useRef(false);

  // ── layout knowledge via pretext ─────────────────────────────────
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    reducedRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedRef.current) return;

    let cancelled = false;
    let prepared: ReturnType<typeof prepareWithSegments> | null = null;
    let lastWidth = 0;

    const relayout = () => {
      if (cancelled || !prepared || !host.parentElement) return;
      const width = host.parentElement.clientWidth || window.innerWidth;
      if (Math.abs(width - lastWidth) < 2) return;
      lastWidth = width;
      const cs = getComputedStyle(host);
      const lineHeight = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
      try {
        const { lines } = layoutWithLines(prepared, width, lineHeight);
        const units = splitUnits(text);
        const lineTexts = lines.map((l: { text: string }) => l.text);
        // word-per-line assignment from pretext's own line breaks
        const assigned = /\s/.test(text.trim())
          ? assignLines(lineTexts, text)
          : units.map((u, wi) => ({ text: u, wi, li: 0 }));
        if (!cancelled) setWords(assigned);
      } catch { /* measurement failed — keep plain text */ }
    };

    const boot = async () => {
      try { await document.fonts.ready; } catch { /* older browsers */ }
      if (cancelled) return;
      const cs = getComputedStyle(host);
      const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      try {
        prepared = prepareWithSegments(text, font);
      } catch { return; }
      relayout();
    };
    void boot();

    const onResize = () => relayout();
    window.addEventListener('resize', onResize);
    return () => { cancelled = true; window.removeEventListener('resize', onResize); };
  }, [text]);

  // ── cursor ripple: a fluid bulge with distance falloff ───────────
  useEffect(() => {
    if (!ripple || !words || reducedRef.current) return;
    const host = hostRef.current;
    if (!host) return;
    const spans = Array.from(host.querySelectorAll<HTMLElement>('.ft__w'));
    if (!spans.length) return;

    // centers cached once per layout (a single read, not per-move)
    let centers: number[] = [];
    const cache = () => { centers = spans.map((s) => s.offsetLeft + s.offsetWidth / 2 + (host.getBoundingClientRect().left)); };
    cache();

    let raf = 0;
    let mx = -1;
    const apply = () => {
      raf = 0;
      for (let i = 0; i < spans.length; i++) {
        const d = Math.abs(centers[i] - mx);
        const lift = mx < 0 ? 0 : Math.exp(-(d * d) / 5200) * 10;
        spans[i].style.setProperty('--lift', `${lift.toFixed(2)}px`);
      }
    };
    const onMove = (e: PointerEvent) => {
      mx = e.clientX;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const onLeave = () => { mx = -1; if (!raf) raf = requestAnimationFrame(apply); };
    const onResize = () => cache();

    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerleave', onLeave);
    window.addEventListener('resize', onResize);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('resize', onResize);
    };
  }, [ripple, words]);

  // SSR / reduced-motion / pre-measure: plain text, zero shift
  if (!words) {
    return <Tag ref={hostRef as never} className={`ft ${className}`}>{text}</Tag>;
  }

  const cjk = !/\s/.test(text.trim());
  return (
    <Tag ref={hostRef as never} className={`ft ft--live ${className}`} aria-label={text}>
      {words.map((w, i) => (
        <span
          key={i}
          className="ft__w"
          aria-hidden="true"
          style={{ '--wi': w.wi + delay, '--li': w.li } as CSSProperties}
        >
          <span className="ft__inner">{w.text}</span>
          {!cjk && i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </Tag>
  );
}
