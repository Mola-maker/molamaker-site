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
//
// The "steal" behavior lifts a real word off the page (wrapped via Range,
// measured with @chenglou/pretext so the carried ghost is sized without
// layout reflow), hauls it to a blank spot while humming, drops it, then
// sits cross-legged beside it, cozy and smiling, until the word flies home.

import { useEffect, useRef } from 'react';
import { prepareWithSegments, measureNaturalWidth } from '@chenglou/pretext';
import {
  actionsFromUserText,
  isSpriteAction,
  extractMikuActions,
  type SpriteAction,
} from '@/lib/chat/miku-actions';
import { motifById, randomMotif, saveGalleryItem, type PaintMotif } from '@/lib/miku/paintings';

const W = 64;
const H = 74;

type Mode =
  | 'idle' | 'walk' | 'fly' | 'swim' | 'peek' | 'sit' | 'talk'
  | 'dance' | 'spin' | 'jump' | 'wave' | 'happy' | 'sleep' | 'startle'
  | 'carry' | 'cozy'
  | 'shy' | 'cry' | 'laugh' | 'kiss' | 'angry' | 'think' | 'cheer'
  | 'dizzy' | 'wink' | 'stretch' | 'magic' | 'vibe' | 'bounce' | 'fish'
  | 'paint' | 'balance' | 'push';

type PlanKind =
  | 'wander' | 'bar' | 'hide' | 'swim' | 'chat' | 'nap' | 'perform' | 'steal'
  | 'chase' | 'fish' | 'doodle' | 'vibe' | 'bounce'
  | 'paint' | 'game'
  | 'rope' | 'nudge' | 'underline';

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
  steal: ['借一个字哦~', 'this one is mine now ✧', 'えへへ、もらった!'],
  cozy: ['ふぅ~ 好舒服', '*humming* ♪~', 'こ こ ち い い…', 'cozy ✧'],
  chase: ['来抓我呀~!', 'catch me if you can ✧', '追上我有奖励哦~'],
  caught: ['抓到你啦!', 'gotcha~ ❤', 'タッチ!'],
  tired: ['はぁ、はぁ…', '好快…休息一下', '*pant pant*'],
  fish: ['钓鱼时间~ 🎣', '嘘…鱼会被吓跑的', 'fishing time…'],
  fished: ['钓到一个音符!', '上钩啦~!', '大丰收 ✧'],
  doodle: ['看我画一个~', 'お絵描き time ✎', '画个爱心送你'],
  vibe: ['这首歌不错~ ♪', '*跟着节奏*', 'いい曲~'],
  cheer: ['加油加油~!', 'ファイト!', 'you can do it ✧'],
  think: ['唔…让我想想', 'hmm…', '考え中…'],
  shy: ['讨厌啦~', '/// ω ///', 'はずかしい…'],
  cry: ['呜呜呜…', '嘤嘤嘤', '(  ; ω ; )'],
  laugh: ['哈哈哈哈!', 'あはは!', 'XD'],
  kiss: ['mua~ ❤', '飞吻送你!', 'ちゅっ♡'],
  angry: ['哼!', '生气了!', 'ぷんぷん!'],
  magic: ['见证奇迹的时刻~', '✧ abracadabra ✧', '魔法、発動!'],
  photo: ['茄子~!', 'say cheese!', '咔嚓 ✧'],
  stretch: ['嗯~~~伸个懒腰', 'んん~~', '*stretch*'],
  paint: ['画画时间~ 🎨', '灵感来了!', 'inspiration ✧'],
  painted: ['挂到画廊里啦!', 'to the gallery ✧', '新作完成~!'],
  game: ['来玩捉迷藏吧! 找到我哦~', 'hide & seek! 3 rounds ✧', '我数到三就藏起来啦~'],
  roundMiss: ['这里这里~ 没找到吧', 'I was here~!', '嘿嘿,我藏得好吧'],
  gameWin: ['你赢啦! 画一幅画奖励你~', 'you win! a painting for you ✧', '好厉害…奖励时间!'],
  gameLose: ['嘿嘿,这局我赢~', 'I win this round ~', '下次再来挑战哦'],
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
      /** music player broadcast state — gates the "vibe" behavior */
      music: false,
      /** accumulated scroll speed — fast scrolling makes her dizzy */
      scrollGust: 0,
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
    const tears = () => {
      fx('mfx--tear', S.x + 22, S.y + 30, '💧');
      fx('mfx--tear', S.x + 40, S.y + 30, '💧');
    };
    const angerMark = () => fx('mfx--puff', S.x + W - 10, S.y - 4, '💢');
    /** Camera flash: a full-screen white blink (also drops a 📷 by her hand). */
    const cameraFlash = () => {
      const flash = document.createElement('span');
      flash.className = 'mfx mfx--flash';
      flash.addEventListener('animationend', () => flash.remove());
      fxHost.appendChild(flash);
      after(1200, () => flash.remove());
      fx('mfx--spark', cx() + S.facing * 22, cy() - 6, '📷');
    };
    /** Dizzy stars orbiting her head (burst particles on a ring). */
    const orbitStars = () => {
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI * 2 * i) / 6;
        fx('mfx--burst', cx(), S.y + 10, '✦', {
          '--dx': `${Math.cos(a) * 26}px`,
          '--dy': `${Math.sin(a) * 14 - 8}px`,
          '--c': '#ffd166',
        });
      }
    };
    /** A heart fx that flies from her toward the visitor's cursor. */
    const kissHeart = () => {
      const tx = mouse.x > 0 ? mouse.x : window.innerWidth / 2;
      const ty = mouse.y > 0 ? mouse.y : window.innerHeight / 2;
      fx('mfx--burst', cx() + S.facing * 14, cy(), '❤', {
        '--dx': `${tx - cx()}px`,
        '--dy': `${ty - cy()}px`,
        '--c': '#f0879a',
      });
    };
    // Fishing line: a persistent element (not animation-ended) — removed
    // explicitly when the fishing plan finishes.
    let fishLine: HTMLSpanElement | null = null;
    const dropFishLine = () => {
      removeFishLine();
      fishLine = document.createElement('span');
      fishLine.className = 'mfx-line';
      fxHost.appendChild(fishLine);
    };
    const moveFishLine = (len: number) => {
      if (!fishLine) return;
      fishLine.style.transform = `translate(${(cx() + S.facing * 22).toFixed(1)}px, ${(S.y + 38).toFixed(1)}px)`;
      fishLine.style.height = `${len.toFixed(0)}px`;
    };
    const removeFishLine = () => { fishLine?.remove(); fishLine = null; };

    // ── Atelier (painting) ─────────────────────────────────────────
    // She paints onto a fixed SVG easel: flies the brush along each motif
    // stroke, the polyline growing point by point. Finished pieces are
    // archived to the gallery (lib/miku/paintings) for the magazine wall.
    const SVGNS = 'http://www.w3.org/2000/svg';
    let lastMotif: string | undefined;
    let paintSt: {
      motif: PaintMotif;
      svg: SVGSVGElement;
      box: { x: number; y: number; size: number };
      stroke: number;
      pt: number;
      line: SVGPolylineElement | null;
    } | null = null;

    const removePaint = () => { paintSt?.svg.remove(); paintSt = null; };

    const beginPaint = (motif: PaintMotif) => {
      removePaint();
      const size = Math.max(150, Math.min(280, window.innerWidth - 90, window.innerHeight - 240));
      const box = {
        x: (window.innerWidth - size) / 2,
        y: Math.max(80, (window.innerHeight - size) / 2 - 30),
        size,
      };
      const svg = document.createElementNS(SVGNS, 'svg');
      svg.setAttribute('class', 'mfpaint');
      svg.setAttribute('viewBox', '0 0 100 100');
      svg.style.left = `${box.x}px`;
      svg.style.top = `${box.y}px`;
      svg.style.width = `${size}px`;
      svg.style.height = `${size}px`;
      fxHost.appendChild(svg);
      paintSt = { motif, svg, box, stroke: 0, pt: 0, line: null };
    };

    /** Current brush target in viewport coords, or null when the piece is done. */
    const brushTarget = (): { x: number; y: number } | null => {
      const st = paintSt;
      if (!st || st.stroke >= st.motif.strokes.length) return null;
      const [mx, my] = st.motif.strokes[st.stroke].pts[st.pt];
      return { x: st.box.x + (mx / 100) * st.box.size, y: st.box.y + (my / 100) * st.box.size };
    };

    /** Commit the point under the brush and advance; returns false when done. */
    const brushAdvance = (): boolean => {
      const st = paintSt;
      if (!st) return false;
      const strokeDef = st.motif.strokes[st.stroke];
      if (!st.line) {
        st.line = document.createElementNS(SVGNS, 'polyline');
        st.line.setAttribute('fill', 'none');
        st.line.setAttribute('stroke', strokeDef.color);
        st.line.setAttribute('stroke-width', String(strokeDef.width ?? 3));
        st.line.setAttribute('stroke-linecap', 'round');
        st.line.setAttribute('stroke-linejoin', 'round');
        st.svg.appendChild(st.line);
      }
      const [mx, my] = strokeDef.pts[st.pt];
      const prev = st.line.getAttribute('points') ?? '';
      st.line.setAttribute('points', `${prev}${prev ? ' ' : ''}${mx},${my}`);
      st.pt++;
      if (st.pt >= strokeDef.pts.length) { st.stroke++; st.pt = 0; st.line = null; }
      return st.stroke < st.motif.strokes.length;
    };

    // ── Hide-and-seek game ─────────────────────────────────────────
    let gameSt: { round: number; score: number; total: number; board: HTMLDivElement } | null = null;

    const endGame = () => { gameSt?.board.remove(); gameSt = null; };

    const beginGame = () => {
      endGame();
      const board = document.createElement('div');
      board.className = 'mfgame-score';
      fxHost.appendChild(board);
      gameSt = { round: 0, score: 0, total: 3, board };
      updateBoard();
    };
    const updateBoard = (msg?: string) => {
      const g = gameSt;
      if (!g) return;
      g.board.textContent = msg ?? `🙈 ${Math.min(g.round, g.total)}/${g.total} · ★ ${g.score}`;
    };

    // ── Movement ───────────────────────────────────────────────────
    const move = (tx: number, ty: number, speed: number, dt: number) => {
      const dx = tx - S.x;
      const dy = ty - S.y;
      const d = Math.hypot(dx, dy);
      if (d < 3) { S.x = tx; S.y = ty; return true; }
      // Ease-out arrival: full speed in open air, braking inside the last
      // ~90px so she settles instead of stopping dead.
      const step = Math.min(d, speed * dt * Math.min(1, 0.3 + d / 90));
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

    // ── Word stealing ──────────────────────────────────────────────
    // She lifts a real word off the page: the original is wrapped in a span
    // (gap stays in the layout), a fixed-position ghost rides in her hands.

    let stealState: { span: HTMLElement; ghost: HTMLDivElement; w: number } | null = null;

    /** Pick a steal-able word: walk text nodes of visible prose, choose a
     *  3–12 letter word (or a short CJK run) and wrap it in a span. */
    const stealTarget = (): HTMLElement | null => {
      const els = Array.from(document.querySelectorAll(
        '.variant-stage h1, .variant-stage h2, .variant-stage h3, .variant-stage p',
      )).filter((el) => {
        const r = el.getBoundingClientRect();
        return r.top > 130 && r.bottom < window.innerHeight - 70 &&
          (el.textContent ?? '').trim().length > 6 && !el.closest('a, button');
      });
      if (!els.length) return null;
      for (let attempt = 0; attempt < 6; attempt++) {
        const el = pick(els);
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        const words: Array<{ node: Text; start: number; end: number }> = [];
        let n: Node | null;
        while ((n = walker.nextNode())) {
          if ((n.parentElement)?.closest('.mfword, a, button, code')) continue;
          const text = n.textContent ?? '';
          const re = /[A-Za-z]{3,12}|[一-鿿]{2,4}/g;
          let m: RegExpExecArray | null;
          while ((m = re.exec(text))) words.push({ node: n as Text, start: m.index, end: m.index + m[0].length });
        }
        if (!words.length) continue;
        const wd = pick(words);
        const range = document.createRange();
        range.setStart(wd.node, wd.start);
        range.setEnd(wd.node, wd.end);
        const r = range.getBoundingClientRect();
        if (r.width < 14 || r.width > 240 || r.top < 120 || r.bottom > window.innerHeight - 80) continue;
        const span = document.createElement('span');
        span.className = 'mfword';
        try { range.surroundContents(span); } catch { continue; }
        return span;
      }
      return null;
    };

    const makeGhost = (span: HTMLElement) => {
      const r = span.getBoundingClientRect();
      const cs = getComputedStyle(span);
      const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const word = span.textContent ?? '';
      // pretext measures the word with the browser's font engine but without
      // touching layout — no reflow while she's mid-flight.
      let w = r.width;
      try { w = measureNaturalWidth(prepareWithSegments(word, font)); } catch { /* fallback: live rect */ }
      const g = document.createElement('div');
      g.className = 'mfword-ghost';
      g.textContent = word;
      g.style.font = font;
      g.style.color = cs.color;
      g.style.transform = `translate(${r.left}px, ${r.top}px)`;
      g.addEventListener('click', () => returnWord());
      document.body.appendChild(g);
      return { g, w: Math.max(14, w) };
    };

    /** Word flies back to its gap (the span is still holding the space). */
    const returnWord = (instant = false) => {
      const st = stealState;
      if (!st) return;
      stealState = null;
      const { span, ghost } = st;
      const finish = () => {
        ghost.remove();
        // Restore the original text node so the DOM shape React rendered
        // comes back exactly (the span was our insertion).
        if (span.isConnected) span.replaceWith(document.createTextNode(span.textContent ?? ''));
      };
      if (instant || !span.isConnected) { finish(); return; }
      const r = span.getBoundingClientRect();
      ghost.classList.remove('is-carried');
      ghost.classList.add('is-return');
      ghost.style.transform = `translate(${r.left}px, ${r.top}px) rotate(0deg)`;
      after(680, finish);
    };

    const carryGhost = () => {
      const st = stealState;
      if (!st) return;
      st.ghost.style.transform =
        `translate(${S.x + W / 2 - st.w / 2}px, ${S.y - 20 + Math.sin(S.t * 5) * 2}px) ` +
        `rotate(${(Math.sin(S.t * 3) * 4).toFixed(2)}deg)`;
    };

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
    // ── Word-block & line props ────────────────────────────────────
    // She physically interacts with the page's text: tightrope-walks heading
    // tops, shoves whole blocks (restored on every exit path), and underlines
    // a headline by running beneath it.

    let nudged: { el: HTMLElement; prevTransform: string; prevTransition: string } | null = null;
    const restoreNudge = () => {
      if (!nudged) return;
      const { el, prevTransform, prevTransition } = nudged;
      nudged = null;
      el.style.transform = prevTransform;
      after(450, () => { el.style.transition = prevTransition; });
    };

    let underlineEl: HTMLDivElement | null = null;
    const removeUnderline = () => { underlineEl?.remove(); underlineEl = null; };

    /** Wide, sturdy headings she can balance on / shove / underline. */
    const blockTarget = (minWidth = 200): HTMLElement | null => {
      const els = Array.from(document.querySelectorAll<HTMLElement>(
        '.variant-stage h1, .variant-stage h2, .variant-stage h3',
      )).filter((el) => {
        const r = el.getBoundingClientRect();
        return r.top > 130 && r.bottom < window.innerHeight - 80 &&
          r.width >= minWidth && r.height >= 22 &&
          (el.textContent ?? '').trim().length > 2 && !el.closest('a, button') &&
          !el.style.transform; // never stack interactions on one block
      });
      return els.length ? pick(els) : null;
    };

    const startRope = () => {
      const el = blockTarget(240);
      if (!el) return startWander();
      plan = { kind: 'rope', step: 0, until: 0, target: null, el, frac: 0 };
    };
    const startNudge = () => {
      const el = blockTarget(160);
      if (!el) return startWander();
      plan = { kind: 'nudge', step: 0, until: 0, target: null, el, cycles: 3 };
    };
    const startUnderline = () => {
      const el = blockTarget(200);
      if (!el) return startWander();
      plan = { kind: 'underline', step: 0, until: 0, target: null, el };
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
    const startSteal = () => {
      const span = stealTarget();
      if (!span) return startWander();
      const { g, w } = makeGhost(span);
      stealState = { span, ghost: g, w };
      plan = { kind: 'steal', step: 0, until: 0, target: null, targets: findBlankPoints(1) };
    };
    const startChase = () => {
      // No cursor to chase (touch device / mouse parked) → wander instead.
      if (mouse.x < 0) return startWander();
      plan = { kind: 'chase', step: 0, until: performance.now() + 7000, target: null };
      say(PHRASES.chase, 2000);
    };
    const startFish = () => {
      const bar = findBar();
      if (!bar) return startWander();
      plan = { kind: 'fish', step: 0, until: 0, target: null, el: bar.el };
    };
    const startDoodle = () => {
      const [c] = findBlankPoints(1);
      // centre of the heart she's about to trace; keep it on screen.
      const x = Math.max(110, Math.min(c.x, window.innerWidth - 110));
      const y = Math.max(140, Math.min(c.y, window.innerHeight - 140));
      plan = { kind: 'doodle', step: 0, until: 0, target: { x, y } };
    };
    const startVibe = (forced = false) => {
      // `frac` doubles as the "asked for it" flag: a requested vibe runs its
      // course even with no music playing; an autonomous one stops with it.
      plan = { kind: 'vibe', step: 0, until: 0, target: null, frac: forced ? 1 : 0 };
      say(PHRASES.vibe, 2200);
    };
    const startBounce = () => {
      const bar = findBar();
      if (!bar) return startWander();
      plan = { kind: 'bounce', step: 0, until: 0, target: null, el: bar.el };
    };
    const startPaint = (motifId?: string) => {
      const motif = (motifId && motifById(motifId)) || randomMotif(lastMotif);
      lastMotif = motif.id;
      beginPaint(motif);
      say(PHRASES.paint, 2000);
      plan = { kind: 'paint', step: 0, until: 0, target: null };
    };
    const startGame = () => {
      beginGame();
      say(PHRASES.game, 2400);
      setMode('cheer');
      plan = { kind: 'game', step: 0, until: performance.now() + 1900, target: null };
    };
    const startPerform = (actions: string[]) => {
      const queue = actions.filter(isSpriteAction) as SpriteAction[];
      if (!queue.length) return;
      setBehind(false);
      if (plan.kind === 'steal') returnWord();
      if (plan.kind === 'fish') removeFishLine();
      if (plan.kind === 'paint') removePaint();
      if (plan.kind === 'game') endGame();
      if (plan.kind === 'nudge') restoreNudge();
      if (plan.kind === 'underline') removeUnderline();
      plan = { kind: 'perform', step: 0, until: 0, target: null, queue, started: false };
    };

    const nextPlan = () => {
      if (chatPanel()) return startChat();
      // While music plays she mostly wants to vibe along.
      if (S.music && Math.random() < 0.35) return startVibe();
      const roll = Math.random();
      if (roll < 0.04) startPaint();           // the muse strikes, occasionally
      else if (roll < 0.15) startHide();
      else if (roll < 0.25) startSwim();
      else if (roll < 0.37) startSteal();
      else if (roll < 0.5) startBar();
      else if (roll < 0.56) startFish();
      else if (roll < 0.61) startDoodle();
      else if (roll < 0.65) startBounce();
      else if (roll < 0.69) startChase();
      else if (roll < 0.76) startRope();
      else if (roll < 0.82) startNudge();
      else if (roll < 0.88) startUnderline();
      else if (roll < 0.95) startWander();
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
      } else {
        // idle fidgets — she's alive even when she's doing nothing
        S.fxClock += dt;
        if (S.fxClock > 1.3 && Math.random() < 0.4) {
          S.fxClock = 0;
          const fidget: Mode = pick(['wink', 'think', 'stretch', 'idle', 'idle'] as Mode[]);
          if (fidget !== 'idle') {
            setMode(fidget);
            after(fidget === 'stretch' ? 1900 : 900, () => {
              if (plan.kind === 'wander' && plan.step === 1 && S.mode === fidget) setMode('idle');
            });
          }
        }
        if (now > plan.until) nextPlan();
      }
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

    const tickSteal = (now: number, dt: number) => {
      const st = stealState;
      if (!st && plan.step < 3) return nextPlan();
      if (plan.step === 0 && st) {
        // Sneak up to the word.
        const r = st.span.getBoundingClientRect();
        if (!st.span.isConnected || !inView(r)) { returnWord(true); return nextPlan(); }
        st.ghost.style.transform = `translate(${r.left}px, ${r.top}px)`;
        setMode('fly');
        if (move(r.left + r.width / 2 - W / 2, r.top - H + 24, 240, dt)) {
          st.span.classList.add('mfword--gone');
          st.ghost.classList.add('is-carried');
          setMode('carry');
          say(PHRASES.steal, 1700);
          sparkles(cx(), cy(), 4);
          plan.step = 1;
        }
      } else if (plan.step === 1 && st) {
        // Haul it to the vacancy, humming all the way.
        setMode('carry');
        carryGhost();
        S.fxClock += dt;
        if (S.fxClock > 0.7) { S.fxClock = 0; fx('mfx--note', cx() + S.facing * 12, S.y - 8, pick(NOTES)); }
        const dest = plan.targets?.[0];
        if (!dest || move(dest.x, dest.y, 150, dt)) {
          // Set the word down beside her…
          const dropX = S.facing > 0 ? S.x + W + 6 : S.x - st.w - 6;
          const dropY = S.y + H - 16;
          st.ghost.classList.remove('is-carried');
          st.ghost.classList.add('is-drop');
          st.ghost.style.transform = `translate(${dropX}px, ${dropY}px) rotate(${(Math.random() * 12 - 6).toFixed(1)}deg)`;
          // …then settle in, cross-legged and pleased with herself.
          setMode('cozy');
          face(dropX > S.x ? 1 : -1);
          say(PHRASES.cozy, 2600);
          plan.step = 2;
          plan.until = now + 7000 + Math.random() * 2500;
        }
      } else if (plan.step === 2) {
        S.fxClock += dt;
        if (S.fxClock > 1.5) { S.fxClock = 0; fx('mfx--note', cx() + S.facing * 14, S.y + 2, pick(['♪', '♡', '~'])); }
        if (now > plan.until) {
          returnWord();
          setMode('happy');
          plan.step = 3;
          plan.until = now + 900;
        }
      } else if (now > plan.until) nextPlan();
    };

    const tickChase = (now: number, dt: number) => {
      if (plan.step === 0) {
        if (mouse.x < 0) return nextPlan();
        setMode('fly');
        const arrived = move(mouse.x - W / 2, mouse.y - H / 2, 230, dt);
        if (arrived || Math.hypot(mouse.x - cx(), mouse.y - cy()) < 36) {
          setMode('happy');
          say(PHRASES.caught, 2200);
          hearts(5);
          plan.step = 1;
          plan.until = now + 1600;
        } else if (now > plan.until) {
          // She gave it her best — cursor wins this round.
          setMode('think');
          say(PHRASES.tired, 2200);
          fx('mfx--tear', S.x + 46, S.y + 8, '💧');
          plan.step = 1;
          plan.until = now + 1800;
        }
      } else if (now > plan.until) nextPlan();
    };

    const tickFish = (now: number, dt: number) => {
      const surf = barSurface(plan.el ?? null);
      if (!surf || surf.right <= surf.left) { removeFishLine(); return nextPlan(); }
      const y = surf.top - H + 2;
      if (plan.step === 0) {
        setMode('fly');
        const tx = surf.left + (surf.right - surf.left) * 0.5;
        if (move(tx, y, 230, dt)) {
          setMode('fish');
          say(PHRASES.fish, 2200);
          dropFishLine();
          plan.step = 1;
          plan.until = now + 4500 + Math.random() * 3000;
        }
      } else if (plan.step === 1) {
        S.y = y; // stay seated on the bar even if the page scrolls
        const maxLen = Math.max(30, Math.min(130, window.innerHeight - (S.y + 38) - 14));
        moveFishLine(maxLen + Math.sin(S.t * 2.2) * 5);
        if (now > plan.until) {
          // a bite! the catch pops up the line into her hands.
          removeFishLine();
          fx('mfx--note', cx() + S.facing * 22, S.y + 30, pick(['♪', '🐟', '★']));
          setMode('happy');
          say(PHRASES.fished, 2200);
          sparkles(cx(), cy(), 5);
          plan.step = 2;
          plan.until = now + 1700;
        }
      } else if (now > plan.until) nextPlan();
    };

    /** Trace a parametric heart, leaving a spark trail — her little gift. */
    const heartPoint = (c: { x: number; y: number }, tt: number) => {
      const s = 5.5;
      return {
        x: c.x + 16 * Math.sin(tt) ** 3 * s,
        y: c.y - (13 * Math.cos(tt) - 5 * Math.cos(2 * tt) - 2 * Math.cos(3 * tt) - Math.cos(4 * tt)) * s,
      };
    };
    const tickDoodle = (now: number, dt: number) => {
      const c = plan.target;
      if (!c) return nextPlan();
      if (plan.step === 0) {
        setMode('fly');
        const p0 = heartPoint(c, 0);
        if (move(p0.x - W / 2, p0.y - H / 2, 240, dt)) {
          say(PHRASES.doodle, 2000);
          plan.step = 1;
          plan.cycles = 0; // reused as the parameter clock (×1000)
        }
      } else if (plan.step === 1) {
        setMode('fly');
        const tt = (plan.cycles ?? 0) / 1000 + dt * (Math.PI * 2 / 4.6);
        plan.cycles = tt * 1000;
        const p = heartPoint(c, Math.min(tt, Math.PI * 2));
        face(p.x - W / 2 >= S.x ? 1 : -1);
        S.x = p.x - W / 2;
        S.y = p.y - H / 2;
        S.fxClock += dt;
        if (S.fxClock > 0.045) {
          S.fxClock = 0;
          fx('mfx--trail', p.x, p.y + H / 6, '•');
        }
        if (tt >= Math.PI * 2) {
          setMode('happy');
          say(PHRASES.done, 2000);
          hearts(4);
          plan.step = 2;
          plan.until = now + 1800;
        }
      } else if (now > plan.until) nextPlan();
    };

    const tickVibe = (now: number, dt: number) => {
      if (plan.step === 0) {
        setMode('vibe');
        plan.step = 1;
        plan.until = now + 6500 + Math.random() * 2500;
      } else {
        S.fxClock += dt;
        if (S.fxClock > 0.8) {
          S.fxClock = 0;
          fx('mfx--note', cx() + (Math.random() - 0.5) * 40, S.y - 6, pick(NOTES));
        }
        if ((plan.frac !== 1 && !S.music) || now > plan.until) nextPlan();
      }
    };

    const tickBounce = (now: number, dt: number) => {
      const surf = barSurface(plan.el ?? null);
      if (!surf || surf.right <= surf.left) return nextPlan();
      const y = surf.top - H + 2;
      if (plan.step === 0) {
        setMode('fly');
        const tx = surf.left + (surf.right - surf.left) * (0.3 + Math.random() * 0.4);
        if (move(tx, y, 230, dt)) {
          setMode('bounce');
          plan.step = 1;
          plan.until = now + 3600;
        }
      } else if (plan.step === 1) {
        S.y = y;
        S.fxClock += dt;
        if (S.fxClock > 0.55) { S.fxClock = 0; fx('mfx--spark', cx(), S.y + H - 6, '✦'); }
        if (now > plan.until) {
          setMode('happy');
          plan.step = 2;
          plan.until = now + 900;
        }
      } else if (now > plan.until) nextPlan();
    };

    const tickPaint = (now: number, dt: number) => {
      const st = paintSt;
      if (!st) return nextPlan();
      if (plan.step === 0 || plan.step === 1) {
        const target = brushTarget();
        if (!target) {
          // last stroke finished → sign it, archive it, admire it.
          st.svg.classList.add('is-done');
          sparkles(st.box.x + st.box.size / 2, st.box.y + st.box.size / 2, 8);
          saveGalleryItem(st.motif.id);
          say(PHRASES.painted, 2400);
          setMode('happy');
          plan.step = 2;
          plan.until = now + 2400;
          return;
        }
        // brush rides under her right hand (fixed offset — a facing-dependent
        // one would flip mid-approach and make her orbit the point forever).
        const startingStroke = st.pt === 0;
        setMode(startingStroke && plan.step === 0 ? 'fly' : 'paint');
        const arrived = move(target.x - W / 2 - 14, target.y - 46, startingStroke ? 250 : 190, dt);
        if (arrived) {
          brushAdvance();
          plan.step = 1;
          if (Math.random() < 0.12) fx('mfx--spark', target.x, target.y, '✦');
        }
      } else if (now > plan.until) {
        st.svg.classList.add('is-fade');
        after(650, removePaint);
        plan.step = 3;
        plan.until = now + 700;
      }
      if (plan.step === 3 && now > plan.until) nextPlan();
    };

    const tickGame = (now: number, dt: number) => {
      const g = gameSt;
      if (!g) return nextPlan();
      if (plan.step === 0) {
        // announcement beat, then the first round
        if (now > plan.until) { plan.step = 1; g.round++; updateBoard(); plan.el = findHideSpot(); plan.frac = 0.1 + 0.8 * Math.random(); }
      } else if (plan.step === 1) {
        // travel to the hiding spot (a fresh one each round)
        const el = plan.el;
        if (!el) { plan.el = findHideSpot(); if (!plan.el) { endGame(); return nextPlan(); } return; }
        const r = el.getBoundingClientRect();
        if (!inView(r)) { plan.el = findHideSpot(); return; }
        const hx = r.left + (plan.frac ?? 0.5) * Math.max(1, r.width - W);
        setMode('fly');
        if (move(hx, r.bottom - H + 8, 300, dt)) {
          setBehind(true);
          setMode('peek');
          plan.step = 2;
          plan.until = now + 9000;
        }
      } else if (plan.step === 2) {
        // hiding — the window click handler scores the find
        if (now > plan.until) {
          setBehind(false);
          setMode('happy');
          say(PHRASES.roundMiss, 2000);
          plan.step = 3;
          plan.until = now + 1500;
        }
      } else if (plan.step === 3) {
        if (now > plan.until) {
          if (g.round < g.total) {
            plan.step = 1;
            g.round++;
            updateBoard();
            plan.el = findHideSpot();
            plan.frac = 0.1 + 0.8 * Math.random();
          } else {
            const won = g.score >= 2;
            updateBoard(won ? `★ ${g.score}/${g.total} — WIN!` : `★ ${g.score}/${g.total}`);
            say(won ? PHRASES.gameWin : PHRASES.gameLose, 2600);
            setMode(won ? 'cheer' : 'wink');
            if (won) sparkles(cx(), cy(), 8); else hearts(2);
            plan.step = 4;
            plan.until = now + 2300;
          }
        }
      } else if (now > plan.until) {
        const won = g.score >= 2;
        endGame();
        if (won) startPaint();
        else nextPlan();
      }
    };

    /** Window-level click: during a hiding round, a click near her counts. */
    const onSeekClick = (e: MouseEvent) => {
      if (plan.kind !== 'game' || plan.step !== 2 || !gameSt) return;
      if (Math.hypot(e.clientX - cx(), e.clientY - cy()) > 95) return;
      gameSt.score++;
      setBehind(false);
      setMode('startle');
      say(PHRASES.found, 2000);
      hearts(4);
      updateBoard();
      plan.step = 3;
      plan.until = performance.now() + 1500;
    };

    const tickRope = (now: number, dt: number) => {
      const el = plan.el as HTMLElement | null;
      if (!el?.isConnected) return nextPlan();
      const r = el.getBoundingClientRect();
      if (!inView(r) || r.top < 110) return nextPlan();
      const y = r.top - H + 2;
      if (plan.step === 0) {
        setMode('fly');
        if (move(r.left + 4, y, 240, dt)) {
          plan.step = 1;
          say(['看我走钢丝~', 'balance time ✧', 'とっとっと…'], 1800);
        }
      } else if (plan.step === 1) {
        // tightrope: inch along the heading's top edge, arms out, wobbling
        setMode('balance');
        S.y = y;
        if (move(r.right - W - 4, y, 44, dt)) {
          setMode('jump');
          plan.step = 2;
          plan.until = now + 950;
          sparkles(cx(), S.y + H, 3);
        }
      } else if (now > plan.until) {
        setMode('happy');
        plan.step = 3;
        plan.until = now + 900;
      }
      if (plan.step === 3 && now > plan.until) nextPlan();
    };

    const tickNudge = (now: number, dt: number) => {
      const el = plan.el as HTMLElement | null;
      if (!el?.isConnected) { restoreNudge(); return nextPlan(); }
      const r = el.getBoundingClientRect();
      if (!inView(r)) { restoreNudge(); return nextPlan(); }
      if (plan.step === 0) {
        setMode('fly');
        // brace against the block's left edge, feet level with its baseline
        if (move(r.left - W + 12, r.bottom - H + 6, 240, dt)) {
          face(1);
          setMode('push');
          nudged = { el, prevTransform: el.style.transform, prevTransition: el.style.transition };
          el.style.transition = 'transform 0.3s cubic-bezier(0.3, 1.4, 0.4, 1)';
          plan.step = 1;
          plan.until = now + 600;
        }
      } else if (plan.step === 1) {
        if (now > plan.until) {
          const remaining = (plan.cycles ?? 0) - 1;
          plan.cycles = remaining;
          const shove = (3 - remaining) * 7;
          el.style.transform = `translateX(${shove}px) rotate(${(shove * 0.06).toFixed(2)}deg)`;
          S.x += 2; // she leans into it
          fx('mfx--spark', r.left + 2, r.top + r.height / 2, '✦');
          if (remaining <= 0) {
            // the block springs back and bowls her over
            restoreNudge();
            setMode('startle');
            say(['哇它弹回来了!', 'boing!?', '推不动…'], 2000);
            S.x -= 14;
            plan.step = 2;
            plan.until = now + 1500;
          } else {
            plan.until = now + 700;
          }
        }
      } else if (now > plan.until) nextPlan();
    };

    const tickUnderline = (now: number, dt: number) => {
      const el = plan.el as HTMLElement | null;
      if (!el?.isConnected) { removeUnderline(); return nextPlan(); }
      const r = el.getBoundingClientRect();
      if (!inView(r) || r.bottom > window.innerHeight - 40) { removeUnderline(); return nextPlan(); }
      const y = r.bottom - H + 10;
      if (plan.step === 0) {
        setMode('fly');
        if (move(r.left - 10, y, 240, dt)) {
          underlineEl = document.createElement('div');
          underlineEl.className = 'mf-underline';
          fxHost.appendChild(underlineEl);
          say(['给这行画个重点~', 'underline! ✎'], 1700);
          plan.step = 1;
        }
      } else if (plan.step === 1) {
        // sprint under the headline, the accent line growing behind her
        setMode('walk');
        S.y = y;
        const arrived = move(r.right - W + 10, y, 150, dt);
        if (underlineEl) {
          const width = Math.max(0, Math.min(S.x + W / 2 - r.left, r.width));
          underlineEl.style.transform = `translate(${r.left.toFixed(1)}px, ${(r.bottom + 3).toFixed(1)}px)`;
          underlineEl.style.width = `${width.toFixed(1)}px`;
        }
        if (arrived) {
          underlineEl?.classList.add('is-done');
          setMode('happy');
          sparkles(r.right - 10, r.bottom + 4, 4);
          plan.step = 2;
          plan.until = now + 2200;
        }
      } else if (now > plan.until) {
        underlineEl?.classList.add('is-fade');
        after(500, removeUnderline);
        nextPlan();
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
      bounce: 0, chase: 0, fish: 0, doodle: 0, vibe: 0, paint: 0, seek: 0,
      shy: 2600, cry: 3000, laugh: 2400, kiss: 1900, angry: 2400,
      think: 3000, cheer: 2800, dizzy: 2800, wink: 1200, stretch: 2300,
      magic: 3000, photo: 2100,
    };

    const tickPerform = (now: number, dt: number) => {
      const queue = plan.queue ?? [];
      if (!queue.length) { say(PHRASES.done, 1800); return nextPlan(); }
      const action = queue[0];

      if (!plan.started) {
        // Plans-in-disguise hand control to their own behavior.
        if (action === 'hide') return startHide();
        if (action === 'swim') return startSwim();
        if (action === 'fish') return startFish();
        if (action === 'doodle') return startDoodle();
        if (action === 'chase') return startChase();
        if (action === 'vibe') return startVibe(true);
        if (action === 'bounce') return startBounce();
        if (action === 'paint') return startPaint();
        if (action === 'seek') return startGame();
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
          case 'shy': setMode('shy'); say(PHRASES.shy, 2200); break;
          case 'cry': setMode('cry'); say(PHRASES.cry, 2400); tears(); break;
          case 'laugh': setMode('laugh'); say(PHRASES.laugh, 2000); break;
          case 'kiss':
            setMode('kiss'); say(PHRASES.kiss, 1800);
            kissHeart(); after(450, kissHeart); after(900, kissHeart);
            break;
          case 'angry': setMode('angry'); say(PHRASES.angry, 2000); angerMark(); break;
          case 'think': setMode('think'); say(PHRASES.think, 2600); fx('mfx--note', S.x + W, S.y - 6, '?'); break;
          case 'cheer': setMode('cheer'); say(PHRASES.cheer, 2400); sparkles(cx(), cy() - 14, 6); break;
          case 'dizzy': setMode('dizzy'); orbitStars(); break;
          case 'wink': setMode('wink'); fx('mfx--heart', S.x + W - 6, S.y + 16, '❤'); break;
          case 'stretch': setMode('stretch'); say(PHRASES.stretch, 2000); break;
          case 'magic': setMode('magic'); say(PHRASES.magic, 2400); break;
          case 'photo':
            setMode('happy'); say(PHRASES.photo, 1600);
            after(650, cameraFlash);
            break;
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
      if (action === 'cry') {
        S.fxClock += dt;
        if (S.fxClock > 0.55) { S.fxClock = 0; tears(); }
      }
      if (action === 'dizzy') {
        S.fxClock += dt;
        if (S.fxClock > 0.9) { S.fxClock = 0; orbitStars(); }
      }
      if (action === 'magic') {
        S.fxClock += dt;
        if (S.fxClock > 0.4) {
          S.fxClock = 0;
          sparkles(cx() + S.facing * 24, S.y + 4, 3);
          fx('mfx--note', cx() + (Math.random() - 0.5) * 70, S.y - 10, pick(['✦', '★', '❤', '♪']));
        }
      }
      if (action === 'cheer') {
        S.fxClock += dt;
        if (S.fxClock > 0.7) { S.fxClock = 0; fx('mfx--spark', cx() + (Math.random() - 0.5) * 50, S.y - 8, '✧'); }
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
        if (plan.kind !== 'chat' && plan.kind !== 'perform' && plan.kind !== 'game' && plan.kind !== 'paint' && chatPanel()) {
          setBehind(false);
          // Mid-heist? Put the word back before reporting for chat duty.
          if (plan.kind === 'steal') returnWord();
          if (plan.kind === 'fish') removeFishLine();
          if (plan.kind === 'nudge') restoreNudge();
          if (plan.kind === 'underline') removeUnderline();
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
        case 'steal': tickSteal(now, dt); break;
        case 'chase': tickChase(now, dt); break;
        case 'fish': tickFish(now, dt); break;
        case 'doodle': tickDoodle(now, dt); break;
        case 'vibe': tickVibe(now, dt); break;
        case 'bounce': tickBounce(now, dt); break;
        case 'paint': tickPaint(now, dt); break;
        case 'game': tickGame(now, dt); break;
        case 'rope': tickRope(now, dt); break;
        case 'nudge': tickNudge(now, dt); break;
        case 'underline': tickUnderline(now, dt); break;
      }

      // Fast scrolling whips the wind around her — a brief dizzy stagger.
      S.scrollGust = Math.max(0, S.scrollGust - dt * 2400);
      if (S.scrollGust > 2800 && plan.kind !== 'perform' && plan.kind !== 'chat' && plan.kind !== 'steal') {
        S.scrollGust = 0;
        setBehind(false);
        plan = { kind: 'perform', step: 0, until: 0, target: null, queue: ['dizzy'], started: false };
      }

      clamp();

      // Render: float-bob for airborne modes, then one transform write.
      const bob =
        S.mode === 'fly' ? Math.sin(S.t * 6) * 4 :
        S.mode === 'swim' ? Math.sin(S.t * 3) * 9 :
        S.mode === 'carry' ? Math.sin(S.t * 5) * 3 : 0;
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
      startPerform([pick([
        'dance', 'spin', 'jump', 'wave', 'hearts',
        'laugh', 'wink', 'magic', 'cheer', 'photo', 'kiss', 'stretch',
      ] as SpriteAction[])]);
    };
    const onMouseMove = (e: MouseEvent) => { mouse.x = e.clientX; mouse.y = e.clientY; };
    const onPaintReq = (e: Event) => {
      const motif = ((e as CustomEvent).detail?.motif as string | undefined);
      if (plan.kind !== 'paint') startPaint(motif);
    };
    const onGameReq = () => { if (plan.kind !== 'game') startGame(); };
    const onClick = () => {
      if (plan.kind === 'perform' || plan.kind === 'game' || plan.kind === 'paint') return;
      setMode('wave');
      say(PHRASES.poke, 1800);
      hearts(2);
      after(1400, () => { if (S.mode === 'wave') setMode('idle'); });
    };
    const onDblClick = () => startPerform(['dance']);
    const onResize = () => clamp();
    const onNowPlaying = (e: Event) => {
      const d = (e as CustomEvent).detail as { playing?: boolean } | undefined;
      if (d && typeof d.playing === 'boolean') S.music = d.playing;
    };
    const onWheel = (e: WheelEvent) => { S.scrollGust += Math.abs(e.deltaY); };

    window.addEventListener('mola:chat-update', onChatUpdate);
    window.addEventListener('miku:perform', onPerform);
    window.addEventListener('miku:shuffle', onShuffle);
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('resize', onResize);
    window.addEventListener('mola:now-playing', onNowPlaying);
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('miku:paint', onPaintReq);
    window.addEventListener('miku:game', onGameReq);
    window.addEventListener('click', onSeekClick);
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
      // Give any stolen word back before leaving the page.
      if (stealState) {
        const { span, ghost } = stealState;
        stealState = null;
        ghost.remove();
        if (span.isConnected) span.replaceWith(document.createTextNode(span.textContent ?? ''));
      }
      removeFishLine();
      removePaint();
      endGame();
      restoreNudge();
      removeUnderline();
      window.removeEventListener('miku:paint', onPaintReq);
      window.removeEventListener('miku:game', onGameReq);
      window.removeEventListener('click', onSeekClick);
      window.removeEventListener('mola:chat-update', onChatUpdate);
      window.removeEventListener('miku:perform', onPerform);
      window.removeEventListener('miku:shuffle', onShuffle);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mola:now-playing', onNowPlaying);
      window.removeEventListener('wheel', onWheel);
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
          {/* Anime-style chibi rig — one SVG, parts grouped + class-tagged so
              the CSS mode animations rotate/sway them like puppet joints. */}
          <svg className="mfairy__svg" viewBox="0 0 64 78" width="64" height="78">
            <defs>
              <linearGradient id="mfgHair" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#86ecdf" />
                <stop offset="0.65" stopColor="#39c5bb" />
                <stop offset="1" stopColor="#2aa39c" />
              </linearGradient>
              <linearGradient id="mfgTail" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#6fdcd2" />
                <stop offset="0.6" stopColor="#39c5bb" />
                <stop offset="1" stopColor="#258f8b" />
              </linearGradient>
              <radialGradient id="mfgIris" cx="0.5" cy="0.42" r="0.62">
                <stop offset="0" stopColor="#bdf3ef" />
                <stop offset="0.55" stopColor="#2fa7a4" />
                <stop offset="1" stopColor="#10646c" />
              </radialGradient>
              <linearGradient id="mfgTorso" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#5a5f68" />
                <stop offset="1" stopColor="#41464e" />
              </linearGradient>
            </defs>

            {/* twin-tails (behind everything) */}
            <g className="mfairy__tail mfairy__tail--l">
              <path d="M9,16 C3,26 2,40 7,54 C9,59 13,58 14,52 C16,40 15,27 14,17 Z" fill="url(#mfgTail)" stroke="#fffdfa" strokeWidth="2" strokeLinejoin="round" />
              <path d="M11,22 C8,32 8,42 10,50" fill="none" stroke="#9ff0e7" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
            </g>
            <g className="mfairy__tail mfairy__tail--r">
              <path d="M55,16 C61,26 62,40 57,54 C55,59 51,58 50,52 C48,40 49,27 50,17 Z" fill="url(#mfgTail)" stroke="#fffdfa" strokeWidth="2" strokeLinejoin="round" />
              <path d="M53,22 C56,32 56,42 54,50" fill="none" stroke="#9ff0e7" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
            </g>

            {/* arms (behind torso) */}
            <g className="mfairy__arm mfairy__arm--l">
              <rect x="20.5" y="42" width="5" height="13" rx="2.5" fill="#4a4f57" stroke="#fffdfa" strokeWidth="1.6" />
              <circle cx="23" cy="55" r="2.4" fill="#ffe9de" stroke="#fffdfa" strokeWidth="1.2" />
            </g>
            <g className="mfairy__arm mfairy__arm--r">
              <rect x="38.5" y="42" width="5" height="13" rx="2.5" fill="#4a4f57" stroke="#fffdfa" strokeWidth="1.6" />
              <circle cx="41" cy="55" r="2.4" fill="#ffe9de" stroke="#fffdfa" strokeWidth="1.2" />
            </g>

            {/* legs */}
            <g className="mfairy__leg mfairy__leg--l">
              <rect x="26" y="59" width="5.4" height="8" rx="2.4" fill="#ffe9de" stroke="#fffdfa" strokeWidth="1.4" />
              <rect x="25.6" y="65" width="6.2" height="10" rx="2.6" fill="#2f9d98" stroke="#fffdfa" strokeWidth="1.4" />
            </g>
            <g className="mfairy__leg mfairy__leg--r">
              <rect x="32.6" y="59" width="5.4" height="8" rx="2.4" fill="#ffe9de" stroke="#fffdfa" strokeWidth="1.4" />
              <rect x="32.2" y="65" width="6.2" height="10" rx="2.6" fill="#2f9d98" stroke="#fffdfa" strokeWidth="1.4" />
            </g>

            {/* torso + skirt */}
            <g className="mfairy__torso">
              <path d="M24,44 q8,-4 16,0 l-1,12 q-7,3 -14,0 Z" fill="url(#mfgTorso)" stroke="#fffdfa" strokeWidth="1.8" strokeLinejoin="round" />
              <path d="M25,45.5 q7,-3.4 14,0" fill="none" stroke="#39c5bb" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M32,46 l-2.6,3.4 2.6,6 2.6,-6 Z" fill="#39c5bb" stroke="#1f8a84" strokeWidth="0.6" />
              <path d="M22.5,55 h19 l2.5,7 q-12,4 -24,0 Z" fill="#2c3138" stroke="#fffdfa" strokeWidth="1.8" strokeLinejoin="round" />
              <path d="M27,56 l-1,5 M32,56.4 l0,5.4 M37,56 l1,5" stroke="rgba(57,197,187,0.55)" strokeWidth="1" />
            </g>

            {/* head — oversized, reference-photo proportions */}
            <g className="mfairy__head">
              <ellipse cx="32" cy="26" rx="21" ry="19" fill="#ffe9de" stroke="#fffdfa" strokeWidth="2.4" />
              {/* bangs: soft cap with scalloped fringe + side locks */}
              <path d="M11,28 C10,8 54,8 53,28 C50,21 47,25 43,19 C39,26 33,24 30,18 C26,26 19,22 16,27 C14,25 12,26 11,28 Z" fill="url(#mfgHair)" stroke="#fffdfa" strokeWidth="2" strokeLinejoin="round" />
              <path d="M12,26 q-2,9 1,15 q3,-2 3,-7" fill="url(#mfgHair)" stroke="#fffdfa" strokeWidth="1.6" strokeLinejoin="round" />
              <path d="M52,26 q2,9 -1,15 q-3,-2 -3,-7" fill="url(#mfgHair)" stroke="#fffdfa" strokeWidth="1.6" strokeLinejoin="round" />
              {/* ahoge */}
              <path d="M30,8 q2,-7 9,-5 q-5,0 -6,6" fill="none" stroke="#39c5bb" strokeWidth="2" strokeLinecap="round" />
              {/* pink hair buds */}
              <circle className="mfairy__bud" cx="10" cy="14" r="4.4" fill="#e76b7c" stroke="#fffdfa" strokeWidth="1.8" />
              <circle className="mfairy__bud" cx="54" cy="14" r="4.4" fill="#e76b7c" stroke="#fffdfa" strokeWidth="1.8" />
              <circle cx="8.8" cy="12.6" r="1.3" fill="#f8a9b4" />
              <circle cx="52.8" cy="12.6" r="1.3" fill="#f8a9b4" />

              {/* eyes — open: big teal-ringed anime eyes, pupils track cursor */}
              <g className="mfairy__eyes mfairy__eyes--open">
                <g className="mfairy__eye">
                  <ellipse cx="23.5" cy="29" rx="4.6" ry="5.6" fill="#eafffd" stroke="#2fa7a4" strokeWidth="2.2" />
                  <g className="mfairy__pupil">
                    <ellipse cx="23.5" cy="29.6" rx="2.6" ry="3.4" fill="url(#mfgIris)" />
                    <circle cx="22.4" cy="27.6" r="1.1" fill="#fff" />
                    <circle cx="24.6" cy="31" r="0.55" fill="#d9fffb" />
                  </g>
                  <path d="M19,24.6 q4,-2.8 9,-1" fill="none" stroke="#1f8a84" strokeWidth="1.4" strokeLinecap="round" />
                </g>
                <g className="mfairy__eye">
                  <ellipse cx="40.5" cy="29" rx="4.6" ry="5.6" fill="#eafffd" stroke="#2fa7a4" strokeWidth="2.2" />
                  <g className="mfairy__pupil">
                    <ellipse cx="40.5" cy="29.6" rx="2.6" ry="3.4" fill="url(#mfgIris)" />
                    <circle cx="39.4" cy="27.6" r="1.1" fill="#fff" />
                    <circle cx="41.6" cy="31" r="0.55" fill="#d9fffb" />
                  </g>
                  <path d="M36,24.6 q4,-2.8 9,-1" fill="none" stroke="#1f8a84" strokeWidth="1.4" strokeLinecap="round" />
                </g>
              </g>
              {/* eyes — happy ∩∩ (dance / hearts / cozy) */}
              <g className="mfairy__eyes mfairy__eyes--happy">
                <path d="M19.5,30 q4,-5 8,0" fill="none" stroke="#2fa7a4" strokeWidth="2.4" strokeLinecap="round" />
                <path d="M36.5,30 q4,-5 8,0" fill="none" stroke="#2fa7a4" strokeWidth="2.4" strokeLinecap="round" />
              </g>
              {/* eyes — closed (sleep) */}
              <g className="mfairy__eyes mfairy__eyes--closed">
                <path d="M19.5,29 q4,3.6 8,0" fill="none" stroke="#2fa7a4" strokeWidth="2.2" strokeLinecap="round" />
                <path d="M36.5,29 q4,3.6 8,0" fill="none" stroke="#2fa7a4" strokeWidth="2.2" strokeLinecap="round" />
              </g>
              {/* eyes — wink (left open, right squeezed shut ∩) */}
              <g className="mfairy__eyes mfairy__eyes--wink">
                <ellipse cx="23.5" cy="29" rx="4.6" ry="5.6" fill="#eafffd" stroke="#2fa7a4" strokeWidth="2.2" />
                <ellipse cx="23.5" cy="29.6" rx="2.6" ry="3.4" fill="url(#mfgIris)" />
                <circle cx="22.4" cy="27.6" r="1.1" fill="#fff" />
                <path d="M36.5,30 q4,-5 8,0" fill="none" stroke="#2fa7a4" strokeWidth="2.4" strokeLinecap="round" />
              </g>

              {/* blush */}
              <ellipse className="mfairy__blush" cx="17.5" cy="34.5" rx="3.1" ry="1.7" fill="#ffb1bb" opacity="0.85" />
              <ellipse className="mfairy__blush" cx="46.5" cy="34.5" rx="3.1" ry="1.7" fill="#ffb1bb" opacity="0.85" />

              {/* mouths — tiny pink blob / open singing oval / cozy smile */}
              <g className="mfairy__mouth mfairy__mouth--small">
                <ellipse cx="32" cy="36.6" rx="1.8" ry="1.4" fill="#f0879a" />
              </g>
              <g className="mfairy__mouth mfairy__mouth--open">
                <ellipse cx="32" cy="37" rx="2.6" ry="3" fill="#e8657f" stroke="#d8536e" strokeWidth="0.6" />
                <ellipse cx="32" cy="38.4" rx="1.5" ry="1.2" fill="#ff9fae" />
              </g>
              <g className="mfairy__mouth mfairy__mouth--smile">
                <path d="M28.5,36 q3.5,3.6 7,0" fill="none" stroke="#e8657f" strokeWidth="1.8" strokeLinecap="round" />
              </g>
            </g>
          </svg>
          <span className="mfairy__shadow" />
        </div>
      </div>
      <div ref={fxRef} className="mfairy-fx" />
    </>
  );
}
