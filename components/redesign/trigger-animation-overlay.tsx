'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { AnimationType } from '@/lib/chat/trigger-words';

const ANIM_DURATION_MS = 2500;

const EMOJI: Record<AnimationType, string> = {
  wave:       '🐱✋',
  laugh:      '😹',
  blush:      '😳',
  sparkle:    '✨',
  heart:      '💕',
  konnichiwa: '🐱🎌',
};

interface Props {
  animation: AnimationType | null;
  onDismiss: () => void;
}

export function TriggerAnimationOverlay({ animation, onDismiss }: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!animation) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(onDismiss, ANIM_DURATION_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [animation, onDismiss]);

  if (!animation || typeof document === 'undefined') return null;

  return createPortal(
    <div className={`ab-anim-overlay ab-anim--${animation}`} aria-hidden="true">
      <div className="ab-anim-overlay__bg" />
      <span className="ab-anim-overlay__char">{EMOJI[animation]}</span>
    </div>,
    document.body,
  );
}
