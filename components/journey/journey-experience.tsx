'use client';
import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import ScrollProvider from './scroll-provider';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP, ScrollTrigger);
}

export default function JourneyExperience() {
  const t = useTranslations('journey');
  const heroRef = useRef<HTMLDivElement>(null);
  const scaleSceneRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) return;

      const el = scaleSceneRef.current?.querySelector('.journey-demo-text');
      if (!el) return;

      gsap.fromTo(
        el,
        { scale: 0, rotate: 10 },
        {
          scale: 1,
          rotate: 0,
          scrollTrigger: {
            trigger: scaleSceneRef.current,
            start: 'top center',
            end: 'center center',
            scrub: 0.6,
          },
        },
      );
    },
    { scope: scaleSceneRef },
  );

  return (
    <ScrollProvider>
      <section className="journey-section" ref={heroRef}>
        <h1 className="journey-hero-title">{t('heroTitle')}</h1>
      </section>

      <section className="journey-section" ref={scaleSceneRef}>
        <p className="journey-demo-text">{t('scrollToBegin')}</p>
      </section>

      <section className="journey-section">
        <div className="journey-placeholder">{t('planetsPlaceholder')}</div>
      </section>

      <section className="journey-section">
        <div className="journey-placeholder">{t('finalPosePlaceholder')}</div>
      </section>

      <section className="journey-section">
        <Link href="/" className="journey-end-link">
          {t('backHome')}
        </Link>
      </section>
    </ScrollProvider>
  );
}
