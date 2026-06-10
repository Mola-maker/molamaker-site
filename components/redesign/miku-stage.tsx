'use client';

// MikuStage — fullscreen cinematic scenes with the Live2D mascot as the star.
// When the LLM (or a typed command) calls for a spectacle, the page dims, the
// Live2D model glides to center stage, and a canvas particle engine runs the
// show: concert spotlights + penlights, night-sky fireworks, sakura storms,
// shooting stars, snowfall, confetti cannons. The director (lib/live2d) keeps
// the model moving — motions, expressions, lyric bubbles, and lip-sync while
// the bot is streaming a reply.
//
// Listens:
//   miku:perform {actions}  → scene actions open a scene; small gestures are
//                             echoed onto the Live2D model when it's on stage
//   miku:scene {scene}      → direct trigger
//   mola:chat-update        → lip-sync while the bot streams; reaction motions
// Exit: click anywhere, Esc, or the scene's own curtain call.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  extractMikuActions,
  isSceneAction,
  isSpriteAction,
  type SceneAction,
} from '@/lib/chat/miku-actions';
import {
  live2dVisible,
  playMotion,
  playExpression,
  mascotSay,
  startLipSync,
  stopLipSync,
  summonLive2d,
} from '@/lib/live2d/director';

// ── Particle engine ──────────────────────────────────────────────

interface P {
  kind: 'glow' | 'note' | 'petal' | 'rect' | 'spark' | 'rocket' | 'shoot' | 'flake';
  x: number; y: number;
  vx: number; vy: number;
  life: number; max: number;
  size: number;
  color: string;
  rot: number; vr: number;
  sway: number; phase: number;
  glyph?: string;
}

interface Twinkle { x: number; y: number; size: number; speed: number; phase: number }

const NOTES = ['♪', '♫', '♬', '♩'];
const FESTIVAL = ['#39c5bb', '#ff9fbe', '#ffd166', '#7ab8f5', '#c8f7c5', '#e6a8f0'];
const LYRICS = ['♪ み く み く ~', '♪ la la la~', '♪ 39!', '♪ sekai de ichiban~', '♪ ✦ ✦ ✦'];

const SCENE_DUR: Record<SceneAction, number> = {
  concert: 18000,
  fireworks: 13000,
  sakura: 11000,
  stars: 13000,
  snow: 11000,
  confetti: 7000,
};

function rnd(a: number, b: number) { return a + Math.random() * (b - a); }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

export function MikuStage() {
  const [scene, setScene] = useState<SceneAction | null>(null);
  const [closing, setClosing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SceneAction | null>(null);
  sceneRef.current = scene;

  // ── Global listeners: open scenes, echo gestures, chat lip-sync ──
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const open = (s: SceneAction) => {
      if (reduced) { mascotSay(`✧ ${s} ✧`, 2600, 9); return; }
      setClosing(false);
      setScene(s);
    };

    const onPerform = (e: Event) => {
      const actions = ((e as CustomEvent).detail?.actions ?? []) as string[];
      const sceneAction = actions.find(isSceneAction);
      if (sceneAction) { open(sceneAction); return; }
      // Small gestures: let the Live2D mascot act them out too, with real
      // motion + expression instead of just the sprite's pantomime.
      if (actions.some(isSpriteAction) && live2dVisible()) {
        playMotion('tap_body');
        if (actions.includes('hearts') || actions.includes('dance') || actions.includes('sing')) {
          playExpression();
        }
      }
    };
    const onScene = (e: Event) => {
      const s = (e as CustomEvent).detail?.scene as string | undefined;
      if (s && isSceneAction(s)) open(s);
    };

    // Lip-sync + reaction motions driven by the shared chat transcript.
    let settle: ReturnType<typeof setTimeout> | null = null;
    let lastLen = 0;
    let movedFor = -1;
    let scenedFor = -1;
    const onChat = () => {
      let msgs: Array<{ role: string; text: string }>;
      try { msgs = JSON.parse(sessionStorage.getItem('mola:chat-messages') ?? '[]'); } catch { return; }
      const lastMsg = msgs[msgs.length - 1];
      if (!lastMsg) return;
      if (lastMsg.role === 'user') {
        if (msgs.length !== movedFor) { movedFor = msgs.length; playExpression(); }
        return;
      }
      // Bot text is growing → she's speaking: flutter the mouth, and strike a
      // pose once per reply.
      if (lastMsg.text.length !== lastLen) {
        lastLen = lastMsg.text.length;
        if (live2dVisible()) {
          startLipSync();
          if (msgs.length !== movedFor) { movedFor = msgs.length; playMotion('tap_body'); }
        }
        if (settle) clearTimeout(settle);
        settle = setTimeout(() => {
          stopLipSync();
          // Fallback for chat surfaces that bypass the hook (terminal chat):
          // any [miku:…] scene tag left in the stored text still raises the
          // curtain, once per message.
          if (scenedFor !== msgs.length) {
            scenedFor = msgs.length;
            const tagged = extractMikuActions(lastMsg.text).actions.find(isSceneAction);
            if (tagged) open(tagged);
          }
        }, 900);
      }
    };

    window.addEventListener('miku:perform', onPerform);
    window.addEventListener('miku:scene', onScene);
    window.addEventListener('mola:chat-update', onChat);
    return () => {
      window.removeEventListener('miku:perform', onPerform);
      window.removeEventListener('miku:scene', onScene);
      window.removeEventListener('mola:chat-update', onChat);
      if (settle) clearTimeout(settle);
      stopLipSync();
    };
  }, []);

  // ── Scene runtime ────────────────────────────────────────────────
  useEffect(() => {
    if (!scene) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let alive = true;
    let raf = 0;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const intervals = new Set<ReturnType<typeof setInterval>>();
    const after = (ms: number, fn: () => void) => {
      const t = setTimeout(() => { timers.delete(t); if (alive) fn(); }, ms);
      timers.add(t);
    };
    const every = (ms: number, fn: () => void) => {
      const t = setInterval(() => { if (alive) fn(); }, ms);
      intervals.add(t);
    };

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const fit = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();
    window.addEventListener('resize', fit);

    const Wv = () => window.innerWidth;
    const Hv = () => window.innerHeight;

    const ps: P[] = [];
    const twinkles: Twinkle[] = [];
    const MAX_P = 460;
    const add = (p: P) => { if (ps.length < MAX_P) ps.push(p); };

    const explode = (x: number, y: number, color: string, count = 64) => {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = rnd(50, 280);
        add({
          kind: 'spark', x, y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 0, max: rnd(0.7, 1.5), size: rnd(1.2, 2.6),
          color: Math.random() < 0.8 ? color : '#fff',
          rot: 0, vr: 0, sway: 0, phase: 0,
        });
      }
    };
    const confettiBurst = (x: number, y: number, dir: number, count = 42) => {
      for (let i = 0; i < count; i++) {
        const a = -Math.PI / 2 + dir * rnd(0.05, 0.6);
        const sp = rnd(260, 620);
        add({
          kind: 'rect', x, y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 0, max: rnd(1.6, 2.8), size: rnd(3, 6),
          color: pick(FESTIVAL),
          rot: rnd(0, Math.PI), vr: rnd(-9, 9), sway: 0, phase: 0,
        });
      }
    };

    // Scene setup -----------------------------------------------------
    document.body.classList.add('mstage-on', `mstage-${scene}`);

    if (scene === 'stars') {
      for (let i = 0; i < 150; i++) {
        twinkles.push({ x: Math.random() * Wv(), y: Math.random() * Hv() * 0.8, size: rnd(0.5, 1.8), speed: rnd(0.6, 2.4), phase: rnd(0, 7) });
      }
    }
    if (scene === 'confetti') {
      const fire = () => {
        confettiBurst(20, Hv() - 10, 1);
        confettiBurst(Wv() - 20, Hv() - 10, -1);
      };
      fire();
      after(400, fire);
      after(1000, fire);
      after(1800, fire);
    }

    // Live2D choreography ----------------------------------------------
    let summoned = false;
    summonLive2d(scene === 'concert' ? 8000 : 3500).then((ok) => {
      if (!alive) return;
      summoned = ok;
      if (ok) {
        // Only the concert pulls her to center stage; weather scenes let her
        // watch from her corner.
        if (scene === 'concert') document.body.classList.add('mstage-live');
        playMotion('tap_body');
        playExpression();
      } else if (scene === 'concert') {
        // No Live2D (CDN hiccup)? The chibi fairy headlines instead.
        try { window.dispatchEvent(new CustomEvent('miku:perform', { detail: { actions: ['dance'] } })); } catch { /* ignore */ }
      }
    });
    if (scene === 'concert') {
      every(1700, () => { if (summoned) playMotion('tap_body'); });
      every(4100, () => { if (summoned) playExpression(); });
      every(3400, () => { if (summoned) mascotSay(pick(LYRICS), 2800, 11); });
    } else {
      every(3600, () => { if (summoned && Math.random() < 0.6) playMotion('idle'); });
    }

    // Spawners ----------------------------------------------------------
    let acc = 0;
    let rocketAcc = 0;
    let shootAcc = 0;
    const spawn = (dt: number, t: number) => {
      acc += dt;
      switch (scene) {
        case 'concert': {
          while (acc > 0.045) {
            acc -= 0.045;
            add({
              kind: 'glow', x: Math.random() * Wv(), y: Hv() + 8,
              vx: rnd(-8, 8), vy: rnd(-130, -45),
              life: 0, max: rnd(2.2, 4), size: rnd(2, 5),
              color: pick(['#39c5bb', '#ff9fbe', '#9be8ff', '#fff7c2']),
              rot: 0, vr: 0, sway: rnd(6, 22), phase: rnd(0, 7),
            });
          }
          if (Math.random() < dt * 0.7) {
            add({
              kind: 'note', x: Math.random() * Wv(), y: Hv() * rnd(0.45, 0.95),
              vx: rnd(-12, 12), vy: rnd(-70, -36),
              life: 0, max: rnd(2, 3.4), size: rnd(13, 22),
              color: pick(['#39c5bb', '#ff9fbe', '#ffffff']),
              rot: rnd(-0.4, 0.4), vr: rnd(-1, 1), sway: rnd(8, 20), phase: rnd(0, 7),
              glyph: pick(NOTES),
            });
          }
          if (Math.random() < dt * 0.45) {
            explode(rnd(0.15, 0.85) * Wv(), rnd(0.08, 0.4) * Hv(), pick(FESTIVAL), 30);
          }
          // Curtain-call confetti in the last stretch.
          if (t > SCENE_DUR.concert / 1000 - 3.2 && Math.random() < dt * 2) {
            confettiBurst(rnd(0.2, 0.8) * Wv(), Hv() - 10, Math.random() < 0.5 ? 1 : -1, 24);
          }
          break;
        }
        case 'fireworks': {
          rocketAcc += dt;
          if (rocketAcc > rnd(0.55, 0.95)) {
            rocketAcc = 0;
            add({
              kind: 'rocket', x: rnd(0.12, 0.88) * Wv(), y: Hv() + 6,
              vx: rnd(-26, 26), vy: -rnd(0.62, 0.92) * Hv(),
              life: 0, max: rnd(0.85, 1.15), size: 2.4,
              color: pick(FESTIVAL), rot: 0, vr: 0, sway: 0, phase: 0,
            });
          }
          break;
        }
        case 'sakura': {
          while (acc > 0.06) {
            acc -= 0.06;
            add({
              kind: 'petal', x: rnd(-0.1, 1.05) * Wv(), y: -14,
              vx: rnd(18, 70), vy: rnd(34, 88),
              life: 0, max: 20, size: rnd(4, 8),
              color: pick(['#ffd7e2', '#ffb7cd', '#ff9fbe', '#ffe8ef']),
              rot: rnd(0, Math.PI), vr: rnd(-2.4, 2.4), sway: rnd(16, 44), phase: rnd(0, 7),
            });
          }
          break;
        }
        case 'stars': {
          shootAcc += dt;
          if (shootAcc > rnd(1.1, 1.8)) {
            shootAcc = 0;
            add({
              kind: 'shoot', x: rnd(0.1, 0.9) * Wv(), y: rnd(0, 0.25) * Hv(),
              vx: rnd(340, 620) * (Math.random() < 0.5 ? 1 : -1), vy: rnd(120, 260),
              life: 0, max: rnd(0.7, 1.1), size: 1.6,
              color: '#fff', rot: 0, vr: 0, sway: 0, phase: 0,
            });
          }
          break;
        }
        case 'snow': {
          while (acc > 0.05) {
            acc -= 0.05;
            add({
              kind: 'flake', x: rnd(-0.05, 1.05) * Wv(), y: -8,
              vx: rnd(-14, 14), vy: rnd(32, 92),
              life: 0, max: 20, size: rnd(1, 4),
              color: '#fff', rot: 0, vr: 0, sway: rnd(10, 34), phase: rnd(0, 7),
            });
          }
          break;
        }
        case 'confetti':
          break;
      }
    };

    // Render loop --------------------------------------------------------
    const t0 = performance.now();
    let lastNow = t0;
    const frame = (now: number) => {
      if (!alive) return;
      const dt = Math.min(0.05, (now - lastNow) / 1000);
      lastNow = now;
      const t = (now - t0) / 1000;

      ctx.clearRect(0, 0, Wv(), Hv());

      // Twinkling backdrop stars
      if (twinkles.length) {
        for (const s of twinkles) {
          const a = 0.25 + 0.75 * Math.abs(Math.sin(t * s.speed + s.phase));
          ctx.globalAlpha = a;
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      spawn(dt, t);

      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.life += dt;
        if (p.life > p.max) {
          if (p.kind === 'rocket') explode(p.x, p.y, p.color, 72);
          ps.splice(i, 1);
          continue;
        }
        // Physics per kind
        if (p.kind === 'spark') { p.vy += 110 * dt; p.vx *= 1 - 0.9 * dt; }
        if (p.kind === 'rect') { p.vy += 460 * dt; p.vx *= 1 - 1.1 * dt; }
        if (p.kind === 'rocket') { p.vy += 220 * dt; }
        p.x += p.vx * dt + (p.sway ? Math.sin(t * 2.2 + p.phase) * p.sway * dt : 0);
        p.y += p.vy * dt;
        p.rot += p.vr * dt;

        const fade = 1 - p.life / p.max;
        const offscreen = p.y > Hv() + 24 || p.x < -40 || p.x > Wv() + 40;
        if (offscreen) { ps.splice(i, 1); continue; }

        switch (p.kind) {
          case 'glow':
          case 'spark': {
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = Math.max(0, Math.min(1, fade * 1.2));
            const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
            g.addColorStop(0, p.color);
            g.addColorStop(1, 'transparent');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1;
            break;
          }
          case 'rocket': {
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.9;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - p.vx * 0.045, p.y - p.vy * 0.045);
            ctx.stroke();
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1;
            break;
          }
          case 'shoot': {
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1.6;
            ctx.globalAlpha = fade;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - p.vx * 0.13, p.y - p.vy * 0.13);
            ctx.stroke();
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1;
            break;
          }
          case 'note': {
            ctx.globalAlpha = Math.min(1, fade * 1.4);
            ctx.fillStyle = p.color;
            ctx.font = `${p.size}px serif`;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.fillText(p.glyph ?? '♪', 0, 0);
            ctx.restore();
            ctx.globalAlpha = 1;
            break;
          }
          case 'petal': {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot + Math.sin(t * 2 + p.phase) * 0.5);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = 0.92;
            ctx.beginPath();
            ctx.ellipse(0, 0, p.size, p.size * 0.62, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            ctx.globalAlpha = 1;
            break;
          }
          case 'rect': {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = Math.min(1, fade * 1.6);
            ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
            ctx.restore();
            ctx.globalAlpha = 1;
            break;
          }
          case 'flake': {
            ctx.globalAlpha = 0.85;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
            break;
          }
        }
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    // Exit paths ----------------------------------------------------------
    const close = () => {
      if (!alive) return;
      alive = false;
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      intervals.forEach(clearInterval);
      window.removeEventListener('resize', fit);
      window.removeEventListener('keydown', onKey);
      // Drop the stage but keep `mstage-on` (the transition rule) a beat
      // longer so the model glides back to its corner instead of snapping.
      document.body.classList.remove('mstage-live', `mstage-${scene}`);
      setTimeout(() => document.body.classList.remove('mstage-on'), 1200);
      setClosing(true);
      setTimeout(() => { setScene(null); setClosing(false); }, 500);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    after(SCENE_DUR[scene], close);

    // The overlay click handler needs the same close — stash it on the canvas
    // element so the JSX handler can reach the current scene's closure.
    (canvas as HTMLCanvasElement & { __close?: () => void }).__close = close;

    return () => {
      if (alive) {
        alive = false;
        cancelAnimationFrame(raf);
        timers.forEach(clearTimeout);
        intervals.forEach(clearInterval);
        window.removeEventListener('resize', fit);
        window.removeEventListener('keydown', onKey);
        document.body.classList.remove('mstage-live', `mstage-${scene}`);
        setTimeout(() => document.body.classList.remove('mstage-on'), 1200);
      }
    };
  }, [scene]);

  if (!scene) return null;

  return createPortal(
    <div
      className={`mstage mstage--${scene}${closing ? ' is-closing' : ''}`}
      onClick={() => (canvasRef.current as (HTMLCanvasElement & { __close?: () => void }) | null)?.__close?.()}
      role="presentation"
    >
      {scene === 'concert' && (
        <div className="mstage__rig" aria-hidden="true">
          <span className="mstage__beam mstage__beam--1" />
          <span className="mstage__beam mstage__beam--2" />
          <span className="mstage__beam mstage__beam--3" />
          <span className="mstage__beam mstage__beam--4" />
          <span className="mstage__floor" />
          <span className="mstage__rings" />
        </div>
      )}
      {scene === 'stars' && <div className="mstage__moon" aria-hidden="true" />}
      <canvas ref={canvasRef} className="mstage__canvas" />
      <span className="mstage__hint">esc / click to exit ✦</span>
    </div>,
    document.body,
  );
}
