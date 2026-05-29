'use client';

import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import ScrollProvider from './scroll-provider';
import TrainWindow from './train-window';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP, ScrollTrigger);
}

// Milestone data — the learning journey as a timeline.
const MILESTONES = [
  { year: '2023', glyph: '⬡', label: 'First lines of Python', body: 'Started with small scripts, data wrangling, and a lot of Stack Overflow.' },
  { year: '2024', glyph: '⊕', label: 'Agents & LLM tooling', body: 'Built my first agent pipeline. Contributed to AstrBot. Learned that prompts are code.' },
  { year: '2025', glyph: '⟁', label: 'GPU programming', body: 'Dove into CUDA. Rewrote kernels until SM utilisation climbed past 80%. Still learning.' },
  { year: '2026', glyph: '◈', label: 'Systems & intelligence', body: 'Building at the intersection — fast kernels, reasoning systems, and the seams between them.' },
];

// Orbital paths for the planets section — pure CSS animation driven by GSAP stagger.
const ORBITS = [
  { label: 'Python',     r: 60,  period: 8,  color: '#3E7C5F', size: 18 },
  { label: 'TypeScript', r: 100, period: 13, color: '#5E6B8C', size: 14 },
  { label: 'CUDA C++',   r: 148, period: 20, color: '#C96442', size: 20 },
  { label: 'Rust',       r: 196, period: 28, color: '#8A5A3B', size: 12 },
];

function PlanetsSection() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    const orbs = sectionRef.current?.querySelectorAll('.journey-orb-group');
    if (!orbs) return;
    gsap.fromTo(orbs,
      { opacity: 0, scale: 0.3 },
      { opacity: 1, scale: 1, stagger: 0.18, duration: 0.9,
        ease: 'back.out(1.7)',
        scrollTrigger: { trigger: sectionRef.current, start: 'top 65%', toggleActions: 'play none none reverse' },
      },
    );
    const sun = sectionRef.current?.querySelector('.journey-sun');
    if (sun) {
      gsap.fromTo(sun,
        { opacity: 0, scale: 0 },
        { opacity: 1, scale: 1, duration: 1.1, ease: 'elastic.out(1,0.5)',
          scrollTrigger: { trigger: sectionRef.current, start: 'top 70%', toggleActions: 'play none none reverse' },
        },
      );
    }
  }, { scope: sectionRef });

  return (
    <section className="journey-section journey-planets" ref={sectionRef}>
      <div className="journey-planets__orrery">
        {/* Sun */}
        <div className="journey-sun">
          <div className="journey-sun__core">me</div>
        </div>
        {/* Orbiting languages */}
        {ORBITS.map((o, i) => (
          <div
            key={i}
            className="journey-orb-group"
            style={{
              position: 'absolute',
              width: o.r * 2,
              height: o.r * 2,
              borderRadius: '50%',
              border: `1px dashed ${o.color}44`,
              animation: `orbit-spin ${o.period}s linear infinite`,
            }}
          >
            <div
              className="journey-orb"
              style={{
                position: 'absolute',
                top: -o.size / 2,
                left: '50%',
                marginLeft: -o.size / 2,
                width: o.size,
                height: o.size,
                borderRadius: '50%',
                background: o.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{
                position: 'absolute',
                top: -(o.size * 0.9),
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                color: o.color,
                whiteSpace: 'nowrap',
                animation: `orbit-counter ${o.period}s linear infinite`,
              }}>
                {o.label}
              </span>
            </div>
          </div>
        ))}
      </div>
      <p className="journey-planets__caption">Languages in orbit</p>
    </section>
  );
}

function TimelineSection() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    const cards = sectionRef.current?.querySelectorAll('.journey-mile');
    if (!cards) return;
    gsap.fromTo(cards,
      { opacity: 0, x: -40 },
      { opacity: 1, x: 0, stagger: 0.2, duration: 0.7, ease: 'power3.out',
        scrollTrigger: { trigger: sectionRef.current, start: 'top 60%', toggleActions: 'play none none reverse' },
      },
    );
    const line = sectionRef.current?.querySelector('.journey-mile-line');
    if (line) {
      gsap.fromTo(line, { scaleY: 0, transformOrigin: 'top' }, {
        scaleY: 1, duration: 1.4, ease: 'power2.out',
        scrollTrigger: { trigger: sectionRef.current, start: 'top 65%', toggleActions: 'play none none reverse' },
      });
    }
  }, { scope: sectionRef });

  return (
    <section className="journey-section journey-timeline" ref={sectionRef}>
      <div className="journey-timeline__inner">
        <div className="journey-mile-line" />
        {MILESTONES.map((m, i) => (
          <div key={i} className="journey-mile">
            <div className="journey-mile__glyph">{m.glyph}</div>
            <div className="journey-mile__content">
              <div className="journey-mile__year">{m.year}</div>
              <div className="journey-mile__label">{m.label}</div>
              <p className="journey-mile__body">{m.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function JourneyExperience() {
  const t = useTranslations('journey');
  const scaleSceneRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) return;
      const el = scaleSceneRef.current?.querySelector('.journey-demo-text');
      if (!el) return;
      gsap.fromTo(el,
        { scale: 0, rotate: 10 },
        { scale: 1, rotate: 0,
          scrollTrigger: { trigger: scaleSceneRef.current, start: 'top center', end: 'center center', scrub: 0.6 },
        },
      );
    },
    { scope: scaleSceneRef },
  );

  return (
    <ScrollProvider>
      {/* 1 — Hero */}
      <section className="journey-section">
        <h1 className="journey-hero-title">{t('heroTitle')}</h1>
      </section>

      {/* 2 — Train window parallax */}
      <TrainWindow />

      {/* 3 — Scale reveal */}
      <section className="journey-section" ref={scaleSceneRef}>
        <p className="journey-demo-text">{t('scrollToBegin')}</p>
      </section>

      {/* 4 — Planets / languages orrery */}
      <PlanetsSection />

      {/* 5 — Milestone timeline */}
      <TimelineSection />

      {/* 6 — Back home */}
      <section className="journey-section">
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-soft)', marginBottom: 24 }}>
            the journey continues
          </p>
          <Link href="/" className="journey-end-link">
            {t('backHome')}
          </Link>
        </div>
      </section>
    </ScrollProvider>
  );
}
