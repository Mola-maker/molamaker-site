'use client';

// MikuFairy — a tiny autonomous chibi Miku who lives on top of the page like a
// fairytale sprite. She walks along the bottom bars (marquee / footer / variant
// rail), plays hide-and-seek behind headlines (dropping behind the text layer
// and peeking over the glyphs, chibi-style), swims across blank zones trailing
// bubbles, and perches on the chat panel to react in real time while you talk.
//
// Listens:
//   mola:chat-toggle + DOM .ab-panel → perch on the chat panel
//   mola:chat-update                 → instant reactions to visitor + bot text
//   miku:perform {actions}           → stage directions from bot replies
//   miku:shuffle                     → random performance (Tweaks button)
//
// All motion runs in one rAF loop writing transforms straight to the DOM —
// React renders the rig once and never re-renders per frame.

import { useEffect, useRef } from 'react';
import {
  actionsFromUserText,
  isSpriteAction,
  extractMikuActions,
  type SpriteAction,
} from '@/lib/chat/miku-actions';

const W = 64;
const H = 74;

type Mode =
  | 'idle' | 'walk' | 'fly' | 'swim' | 'peek' | 'sit' | 'talk'
  | 'dance' | 'spin' | 'jump' | 'wave' | 'happy' | 'sleep' | 'startle';

type PlanKind = 'wander' | 'bar' | 'hide' | 'swim' | 'chat' | 'nap' | 'perform';

interface Plan {
  kind: PlanKind;
  step: number;
  until: number;
  target: { x: number; y: number } | null;
  /** Anchor element for bar-walks / hide spots — rect re-read every frame so
   *  scrolling never strands her in mid-air. */
  el?: Element | null;
  /** Horizontal position inside the anchor rect, as a 0–1 fraction. */
  frac?: number;
  targets?: { x: number; y: number }[];
  queue?: SpriteAction[];
  started?: boolean;
  cycles?: number;
  up?: boolean;
}

const PHRASES = {
  hello: ['Miku is here~ ✿', '初音ミク、参上！', '今天也要元气满满哦~'],
  found: ['きゃっ! You found me!', '被发现啦~!', 'にゃ~ caught!'],
  hiding: ['shhh…', '嘘——', '…'],
  emerge: ['ふふ~ ✧', '躲好了又出来啦', 'peek-a-boo!'],
  chat: ["I'm listening~ ♪", '在听在听！', 'うんうん~', '✧ ooh?'],
  done: ['Ta-dah! ✧', '怎么样~?', 'えへへ♪'],
  sleepy: ['zzz…', '梦里也有歌声~'],
  swim: ['~( ˘▽˘)~', '游泳时间！'],
  poke: ['にゃ?', 'That tickles~', '干嘛呀~ ♪', '♪~'],
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const NOTES = ['♪', '♫', '♬', '♩'];

export function MikuFairy({ enabled = true }: { enabled?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const rigRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const fxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;
    const root = rootRef.current;
    const rig = rigRef.current;
    const bubble = bubbleRef.current;
    const fxHost = fxRef.current;
    if (!root || !rig || !bubble || !fxHost) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ── Mutable sprite state (never touches React) ─────────────────
    const S = {
      x: 90,
      y: window.innerHeight - H - 90,
      t: 0,
      facing: 1 as 1 | -1,
      mode: 'idle' as Mode,
      behind: false,
      talking: false,
      fxClock: 0,
    };
    const mouse = { x: -9999, y: -9999 };
    let plan: Plan = { kind: 'wander', step: 0, until: performance.now() + 1400, target: null };
    let raf = 0;
    let alive = true;
    const timers = new Set<ReturnType<typeof setTimeout>>();

    const after = (ms: number, fn: () => void) => {
      const t = setTimeout(() => { timers.delete(t); if (alive) fn(); }, ms);
      timers.add(t);
    };

    // ── DOM writers ────────────────────────────────────────────────
    const setMode = (m: Mode) => {
      if (S.mode === m) return;
      S.mode = m;
      root.dataset.mode = m;
    };
    const face = (f: 1 | -1) => {
      if (S.facing === f) return;
      S.facing = f;
      root.style.setProperty('--mf-face', String(f));
    };
    const setBehind = (b: boolean) => {
      if (S.behind === b) return;
      S.behind = b;
      root.classList.toggle('is-behind', b);
    };
    let bubbleTimer: ReturnType<typeof setTimeout> | null = null;
    const say = (lines: string[], ms = 2600) => {
      bubble.textContent = pick(lines);
      bubble.classList.add('is-on');
      if (bubbleTimer) clearTimeout(bubbleTimer);
      bubbleTimer = setTimeout(() => bubble.classList.remove('is-on'), ms);
    };

    const cx = () => S.x + W / 2;
    const cy = () => S.y + H / 3;

    // ── Particle effects ───────────────────────────────────────────
    const fx = (cls: string, x: number, y: number, txt = '', vars?: Record<string, string>) => {
      const el = document.createElement('span');
      el.className = `mfx ${cls}`;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      if (txt) el.textContent = txt;
      if (vars) for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
      el.addEventListener('animationend', () => el.remove());
      fxHost.appendChild(el);
      after(6000, () => el.remove());
    };
    const notesAround = (n = 3) => {
      for (let i = 0; i < n; i++) {
        fx('mfx--note', cx() + (Math.random() - 0.5) * 50, cy() - 10 - Math.random() * 18, pick(NOTES));
      }
    };
    const hearts = (n = 5) => {
      for (let i = 0; i < n; i++) {
        fx('mfx--heart', cx() + (Math.random() - 0.5) * 60, cy() - Math.random() * 26, '❤');
      }
    };
    const sparkles = (x: number, y: number, n = 6) => {
      for (let i = 0; i < n; i++) {
        fx('mfx--spark', x + (Math.random() - 0.5) * 54, y + (Math.random() - 0.5) * 44, '✦');
      }
    };
    const noteRain = () => {
      for (let i = 0; i < 16; i++) {
        fx('mfx--rain', Math.random() * window.innerWidth, -24, pick(NOTES), {
          '--d': `${2.2 + Math.random() * 2}s`,
          '--sway': `${(Math.random() - 0.5) * 120}px`,
        });
      }
    };

    // ── Movement ───────────────────────────────────────────────────
    const move = (tx: number, ty: number, speed: number, dt: number) => {
      const dx = tx - S.x;
      const dy = ty - S.y;
      const d = Math.hypot(dx, dy);
      if (d < 3) { S.x = tx; S.y = ty; return true; }
      const step = Math.min(d, speed * dt);
      S.x += (dx / d) * step;
      S.y += (dy / d) * step;
      if (Math.abs(dx) > 4) face(dx > 0 ? 1 : -1);
      return false;
    };
    const clamp = () => {
      S.x = Math.max(2, Math.min(S.x, window.innerWidth - W - 2));
      S.y = Math.max(2, Math.min(S.y, window.innerHeight - H + 18));
    };

    // ── Scene scanning ─────────────────────────────────────────────
    const inView = (r: DOMRect) =>
      r.width > 0 && r.bottom > 0 && r.top < window.innerHeight;

    /** Bars she can walk on: marquee, footer, variant rail — plus the viewport
     *  floor as a fallback "bottom bar". Returns the element so the rect can
     *  track scrolling, or null for the virtual floor. */
    const findBar = (): { el: Element | null } | null => {
      const bars: Element[] = [];
      for (const sel of ['.marquee', '.foot', '.variant-rail']) {
        document.querySelectorAll(sel).forEach((el) => {
          const r = el.getBoundingClientRect();
          if (inView(r) && r.top > 110 && r.top < window.innerHeight - 16 && r.width > 140) bars.push(el);
        });
      }
      if (bars.length && Math.random() < 0.8) return { el: pick(bars) };
      return { el: null }; // virtual floor along the viewport bottom
    };
    const barSurface = (el: Element | null) => {
      if (!el) {
        return { left: 12, right: window.innerWidth - 110, top: window.innerHeight - 4 };
      }
      const r = el.getBoundingClientRect();
      if (!inView(r) || r.top < 90 || r.top > window.innerHeight - 8) return null;
      return { left: Math.max(8, r.left + 6), right: Math.min(window.innerWidth - W - 8, r.right - W - 6), top: r.top };
    };

    /** Headlines & paragraphs she can duck behind for hide-and-seek. */
    const findHideSpot = (): Element | null => {
      const els = document.querySelectorAll(
        '.variant-stage h1, .variant-stage h2, .variant-stage h3, .variant-stage blockquote, .variant-stage p',
      );
      const ok: Element[] = [];
      els.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (
          r.top > 120 && r.bottom < window.innerHeight - 50 &&
          r.width > 70 && r.width < 980 && r.height > 18 && r.height < 260 &&
          (el.textContent ?? '').trim().length > 2
        ) ok.push(el);
      });
      return ok.length ? pick(ok) : null;
    };

    /** Blank zones: sample random viewport points and keep the ones whose hit
     *  element is a quiet container with no text of its own. */
    const findBlankPoints = (n: number) => {
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i < 40 && pts.length < n; i++) {
        const px = (0.1 + 0.8 * Math.random()) * window.innerWidth;
        const py = (0.16 + 0.58 * Math.random()) * window.innerHeight;
        const el = document.elementFromPoint(px, py);
        if (!el) continue;
        if (el.closest('.mfairy, .mfairy-fx, .ab-panel, .miku-hub, .top-nav, .variant-rail, button, a, input, textarea, img, canvas')) continue;
        if (!/^(DIV|SECTION|MAIN|BODY|HTML|ARTICLE|ASIDE|FIGURE|UL|HEADER|FOOTER)$/.test(el.tagName)) continue;
        const hasText = Array.from(el.childNodes).some(
          (nd) => nd.nodeType === Node.TEXT_NODE && (nd.textContent ?? '').trim(),
        );
        if (!hasText) pts.push({ x: px - W / 2, y: py - H / 2 });
      }
      while (pts.length < n) {
        pts.push({
          x: (0.2 + 0.6 * Math.random()) * window.innerWidth,
          y: (0.25 + 0.4 * Math.random()) * window.innerHeight,
        });
      }
      return pts;
    };

    const chatPanel = () => document.querySelector('.ab-panel');

    // ── Plan constructors ──────────────────────────────────────────
    const startWander = () => {
      plan = {
        kind: 'wander', step: 0, until: 0,
        target: {
          x: (0.12 + 0.7 * Math.random()) * window.innerWidth,
          y: (0.25 + 0.5 * Math.random()) * window.innerHeight,
        },
      };
    };
    const startBar = () => {
      const bar = findBar();
      if (!bar) return startWander();
      plan = { kind: 'bar', step: 0, until: 0, target: null, el: bar.el, frac: Math.random() };
    };
    const startHide = () => {
      const el = findHideSpot();
      if (!el) return startWander();
      plan = { kind: 'hide', step: 0, until: 0, target: null, el, frac: 0.1 + 0.8 * Math.random(), cycles: 2, up: false };
    };
    const startSwim = () => {
      plan = { kind: 'swim', step: 0, until: 0, target: null, targets: findBlankPoints(3) };
      say(PHRASES.swim, 1800);
    };
    const startNap = () => {
      plan = {
        kind: 'nap', step: 0, until: 0,
        target: { x: window.innerWidth - 150, y: window.innerHeight - H - 8 },
      };
    };
    const startChat = () => {
      plan = { kind: 'chat', step: 0, until: 0, target: null };
    };
    const startPerform = (actions: string[]) => {
      const queue = actions.filter(isSpriteAction) as SpriteAction[];
      if (!queue.length) return;
      setBehind(false);
      plan = { kind: 'perform', step: 0, until: 0, target: null, queue, started: false };
    };

    const nextPlan = () => {
      if (chatPanel()) return startChat();
      const roll = Math.random();
      if (roll < 0.24) startHide();
      else if (roll < 0.46) startSwim();
      else if (roll < 0.74) startBar();
      else if (roll < 0.92) startWander();
      else startNap();
    };

    // ── Per-plan ticks ─────────────────────────────────────────────
    const tickWander = (now: number, dt: number) => {
      if (plan.step === 0) {
        setMode('fly');
        if (plan.target && move(plan.target.x, plan.target.y, 190, dt)) {
          setMode('idle');
          plan.step = 1;
          plan.until = now + 1800 + Math.random() * 2400;
        }
      } else if (now > plan.until) nextPlan();
    };

    const tickBar = (now: number, dt: number) => {
      const surf = barSurface(plan.el ?? null);
      if (!surf || surf.right <= surf.left) return nextPlan();
      const y = surf.top - H + 2;
      if (plan.step === 0) {
        // Glide to one end of the bar…
        const x0 = S.x < (surf.left + surf.right) / 2 ? surf.left : surf.right;
        setMode('fly');
        if (move(x0, y, 230, dt)) {
          plan.step = 1;
          plan.target = { x: x0 < (surf.left + surf.right) / 2 ? surf.right : surf.left, y };
        }
      } else if (plan.step === 1 && plan.target) {
        // …then stroll across it.
        setMode('walk');
        const txClamped = Math.max(surf.left, Math.min(plan.target.x, surf.right));
        if (move(txClamped, y, 52, dt)) {
          setMode('idle');
          plan.step = 2;
          plan.until = now + 1500 + Math.random() * 1500;
        }
      } else if (now > plan.until) nextPlan();
    };

    const tickHide = (now: number, dt: number) => {
      const el = plan.el;
      if (!el) return nextPlan();
      const r = el.getBoundingClientRect();
      if (!inView(r) || r.top < 90) { setBehind(false); return nextPlan(); }
      const hx = r.left + (plan.frac ?? 0.5) * Math.max(1, r.width - W);
      const duckY = r.bottom - H + 8;
      if (plan.step === 0) {
        setMode('fly');
        if (move(hx, duckY, 240, dt)) {
          setBehind(true);
          setMode('peek');
          say(PHRASES.hiding, 1200);
          plan.step = 1;
          plan.up = false;
          plan.until = now + 800;
        }
      } else if (plan.step === 1) {
        // Bob: rise so the eyes clear the top of the text, then duck again.
        const peekY = Math.max(r.top - 20, duckY - 22);
        move(hx, plan.up ? peekY : duckY, 60, dt);
        if (now > plan.until) {
          if (plan.up) plan.cycles = (plan.cycles ?? 1) - 1;
          plan.up = !plan.up;
          plan.until = now + 1100;
          if ((plan.cycles ?? 0) <= 0 && !plan.up) {
            setBehind(false);
            setMode('happy');
            sparkles(cx(), cy());
            say(PHRASES.emerge, 1800);
            plan.step = 2;
            plan.until = now + 1300;
          }
        }
        // Caught! The visitor's cursor crept too close.
        if (S.behind && Math.hypot(mouse.x - cx(), mouse.y - cy()) < 85) {
          setBehind(false);
          setMode('startle');
          say(PHRASES.found, 2200);
          hearts(4);
          plan = {
            kind: 'wander', step: 0, until: 0,
            target: {
              x: mouse.x < window.innerWidth / 2 ? window.innerWidth * 0.78 : window.innerWidth * 0.12,
              y: window.innerHeight * (0.3 + Math.random() * 0.3),
            },
          };
        }
      } else if (now > plan.until) nextPlan();
    };

    const tickSwim = (now: number, dt: number) => {
      const targets = plan.targets ?? [];
      if (!targets.length) {
        setMode('happy');
        plan = { kind: 'wander', step: 1, until: now + 900, target: null };
        return;
      }
      setMode('swim');
      S.fxClock += dt;
      if (S.fxClock > 0.45) {
        S.fxClock = 0;
        fx('mfx--bubble', cx() - S.facing * 20, cy() + 6, '○');
      }
      if (move(targets[0].x, targets[0].y, 62, dt)) targets.shift();
    };

    const tickNap = (now: number, dt: number) => {
      if (plan.step === 0) {
        setMode('fly');
        if (plan.target && move(plan.target.x, plan.target.y, 200, dt)) {
          setMode('sleep');
          say(PHRASES.sleepy, 2000);
          plan.step = 1;
          plan.until = now + 5200;
        }
      } else {
        S.fxClock += dt;
        if (S.fxClock > 1.1) {
          S.fxClock = 0;
          fx('mfx--zzz', cx() + 16, S.y, 'z');
        }
        const near = Math.hypot(mouse.x - cx(), mouse.y - cy()) < 90;
        if (near || now > plan.until) {
          if (near) { setMode('startle'); say(PHRASES.poke, 1600); }
          plan = { kind: 'wander', step: 1, until: now + 700, target: null };
          setMode(near ? 'startle' : 'idle');
        }
      }
    };

    const tickChat = (now: number, dt: number) => {
      const panel = chatPanel();
      if (!panel) { setBehind(false); return nextPlan(); }
      const r = panel.getBoundingClientRect();
      const tx = Math.max(8, r.right - W - 14);
      const ty = Math.max(8, r.top - H + 14);
      const arrived = Math.hypot(tx - S.x, ty - S.y) < 5;
      if (!arrived) {
        setMode('fly');
        move(tx, ty, 320, dt);
      } else {
        setMode(S.talking ? 'talk' : 'sit');
        face(mouse.x >= cx() ? 1 : -1);
        if (S.talking) {
          S.fxClock += dt;
          if (S.fxClock > 0.8) {
            S.fxClock = 0;
            fx('mfx--note', cx() + S.facing * 16, S.y + 4, pick(NOTES));
          }
        }
      }
    };

    const ACTION_DUR: Record<SpriteAction, number> = {
      dance: 3800, spin: 1400, jump: 1000, wave: 1800, hearts: 1900,
      sing: 3200, hide: 0, swim: 0, sleep: 4200, zoom: 0,
    };

    const tickPerform = (now: number, dt: number) => {
      const queue = plan.queue ?? [];
      if (!queue.length) { say(PHRASES.done, 1800); return nextPlan(); }
      const action = queue[0];

      if (!plan.started) {
        // Plans-in-disguise hand control to their own behavior.
        if (action === 'hide') return startHide();
        if (action === 'swim') return startSwim();
        if (action === 'zoom') {
          plan.started = true;
          plan.target = {
            x: S.x < window.innerWidth / 2 ? window.innerWidth - W - 12 : 12,
            y: (0.18 + 0.3 * Math.random()) * window.innerHeight,
          };
          setMode('fly');
          return;
        }
        plan.started = true;
        plan.until = now + ACTION_DUR[action];
        switch (action) {
          case 'dance': setMode('dance'); noteRain(); notesAround(4); break;
          case 'sing': setMode('talk'); noteRain(); break;
          case 'spin': setMode('spin'); sparkles(cx(), cy(), 5); break;
          case 'jump': setMode('jump'); break;
          case 'wave': setMode('wave'); break;
          case 'hearts': setMode('happy'); hearts(7); break;
          case 'sleep': setMode('sleep'); say(PHRASES.sleepy, 2200); break;
          default: setMode('idle');
        }
        return;
      }

      if (action === 'zoom' && plan.target) {
        S.fxClock += dt;
        if (S.fxClock > 0.05) {
          S.fxClock = 0;
          fx('mfx--spark', cx() - S.facing * 18, cy(), '✦');
        }
        if (move(plan.target.x, plan.target.y, 760, dt)) {
          queue.shift();
          plan.started = false;
        }
        return;
      }

      if (action === 'sing') {
        S.fxClock += dt;
        if (S.fxClock > 0.4) {
          S.fxClock = 0;
          fx('mfx--note', cx() + S.facing * 14, S.y + 6, pick(NOTES));
        }
      }
      if (action === 'sleep') {
        S.fxClock += dt;
        if (S.fxClock > 1.1) { S.fxClock = 0; fx('mfx--zzz', cx() + 16, S.y, 'z'); }
      }

      if (now > plan.until) {
        queue.shift();
        plan.started = false;
      }
    };

    // ── Main loop ──────────────────────────────────────────────────
    let last = performance.now();
    let chatCheck = 0;
    const frame = (now: number) => {
      if (!alive) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      S.t += dt;

      // Chat panel opening yanks her over no matter what she was doing
      // (performances finish first — the show must go on).
      chatCheck += dt;
      if (chatCheck > 0.4) {
        chatCheck = 0;
        if (plan.kind !== 'chat' && plan.kind !== 'perform' && chatPanel()) {
          setBehind(false);
          startChat();
        }
      }

      switch (plan.kind) {
        case 'wander': tickWander(now, dt); break;
        case 'bar': tickBar(now, dt); break;
        case 'hide': tickHide(now, dt); break;
        case 'swim': tickSwim(now, dt); break;
        case 'nap': tickNap(now, dt); break;
        case 'chat': tickChat(now, dt); break;
        case 'perform': tickPerform(now, dt); break;
      }

      clamp();

      // Render: float-bob for airborne modes, then one transform write.
      const bob =
        S.mode === 'fly' ? Math.sin(S.t * 6) * 4 :
        S.mode === 'swim' ? Math.sin(S.t * 3) * 9 : 0;
      root.style.transform = `translate3d(${S.x}px, ${S.y + bob}px, 0)`;

      // Eyes track the cursor.
      const lx = Math.max(-2.5, Math.min(2.5, (mouse.x - cx()) / 60));
      const ly = Math.max(-2, Math.min(2, (mouse.y - cy()) / 60));
      root.style.setProperty('--mlx', `${lx.toFixed(2)}px`);
      root.style.setProperty('--mly', `${ly.toFixed(2)}px`);

      raf = requestAnimationFrame(frame);
    };

    // ── Chat wiring ────────────────────────────────────────────────
    let lastUserKey = '';
    let lastBotKey = '';
    let botSettle: ReturnType<typeof setTimeout> | null = null;
    const onChatUpdate = () => {
      let msgs: Array<{ role: string; text: string }>;
      try {
        msgs = JSON.parse(sessionStorage.getItem('mola:chat-messages') ?? '[]');
      } catch { return; }
      const lastMsg = msgs[msgs.length - 1];
      if (!lastMsg) return;
      if (lastMsg.role === 'user') {
        const key = `${msgs.length}:${lastMsg.text}`;
        if (key === lastUserKey) return;
        lastUserKey = key;
        const acts = actionsFromUserText(lastMsg.text);
        if (acts.length) startPerform(acts);
        else { say(PHRASES.chat, 1800); notesAround(1); }
      } else {
        // Streaming reply → "talking" until the text stops growing; then parse
        // any [miku:…] tags that reached storage (covers chat surfaces that
        // bypass the hook's own strip-and-dispatch).
        S.talking = true;
        if (botSettle) clearTimeout(botSettle);
        botSettle = setTimeout(() => {
          S.talking = false;
          const key = String(msgs.length);
          if (key === lastBotKey) return;
          lastBotKey = key;
          try {
            const fresh = JSON.parse(sessionStorage.getItem('mola:chat-messages') ?? '[]') as Array<{ role: string; text: string }>;
            const fin = fresh[fresh.length - 1];
            if (fin?.role === 'bot') {
              const { actions } = extractMikuActions(fin.text);
              if (actions.length) startPerform(actions);
            }
          } catch { /* ignore */ }
        }, 800);
      }
    };

    const onPerform = (e: Event) => {
      const detail = (e as CustomEvent).detail as { actions?: string[] } | undefined;
      if (detail?.actions?.length) startPerform(detail.actions);
    };
    const onShuffle = () => {
      startPerform([pick(['dance', 'spin', 'jump', 'wave', 'hearts'] as SpriteAction[])]);
    };
    const onMouseMove = (e: MouseEvent) => { mouse.x = e.clientX; mouse.y = e.clientY; };
    const onClick = () => {
      if (plan.kind === 'perform') return;
      setMode('wave');
      say(PHRASES.poke, 1800);
      hearts(2);
      after(1400, () => { if (S.mode === 'wave') setMode('idle'); });
    };
    const onDblClick = () => startPerform(['dance']);
    const onResize = () => clamp();

    window.addEventListener('mola:chat-update', onChatUpdate);
    window.addEventListener('miku:perform', onPerform);
    window.addEventListener('miku:shuffle', onShuffle);
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('resize', onResize);
    rig.addEventListener('click', onClick);
    rig.addEventListener('dblclick', onDblClick);

    root.classList.add('is-live');
    after(1300, () => { say(PHRASES.hello); sparkles(cx(), cy(), 5); });

    if (reduced) {
      // Static companion: parked above the bottom bar, reacts with speech only.
      S.x = 18;
      S.y = window.innerHeight - H - 76;
      root.style.transform = `translate3d(${S.x}px, ${S.y}px, 0)`;
      setMode('sit');
    } else {
      raf = requestAnimationFrame(frame);
    }

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      if (bubbleTimer) clearTimeout(bubbleTimer);
      if (botSettle) clearTimeout(botSettle);
      timers.forEach(clearTimeout);
      window.removeEventListener('mola:chat-update', onChatUpdate);
      window.removeEventListener('miku:perform', onPerform);
      window.removeEventListener('miku:shuffle', onShuffle);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      rig.removeEventListener('click', onClick);
      rig.removeEventListener('dblclick', onDblClick);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      <div ref={rootRef} className="mfairy" data-mode="idle" aria-hidden="true">
        <div ref={bubbleRef} className="mfairy__bubble" />
        <div ref={rigRef} className="mfairy__rig">
          <span className="mfairy__tail mfairy__tail--l" />
          <span className="mfairy__tail mfairy__tail--r" />
          <span className="mfairy__arm mfairy__arm--l" />
          <span className="mfairy__arm mfairy__arm--r" />
          <span className="mfairy__leg mfairy__leg--l" />
          <span className="mfairy__leg mfairy__leg--r" />
          <span className="mfairy__torso" />
          <span className="mfairy__skirt" />
          <span className="mfairy__head">
            <span className="mfairy__bud mfairy__bud--l" />
            <span className="mfairy__bud mfairy__bud--r" />
            <span className="mfairy__bangs" />
            <span className="mfairy__eye mfairy__eye--l" />
            <span className="mfairy__eye mfairy__eye--r" />
            <span className="mfairy__blush mfairy__blush--l" />
            <span className="mfairy__blush mfairy__blush--r" />
            <span className="mfairy__mouth" />
          </span>
          <span className="mfairy__shadow" />
        </div>
      </div>
      <div ref={fxRef} className="mfairy-fx" />
    </>
  );
}
