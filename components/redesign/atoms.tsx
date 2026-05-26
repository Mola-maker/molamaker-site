'use client';

// Shared atoms: HoverText, AButton, Magnetic, useReveal — ported from
// animations.jsx and the Magnetic helper in app.jsx.

import * as React from 'react';

const { useRef, useEffect } = React;
type ReactNode = React.ReactNode;
type CSSProperties = React.CSSProperties;
type ButtonHTMLAttributes<T> = React.ButtonHTMLAttributes<T>;

export type AButtonKind = 'arrow' | 'push' | 'plain';

type AButtonProps = {
  kind?: AButtonKind;
  solid?: boolean;
  ghost?: boolean;
  children: ReactNode;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'>;

export function AButton({
  kind = 'arrow',
  solid,
  ghost,
  children,
  onClick,
  className = '',
  ...rest
}: AButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    el.addEventListener('pointermove', onMove);
    return () => el.removeEventListener('pointermove', onMove);
  }, []);

  const classes = [
    'btn',
    'btn--ripple',
    solid ? 'btn--solid' : '',
    ghost ? 'btn--ghost' : '',
    kind === 'arrow' ? 'btn--arrow' : '',
    kind === 'push' ? 'btn--push' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button ref={ref} className={classes} onClick={onClick} {...rest}>
      {kind === 'push' ? (
        <span className="label" style={{ position: 'relative' }}>
          <span>{children}</span>
          <span>{children}</span>
        </span>
      ) : kind === 'arrow' ? (
        <>
          <span>{children}</span>
          <span className="arrow"></span>
        </>
      ) : (
        <span>{children}</span>
      )}
    </button>
  );
}

type HoverMode = 'wave' | 'glitch' | 'italic' | 'heat';

type HoverTextProps = {
  text: string;
  mode?: HoverMode;
  className?: string;
  tag?: 'span' | 'em' | 'b' | 'i' | 'strong';
};

export function HoverText({ text, mode = 'wave', className = '', tag = 'span' }: HoverTextProps) {
  const cls = `t-hover-${mode} ${className}`;
  const chars = [...String(text)];
  const inner = chars.map((c, i) => (
    <span key={i} style={{ ['--i' as string]: i } as CSSProperties} aria-hidden={c === ' ' ? 'true' : undefined}>
      {c === ' ' ? ' ' : c}
    </span>
  ));
  const Tag = tag;
  return <Tag className={cls}>{inner}</Tag>;
}

type MagneticProps = {
  children: ReactNode;
  strength?: number;
  className?: string;
};

export function Magnetic({ children, strength = 0.25, className = '' }: MagneticProps) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = (e.clientX - cx) * strength;
      const dy = (e.clientY - cy) * strength;
      el.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    const onLeave = () => {
      el.style.transform = '';
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [strength]);
  return (
    <span ref={ref} className={`mag ${className}`} data-magnet>
      {children}
    </span>
  );
}

// IntersectionObserver-based reveal trigger. Adds `.is-in` to any `.reveal`
// element on the page when it scrolls into view. Re-runs whenever `dep`
// changes so newly mounted `.reveal` elements get observed.
export function useReveal(dep: unknown = null) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12 },
    );
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep]);
}
