'use client';
import { useEffect } from 'react';

export default function CursorGlow() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.matchMedia('(hover: hover)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let raf = 0;
    const glow = document.createElement('div');
    glow.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:0;opacity:0.08;transition:opacity .3s';
    document.body.prepend(glow);

    const move = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        glow.style.background = `radial-gradient(600px at ${e.clientX}px ${e.clientY}px, var(--accent), transparent 80%)`;
      });
    };
    document.addEventListener('mousemove', move, { passive: true });
    return () => {
      document.removeEventListener('mousemove', move);
      glow.remove();
    };
  }, []);
  return null;
}
