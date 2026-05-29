'use client';

// Visitor Constellation — anonymous active-visitor dots on a canvas.
// Each dot = one page-view in the last 5 min. Older dots are dimmer.
// Dots drift slowly and fade out as they age. No PII exposed.

import { useEffect, useRef, useState, useCallback } from 'react';

type VisitorDot = {
  page: string;
  age_s: number;
};

type LiveDot = VisitorDot & {
  x: number; y: number;
  vx: number; vy: number;
  r: number;
};

const MAX_AGE = 300; // 5 minutes in seconds
const PAGE_COLORS: Record<string, string> = {
  '/':          '#C96442',
  '/en':        '#C96442',
  '/zh':        '#C96442',
  '/blog':      '#5E6B8C',
  '/work':      '#3E7C5F',
  '/now':       '#8A5A3B',
  '/guestbook': '#6B5E8C',
  '/about':     '#A04E30',
};
function dotColor(page: string) {
  for (const [prefix, c] of Object.entries(PAGE_COLORS)) {
    if (page.startsWith(prefix)) return c;
  }
  return '#8B816E';
}

export function VisitorConstellation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotsRef   = useRef<LiveDot[]>([]);
  const rafRef    = useRef<number>(0);
  const [count, setCount] = useState(0);
  const [tooltip, setTooltip] = useState<{ page: string; x: number; y: number } | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/visitors/active');
      if (!r.ok) return;
      const j: { data?: { visitors: VisitorDot[] } } = await r.json();
      const visitors = j.data?.visitors ?? [];
      setCount(visitors.length);

      const canvas = canvasRef.current;
      const W = canvas?.offsetWidth ?? 320;
      const H = canvas?.offsetHeight ?? 180;

      // Merge: keep existing positions for dots that match the same page+age bucket,
      // spawn new ones for fresh entries
      dotsRef.current = visitors.map((v, i) => {
        const existing = dotsRef.current[i];
        return existing ?? {
          ...v,
          x: 24 + Math.random() * (W - 48),
          y: 24 + Math.random() * (H - 48),
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          r: 5,
        };
      });
    } catch { /* best-effort */ }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;
    const ctx = ctx2d; // non-null binding so closures keep the narrowed type

    const resize = () => {
      canvas.width  = canvas.offsetWidth  * devicePixelRatio;
      canvas.height = canvas.offsetHeight * devicePixelRatio;
      ctx.scale(devicePixelRatio, devicePixelRatio);
    };
    resize();
    window.addEventListener('resize', resize);

    function frame() {
      const W = canvas!.offsetWidth;
      const H = canvas!.offsetHeight;
      ctx.clearRect(0, 0, W, H);

      for (const d of dotsRef.current) {
        // Drift
        d.x += d.vx; d.y += d.vy;
        if (d.x < d.r || d.x > W - d.r) d.vx *= -1;
        if (d.y < d.r || d.y > H - d.r) d.vy *= -1;

        const alpha = Math.max(0.1, 1 - d.age_s / MAX_AGE);
        const color = dotColor(d.page);

        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = color + Math.round(alpha * 255).toString(16).padStart(2, '0');
        ctx.fill();

        // Pulse ring for fresh visitors (< 30s)
        if (d.age_s < 30) {
          const pulse = ((Date.now() / 800) % 1);
          ctx.beginPath();
          ctx.arc(d.x, d.y, d.r + pulse * 8, 0, Math.PI * 2);
          ctx.strokeStyle = color + Math.round((1 - pulse) * 120).toString(16).padStart(2, '0');
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // Draw faint connecting lines between dots on the same page
      for (let i = 0; i < dotsRef.current.length; i++) {
        for (let j = i + 1; j < dotsRef.current.length; j++) {
          const a = dotsRef.current[i], b = dotsRef.current[j];
          if (a.page !== b.page) continue;
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 100) continue;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(180,162,133,${0.15 * (1 - dist / 100)})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }

      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const hit = dotsRef.current.find((d) => {
      const dx = d.x - mx, dy = d.y - my;
      return Math.sqrt(dx * dx + dy * dy) < d.r + 4;
    });
    setTooltip(hit ? { page: hit.page, x: e.clientX, y: e.clientY } : null);
  };

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: 'var(--ink-soft)',
        marginBottom: 8,
        display: 'flex',
        gap: 12,
        alignItems: 'center',
      }}>
        <span
          style={{
            display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
            background: 'var(--signal-green)', animation: 'now-pulse 2s ease-in-out infinite',
          }}
        />
        Visitors · {count} active
      </div>
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: 160,
          borderRadius: 4,
          border: '1px solid var(--rule)',
          background: 'var(--bg-elev)',
          cursor: tooltip ? 'default' : 'crosshair',
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      />
      {tooltip && (
        <div style={{
          position: 'fixed',
          left: tooltip.x + 12,
          top: tooltip.y - 8,
          zIndex: 9999,
          background: 'var(--bg-ink)',
          color: 'var(--bg-elev)',
          padding: '5px 10px',
          borderRadius: 4,
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          pointerEvents: 'none',
        }}>
          {tooltip.page}
        </div>
      )}
    </div>
  );
}
