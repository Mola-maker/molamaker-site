'use client';
import { useEffect } from 'react';

export default function ScrollReveal() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      document.querySelectorAll('section').forEach((s) => s.classList.add('visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('visible');
            observer.unobserve(e.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    // Skip hero (above-fold) — it should be visible immediately
    document.querySelectorAll('section:not(.hero)').forEach((s) => {
      s.classList.add('reveal');
      observer.observe(s);
    });

    return () => observer.disconnect();
  }, []);
  return null;
}
