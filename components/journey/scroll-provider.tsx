'use client';

import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useEffect, useState, useRef } from 'react';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * Global smooth-scroll provider with Apple-style inertial damping.
 *
 * Wires the Lenis instance to GSAP's ticker so ScrollTrigger stays in
 * sync. Touch devices and reduced-motion users skip smooth scrolling.
 */
export default function ScrollProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(true);
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isTouch =
      'ontouchstart' in window ||
      window.matchMedia('(pointer: coarse)').matches;
    setEnabled(!reduced && !isTouch);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // Apple-style: moderate duration + custom easing that feels
    // like inertial decay rather than linear interpolation
    const lenis = new Lenis({
      duration: 1.6,
      // Inertial ease — fast initial deceleration, long tail
      easing: (t: number) => {
        // Apple-style cubic-bezier(0.25, 0.1, 0.25, 1.0) approximation
        const c = 1.6;
        return t === 1 ? 1 : 1 - Math.pow(2, -c * t);
      },
      smoothWheel: true,
      wheelMultiplier: 0.8,
      lerp: 0.08,
      infinite: false,
      orientation: 'vertical',
      gestureOrientation: 'vertical',
    });

    lenisRef.current = lenis;
    document.documentElement.classList.add('lenis', 'lenis-smooth');

    // Sync Lenis → GSAP ticker (required for ScrollTrigger)
    function raf(time: number): void {
      lenis.raf(time * 1000);
    }

    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    // Refresh ScrollTrigger positions after Lenis scroll
    const onScroll = () => {
      ScrollTrigger.update();
    };
    lenis.on('scroll', onScroll);

    return () => {
      gsap.ticker.remove(raf);
      lenis.off('scroll', onScroll);
      lenis.destroy();
      lenisRef.current = null;
      document.documentElement.classList.remove('lenis', 'lenis-smooth');
    };
  }, [enabled]);

  return <>{children}</>;
}
