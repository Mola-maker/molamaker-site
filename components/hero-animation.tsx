'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';

/**
 * Wraps the hero section with Apple-style micro-interactions:
 * - Staggered GSAP entrance on mount
 * - Cursor-aware parallax on the hero heading
 * - Enhanced hover states
 *
 * Respects prefers-reduced-motion — skips all animations.
 */
export default function HeroAnimation({ children }: { children: React.ReactNode }) {
  const heroRef = useRef<HTMLDivElement>(null);
  const displayRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    const ctx = gsap.context(() => {
      // Staggered entrance
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      tl.fromTo(
        '.hero .label',
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.8 },
        0.1,
      );

      tl.fromTo(
        '.hero .display',
        { opacity: 0, y: 40 },
        { opacity: 1, y: 0, duration: 1 },
        0.2,
      );

      tl.fromTo(
        '.hero .lead span',
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.7, stagger: 0.12 },
        0.5,
      );

      tl.fromTo(
        '.hero-meta span',
        { opacity: 0, y: 12 },
        { opacity: 0.7, y: 0, duration: 0.5, stagger: 0.08 },
        0.9,
      );
    }, heroRef);

    return () => ctx.revert();
  }, []);

  // Cursor-aware parallax on hero heading
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    const hero = heroRef.current;
    if (!hero) return;

    function onMove(e: MouseEvent) {
      const rect = hero!.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;

      gsap.to('.hero .display', {
        x: x * -12,
        y: y * -8,
        duration: 0.8,
        ease: 'power2.out',
        overwrite: 'auto',
      });

      gsap.to('.hero .lead', {
        x: x * -6,
        y: y * -4,
        duration: 0.8,
        ease: 'power2.out',
        overwrite: 'auto',
      });
    }

    function onLeave() {
      gsap.to(['.hero .display', '.hero .lead'], {
        x: 0,
        y: 0,
        duration: 1.2,
        ease: 'power3.out',
        overwrite: 'auto',
      });
    }

    hero.addEventListener('mousemove', onMove, { passive: true });
    hero.addEventListener('mouseleave', onLeave);

    return () => {
      hero.removeEventListener('mousemove', onMove);
      hero.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return (
    <div ref={heroRef} className="hero-animation-wrapper">
      {children}
    </div>
  );
}
