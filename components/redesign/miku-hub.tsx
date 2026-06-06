'use client';

// Unified bottom-right control hub. One Miku button — on hover/focus it springs
// out three satellites (tweak · music · 看板娘) with a damped, overshooting
// motion. The main button toggles the chat. Each control is dispatched as a
// window CustomEvent so the existing panels (MusicPlayer, TweaksPanel,
// Live2DChat) stay where they are and just listen.
//
// Events fired:
//   mola:chat-toggle     → Live2DChat opens/closes the persona chat
//   mola:music-toggle    → MusicPlayer opens/closes
//   tweaks:toggle        → TweaksPanel opens/closes
//   mola:live2d-toggle   → Live2DChat shows/hides the 看板娘 mascot

import { useCallback, useEffect, useRef, useState } from 'react';
import { assetUrl } from '@/lib/asset-url';

function fire(name: string) {
  try { window.dispatchEvent(new CustomEvent(name)); } catch { /* ignore */ }
}

type Satellite = {
  id: string;
  label: string;
  glyph: string;
  onActivate: () => void;
};

const SATELLITES: Satellite[] = [
  { id: 'music', label: 'Music', glyph: '♪', onActivate: () => fire('mola:music-toggle') },
  { id: 'tweak', label: 'Tweaks', glyph: '✦', onActivate: () => fire('tweaks:toggle') },
  { id: 'live2d', label: '看板娘', glyph: '❤', onActivate: () => fire('mola:live2d-toggle') },
];

export function MikuHub() {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  }, []);
  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 420);
  }, [cancelClose]);

  useEffect(() => () => cancelClose(), [cancelClose]);

  return (
    <div
      className={`miku-hub${open ? ' is-open' : ''}`}
      onMouseEnter={() => { cancelClose(); setOpen(true); }}
      onMouseLeave={scheduleClose}
      onFocusCapture={() => { cancelClose(); setOpen(true); }}
      onBlurCapture={scheduleClose}
    >
      <ul className="miku-hub__sats" role="menu" aria-label="Quick controls">
        {SATELLITES.map((s) => (
          <li key={s.id} className={`miku-hub__sat miku-hub__sat--${s.id}`}>
            <button
              type="button"
              className="miku-hub__sat-btn"
              tabIndex={open ? 0 : -1}
              aria-label={s.label}
              title={s.label}
              onClick={() => s.onActivate()}
            >
              <span className="miku-hub__sat-glyph" aria-hidden="true">{s.glyph}</span>
              <span className="miku-hub__sat-label">{s.label}</span>
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="miku-hub__main"
        aria-label="Open chat — hover for controls"
        aria-expanded={open}
        onClick={() => fire('mola:chat-toggle')}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={assetUrl('/redesign/miku-dance.gif')} alt="Miku" className="miku-hub__gif" />
        <span className="miku-hub__ring" aria-hidden="true" />
      </button>
    </div>
  );
}
