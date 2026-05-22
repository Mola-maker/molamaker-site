'use client';
import Lenis from 'lenis';
import gsap from 'gsap';
import { useEffect, useState, useRef } from 'react';

export default function ScrollProvider({ children }: { children: React.ReactNode }) {
  const [smooth, setSmooth] = useState(true);
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isTouch =
      'ontouchstart' in window ||
      window.matchMedia('(pointer: coarse)').matches;
    setSmooth(!reduced && !isTouch);
  }, []);

  useEffect(() => {
    if (!smooth) return;

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    lenisRef.current = lenis;

    function raf(time: number): void {
      lenis.raf(time * 1000);
    }

    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(raf);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [smooth]);

  return <>{children}</>;
}
