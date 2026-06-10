'use client';

// §05 of the magazine: Miku's gallery. Her finished paintings (archived to
// localStorage by the fairy's atelier, lib/miku/paintings) hang in little
// frames next to a wall of "live GIF" emoji — pure-CSS looping animations,
// no assets. Two commission buttons summon her: one to paint on the spot,
// one to start the hide-and-seek game whose prize is a painting.

import { useCallback, useEffect, useState } from 'react';
import type { Locale } from './data';
import {
  PAINT_MOTIFS,
  loadGallery,
  removeGalleryItem,
  motifById,
  type GalleryItem,
} from '@/lib/miku/paintings';

function fire(name: string, detail?: Record<string, unknown>) {
  try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch { /* ignore */ }
}

/** Render a motif's strokes as a crisp inline SVG. */
function MotifSvg({ motifId }: { motifId: string }) {
  const motif = motifById(motifId);
  if (!motif) return null;
  return (
    <svg className="mgal-card__art" viewBox="0 0 100 100" aria-hidden="true">
      {motif.strokes.map((s, i) => (
        <polyline
          key={i}
          fill="none"
          stroke={s.color}
          strokeWidth={s.width ?? 3}
          strokeLinecap="round"
          strokeLinejoin="round"
          points={s.pts.map(([x, y]) => `${x},${y}`).join(' ')}
        />
      ))}
    </svg>
  );
}

// The "live GIF" wall — big emoji with looping CSS animations.
const LIVE_EMOJI: Array<{ glyph: string; anim: string; en: string; zh: string }> = [
  { glyph: '😂', anim: 'bounce', en: 'lol forever', zh: '笑不活了' },
  { glyph: '🎤', anim: 'pulse', en: 'mic check', zh: '试音中' },
  { glyph: '🐱', anim: 'wiggle', en: 'studio cat', zh: '工作室的猫' },
  { glyph: '✨', anim: 'twinkle', en: 'sparkle', zh: '闪闪' },
  { glyph: '🍙', anim: 'float', en: 'snack break', zh: '饭团时间' },
  { glyph: '💢', anim: 'shake', en: 'grr', zh: '生气气' },
  { glyph: '🫠', anim: 'melt', en: 'melting…', zh: '融化了' },
  { glyph: '👾', anim: 'hop', en: 'pixel friend', zh: '像素朋友' },
];

export function MagGallery({ locale }: { locale: Locale }) {
  const zh = locale === 'zh';
  const [items, setItems] = useState<GalleryItem[]>([]);

  const refresh = useCallback(() => setItems(loadGallery()), []);

  useEffect(() => {
    refresh();
    window.addEventListener('miku:gallery-update', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('miku:gallery-update', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [refresh]);

  const fmtDate = (ts: number) =>
    new Date(ts).toLocaleDateString(zh ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' });

  return (
    <div className="wrap reveal" id="sec-5">
      <section className="gallery">
        <div className="sec-rule">
          <span>§ {zh ? 'Miku 美术馆' : "Miku's gallery"}</span>
          <span className="sec-rule__rule"></span>
          <span>
            {items.length} {zh ? '幅作品' : items.length === 1 ? 'piece' : 'pieces'}
          </span>
        </div>

        <div className="mgal-head">
          <p className="mgal-blurb">
            {zh
              ? '驻站画家初音会在闲暇时作画;赢下一局捉迷藏,她也会画一幅送你。'
              : 'The resident artist paints when the muse strikes — or as a prize, if you can beat her at hide-and-seek.'}
          </p>
          <div className="mgal-actions">
            <button type="button" className="mgal-btn" onClick={() => fire('miku:paint')}>
              🎨 {zh ? '请她画一幅' : 'Commission a painting'}
            </button>
            <button type="button" className="mgal-btn" onClick={() => fire('miku:game')}>
              🙈 {zh ? '玩捉迷藏' : 'Play hide & seek'}
            </button>
          </div>
        </div>

        <div className="mgal-grid">
          {items.length === 0 && (
            <div className="mgal-empty">
              <MotifSvg motifId={PAINT_MOTIFS[0].id} />
              <p>
                {zh
                  ? '画架还空着 —— 点上面的按钮,或在聊天里说「画一幅画」。'
                  : 'The easel is empty — press a button above, or ask her to paint in chat.'}
              </p>
            </div>
          )}

          {items.map((item, i) => {
            const motif = motifById(item.motif);
            return (
              <figure key={item.id} className="mgal-card" style={{ '--tilt': `${(i % 3) - 1}deg` } as React.CSSProperties}>
                <MotifSvg motifId={item.motif} />
                <figcaption>
                  <span className="mgal-card__title">{motif ? (zh ? motif.title.zh : motif.title.en) : item.motif}</span>
                  <span className="mgal-card__date">{fmtDate(item.ts)} · miku</span>
                </figcaption>
                <button
                  type="button"
                  className="mgal-card__x"
                  aria-label={zh ? '取下这幅画' : 'Take this piece down'}
                  title={zh ? '取下' : 'Take down'}
                  onClick={() => removeGalleryItem(item.id)}
                >×</button>
              </figure>
            );
          })}

          {LIVE_EMOJI.map((e, i) => (
            <figure key={e.glyph} className={`mgal-card mgal-card--emoji`} style={{ '--tilt': `${((i + 1) % 3) - 1}deg` } as React.CSSProperties}>
              <span className={`mgal-emoji mgal-emoji--${e.anim}`} aria-hidden="true">{e.glyph}</span>
              <figcaption>
                <span className="mgal-card__title">{zh ? e.zh : e.en}</span>
                <span className="mgal-card__date">live · ∞ loop</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    </div>
  );
}
