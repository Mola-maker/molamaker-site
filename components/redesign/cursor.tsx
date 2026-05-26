'use client';

// Custom cursor — ported from app.jsx. Ring follows pointer with easing,
// inner dot tracks exactly. Adds magnetic hover state on a/button/[data-magnet].

import { useEffect, useRef } from 'react';

export function Cursor() {
  const ringRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const state = useRef({ x: 0, y: 0, tx: 0, ty: 0, hover: false, press: false });

  useEffect(() => {
    const s = state.current;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      s.tx = e.clientX;
      s.ty = e.clientY;
    };
    const onDown = () => {
      s.press = true;
      ringRef.current?.classList.add('is-press');
    };
    const onUp = () => {
      s.press = false;
      ringRef.current?.classList.remove('is-press');
    };
    const onOver = (e: PointerEvent) => {
      const t = (e.target as Element | null)?.closest('a, button, [data-magnet], [data-hover]');
      if (t) ringRef.current?.classList.add('is-hover');
    };
    const onOut = (e: PointerEvent) => {
      const t = (e.target as Element | null)?.closest('a, button, [data-magnet], [data-hover]');
      if (t) ringRef.current?.classList.remove('is-hover');
    };
    const loop = () => {
      s.x += (s.tx - s.x) * 0.18;
      s.y += (s.ty - s.y) * 0.18;
      if (ringRef.current) ringRef.current.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%,-50%)`;
      if (dotRef.current) dotRef.current.style.transform = `translate(${s.tx}px, ${s.ty}px) translate(-50%,-50%)`;
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointerover', onOver);
    window.addEventListener('pointerout', onOut);
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointerover', onOver);
      window.removeEventListener('pointerout', onOut);
    };
  }, []);

  return (
    <>
      <div className="cursor" ref={ringRef}></div>
      <div className="cursor-dot" ref={dotRef}></div>
    </>
  );
}
