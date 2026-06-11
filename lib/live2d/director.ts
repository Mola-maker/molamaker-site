'use client';

// Live2D director — drives the self-hosted live2d-widget (stevenjoezhang)
// from React. `public/live2d/waifu-tips.js` is patched to expose
// `window.__waifu = { manager, say }` once the widget boots, which gives us
// the Cubism 2 model instance: motions, expressions, speech bubble, and the
// engine's lip-sync parameter for mouth movement while the bot "speaks".
//
// Every call here is defensive: the widget loads lazily (and its models come
// from a CDN), so the model can be absent or mid-swap at any moment.

interface Cubism2Model {
  startRandomMotion(group: string, priority: number): void;
  startMotion(group: string, index: number, priority: number): void;
  setExpression(name: string): void;
  setRandomExpression(): void;
  modelSetting?: { getMotionNum(group: string): number };
  expressions?: unknown;
  /** Engine quirk: the mouth param is applied only while `lipSync == null`. */
  lipSync: boolean | null;
  lipSyncValue: number;
}

interface WaifuGlobal {
  manager?: { cubism2model?: { live2DMgr?: { model?: Cubism2Model | null } } };
  say?: (text: string, timeoutMs: number, priority: number, override?: boolean) => void;
}

declare global {
  interface Window { __waifu?: WaifuGlobal }
}

// Cubism 2 motion priority FORCE — pre-empts the idle loop.
const PRIORITY_FORCE = 3;

function model(): Cubism2Model | null {
  try {
    return window.__waifu?.manager?.cubism2model?.live2DMgr?.model ?? null;
  } catch {
    return null;
  }
}

/** True once the widget is booted AND a Cubism 2 model is on stage. */
export function live2dReady(): boolean {
  return !!model();
}

/** True if the mascot is actually visible (widget mounted, not hidden). */
export function live2dVisible(): boolean {
  const el = document.getElementById('waifu');
  return !!el && !el.classList.contains('waifu-hidden') && live2dReady();
}

/** Play a motion. Falls back across groups so every model reacts even when it
 *  only ships an idle group. */
export function playMotion(group = 'tap_body'): void {
  const m = model();
  if (!m) return;
  try {
    // The Miku model files its expressive motions under the literal group
    // "null" — it sits high in the chain so she actually performs.
    const groups = [group, 'tap_body', 'null', 'flick_head', 'shake', 'idle'];
    for (const g of groups) {
      const n = m.modelSetting?.getMotionNum(g) ?? 0;
      if (n > 0) {
        m.startMotion(g, Math.floor(Math.random() * n), PRIORITY_FORCE);
        return;
      }
    }
    m.startRandomMotion('idle', PRIORITY_FORCE);
  } catch { /* model mid-swap */ }
}

export function playExpression(name?: string): void {
  const m = model();
  if (!m) return;
  try {
    if (name) m.setExpression(name);
    else if (m.expressions && Object.keys(m.expressions).length) m.setRandomExpression();
  } catch { /* model mid-swap */ }
}

/** Speech bubble on the mascot (the widget's own tips UI). */
export function mascotSay(text: string, ms = 4000, priority = 9): void {
  try {
    window.__waifu?.say?.(text, ms, priority, true);
  } catch { /* widget not ready */ }
}

// ── Lip-sync ─────────────────────────────────────────────────────
// While "talking", oscillate PARAM_MOUTH_OPEN_Y with layered sine noise so the
// mouth flutters like real speech instead of a metronome.

let lipRaf = 0;
let lipStop = 0;

export function startLipSync(): void {
  lipStop = 0;
  if (lipRaf) return;
  const tick = (now: number) => {
    const m = model();
    if (m) {
      try {
        m.lipSync = null; // enable the engine's mouth-param path
        const t = now / 1000;
        const v =
          0.5 +
          0.5 * Math.sin(t * 11) * Math.sin(t * 3.7) +
          0.18 * Math.sin(t * 23);
        m.lipSyncValue = Math.max(0, Math.min(1, v));
      } catch { /* model mid-swap */ }
    }
    if (lipStop && now > lipStop) {
      if (m) {
        try { m.lipSyncValue = 0; m.lipSync = false; } catch { /* ignore */ }
      }
      lipRaf = 0;
      return;
    }
    lipRaf = requestAnimationFrame(tick);
  };
  lipRaf = requestAnimationFrame(tick);
}

export function stopLipSync(): void {
  // Let the mouth settle shut over a beat rather than snapping.
  lipStop = performance.now() + 180;
}

// ── Widget summoning ─────────────────────────────────────────────

/** Make sure the Live2D mascot is on stage: asks Live2DChat to load/show the
 *  widget, then resolves once a model is actually driving the canvas (or the
 *  timeout passes — CDN model downloads can fail, callers must cope). */
export function summonLive2d(timeoutMs = 7000): Promise<boolean> {
  if (live2dVisible()) return Promise.resolve(true);
  try {
    const el = document.getElementById('waifu');
    if (!el || el.classList.contains('waifu-hidden')) {
      window.dispatchEvent(new CustomEvent('mola:live2d-toggle'));
    }
  } catch { /* ignore */ }
  return new Promise((resolve) => {
    const t0 = performance.now();
    const poll = () => {
      if (live2dVisible()) return resolve(true);
      if (performance.now() - t0 > timeoutMs) return resolve(false);
      setTimeout(poll, 250);
    };
    poll();
  });
}
