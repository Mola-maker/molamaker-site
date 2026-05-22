'use client';

import { useRef, useEffect, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP, ScrollTrigger);
}

export default function TrainWindow() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const midRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLDivElement>(null);
  // Tri-state: null → not yet detected, true/false → detected.
  // Prevents hydration mismatch (server always renders null state).
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setIsMobile(window.matchMedia('(max-width: 768px)').matches);
    setReducedMotion(
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
  }, []);

  useGSAP(
    () => {
      if (reducedMotion || isMobile !== false) return;

      const layers = [bgRef.current, midRef.current, fgRef.current].filter(Boolean);

      // Promote layers to GPU only during active scroll (not permanent CSS will-change)
      gsap.set(layers, { willChange: 'transform' });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      });

      tl.fromTo(bgRef.current, { x: '0%' }, { x: '-12%', ease: 'none' }, 0);
      tl.fromTo(midRef.current, { x: '0%' }, { x: '-45%', ease: 'none' }, 0);
      tl.fromTo(fgRef.current, { x: '0%' }, { x: '-110%', ease: 'none' }, 0);

      // Caption: fade in between top 60%→30%, hold, fade out between bottom 60%→20%
      gsap.fromTo(
        captionRef.current,
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 60%',
            end: 'top 30%',
            scrub: true,
          },
        },
      );

      gsap.fromTo(
        captionRef.current,
        { opacity: 1 },
        {
          opacity: 0,
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'bottom 60%',
            end: 'bottom 20%',
            scrub: true,
          },
        },
      );

      // Camera shake — subtle random y jitter on the frame
      gsap.to(frameRef.current, {
        y: 'random(-3, 3)',
        duration: 0.25,
        repeat: -1,
        repeatRefresh: true,
        ease: 'none',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top bottom',
          end: 'bottom top',
          toggleActions: 'play pause resume pause',
        },
      });

      // Clean up will-change after section exits
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: 'bottom bottom',
        end: 'bottom bottom',
        onLeave: () => gsap.set(layers, { willChange: 'auto' }),
        onEnterBack: () => gsap.set(layers, { willChange: 'transform' }),
      });
    },
    { scope: sectionRef, dependencies: [isMobile, reducedMotion] },
  );

  // Before client-side detection runs, render nothing (match server output).
  // After detection: mobile → static bg, desktop → 3 parallax layers.
  const layers =
    isMobile === null ? null : isMobile ? (
      <div
        className="train-static-bg"
        style={{ backgroundImage: 'url(/journey/train/background.svg)' }}
      />
    ) : (
      <>
        <div
          ref={bgRef}
          className="parallax-layer parallax-layer--bg"
          style={{ backgroundImage: 'url(/journey/train/background.svg)' }}
        />
        <div
          ref={midRef}
          className="parallax-layer parallax-layer--mid"
          style={{ backgroundImage: 'url(/journey/train/middle.svg)' }}
        />
        <div
          ref={fgRef}
          className="parallax-layer parallax-layer--fg"
          style={{ backgroundImage: 'url(/journey/train/foreground.svg)' }}
        />
      </>
    );

  return (
    <section
      className="train-section"
      ref={sectionRef}
      role="region"
      aria-label="Train window parallax scene"
    >
      <div className="train-window">
        <div className="train-viewport">{layers}</div>
        <div className="train-frame" ref={frameRef} aria-hidden="true">
          <svg
            viewBox="0 0 1200 680"
            preserveAspectRatio="xMidYMid meet"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="train-frame-svg"
            aria-hidden="true"
          >
            <rect x="40" y="30" width="1120" height="620" rx="24" stroke="#2a2520" strokeWidth="60" />
            <rect x="40" y="30" width="1120" height="620" rx="24" stroke="#3d3530" strokeWidth="12" />
            <rect x="55" y="45" width="1090" height="590" rx="16" stroke="#1a1510" strokeWidth="3" />
            <line x1="600" y1="30" x2="600" y2="650" stroke="#3d3530" strokeWidth="28" />
            <rect x="560" y="45" width="80" height="38" rx="6" fill="#2a2520" />
            <circle cx="850" cy="350" r="4" fill="#1a1510" opacity="0.3" />
            <circle cx="350" cy="350" r="4" fill="#1a1510" opacity="0.3" />
            <rect x="100" y="610" width="140" height="8" rx="4" fill="#2a2520" opacity="0.4" />
            <rect x="960" y="610" width="140" height="8" rx="4" fill="#2a2520" opacity="0.4" />
            <rect x="40" y="0" width="120" height="200" rx="8" fill="#2a2520" opacity="0.3" />
            <rect x="1040" y="0" width="120" height="200" rx="8" fill="#2a2520" opacity="0.3" />
          </svg>
        </div>
        <div className="train-vignette" aria-hidden="true" />
      </div>

      <div className="train-caption" ref={captionRef}>
        <p>The world streaming by, faster than I can name it.</p>
      </div>
    </section>
  );
}
