# Miku Scroll-Story — 7th Variant (`v-story`)

**Date:** 2026-06-08
**Author:** Planner (OMC)
**Status:** Draft — ready for execution
**Goal:** Add a 7th redesign variant `v-story`: a full-page, scroll-driven narrative where a cute anime Miku character physically travels through the page, hides behind cards, peeks from edges, reacts to hover, and brings text to life. Inspiration: dell.com XPS storytelling, Apple AirPods reveal pages.

---

## 0. Grounding — what already exists (read this first)

Before writing a single line, the executor must internalize these existing facts. The codebase **already has a working scroll-animation stack**. Do not reinvent it.

### Already installed (verified in `package.json`)
- `gsap ^3.15.0`, `@gsap/react ^2.1.2`
- `lenis` — smooth-scroll lib, **already wired to GSAP ticker** in `components/journey/scroll-provider.tsx`
- `next ^16.2.6` (App Router), `react ^19.2.1`, `next-intl ^4.13.0`, `typescript ^5.6.3`
- `framer-motion` is **NOT** installed — do not introduce it.

### Reusable patterns (copy, don't reinvent)
- **GSAP plugin registration** (`components/journey/scroll-provider.tsx:8-10`):
  ```ts
  import gsap from 'gsap';
  import { ScrollTrigger } from 'gsap/ScrollTrigger';
  if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger);
  ```
- **Lenis ↔ GSAP ticker sync** (`scroll-provider.tsx:30-75`): Lenis raf feeds `gsap.ticker`, `ScrollTrigger.update()` on Lenis scroll, `gsap.ticker.lagSmoothing(0)`. Touch + reduced-motion fall back to native scroll. **`v-story` should opt into this same provider**, not build its own scroller.
- **Context + cleanup** (`components/hero-animation.tsx:24-57`): `const ctx = gsap.context(() => { ... }, scopeRef); return () => ctx.revert();` — the canonical mount/unmount lifecycle. Use `gsap.matchMedia()` on top of this for responsive setup.
- **Reduced-motion guard** (`hero-animation.tsx:21-22`): `if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;`

### Variant wiring (3 edit sites in `components/redesign/root.tsx`)
1. `type Variant` union — line 35.
2. `valid` array inside the `?variant=` URL hint effect — line 98.
3. Render switch (line ~191-199), `variantLabel()` map (line 72), `TweakRadio` options (line ~233-240).

### CSS import order (`app/[locale]/page.tsx:8-18`)
Files load `01-base` → `11-v-notebook`. Next free number is **`12-`** (matches spec). Per-variant CSS loads last.

### Assets (`public/redesign/`, served via `assetUrl()` from `@/lib/asset-url`)
`miku-dance.gif`, `miku-orbit.gif`, `miku-bg-2.gif`, `miku-bg-3.gif`, `miku-bg-orbit.gif`, `miku-preview.jpg`, `miku-redial-cover.jpg`. **Always wrap with `assetUrl('/redesign/...')`** — never hardcode `/redesign/...` (breaks CDN in prod).

### Content data (`components/redesign/data.ts`)
`molaData` exports: `posts` (writing), `repos` (projects/work), `guestbook`, `nowPlaying`, plus `i18n[locale]` with `hero.title/lead`, section labels (`writing`, `work`, `open`, `guests`, `now`). Chapters map to: **hero · about · writing · projects · guestbook · now**.

### Design tokens (`app/redesign-styles/01-base.css`)
`--accent (#C96442)`, `--ink`, `--bg`, `--bg-elev`, `--rule`, `--ease-out-expo`, `--ease-out-quart`, `--font-display`, `--font-mono`, `--t-fast/base/slow`. `html { scroll-behavior: smooth }` is set globally (line 48) — Lenis overrides it when active.

### Important global constraints
- `app/[locale]/page.tsx` has `export const dynamic = 'force-dynamic'`.
- All variant components are `'use client'`.
- `root.tsx` does `window.scrollTo({ top: 0 })` on variant change (line 138) — `v-story` must `ScrollTrigger.refresh()` after this or pins land at wrong offsets.
- PowerShell: directory names `[locale]` need `-LiteralPath` (see project CLAUDE.md). Use the Bash tool with forward slashes to avoid this.

---

## File Structure

```
NEW files:
  components/redesign/v-story.tsx                ← main variant component (chapters + provider opt-in)
  components/redesign/miku-scroll-character.tsx  ← Miku sprite + state machine + interaction
  components/redesign/word-canvas.tsx            ← floating-keyword text effect (Day 5)
  lib/scroll/use-scroll-story.ts                 ← GSAP/ScrollTrigger lifecycle hook (matchMedia + refresh + revert)
  lib/scroll/miku-path.ts                        ← waypoint data + TS types (single source of truth for movement)
  app/redesign-styles/12-v-story.css             ← variant CSS

MODIFY files:
  components/redesign/root.tsx                   ← register v-story (type, valid[], switch, label, tweak radio)
  app/[locale]/page.tsx                          ← add `import '../redesign-styles/12-v-story.css';`
  app/redesign-styles/01-base.css                ← add --story-* CSS vars (z-index scale, sprite size)
```

---

### Day 1 — Foundation: Scroll Layer Architecture

**Goal:** A registered `v-story` variant that renders 6 full-viewport chapter sections with native (Lenis-assisted) scroll, a fixed Miku overlay layer that does nothing yet but is positioned and present, and a reusable `useScrollStory` hook that owns the GSAP lifecycle. End state: switch to "Story" in the rail, scroll through 6 chapters, see Miku pinned in a corner. No movement yet — just plumbing that does not leak listeners or break the other 6 variants.

**Files:** `lib/scroll/use-scroll-story.ts`, `lib/scroll/miku-path.ts`, `components/redesign/v-story.tsx`, `components/redesign/miku-scroll-character.tsx`, `app/redesign-styles/12-v-story.css`, `components/redesign/root.tsx`, `app/[locale]/page.tsx`, `app/redesign-styles/01-base.css`.

**Steps:**

1. **Add CSS vars** to `01-base.css` `:root`:
   ```css
   --story-miku-size: 220px;
   --story-z-bg: 1;        /* backdrop */
   --story-z-card-back: 2; /* cards Miku hides BEHIND */
   --story-z-miku: 3;      /* Miku sprite layer */
   --story-z-card-front: 4;/* cards in front of Miku for peek strips */
   --story-z-ui: 50;       /* speech bubbles, easter-egg layer */
   ```

2. **Create `lib/scroll/miku-path.ts`** — types + empty-ish waypoint table (data filled Days 2-4):
   ```ts
   export type MikuState = 'idle' | 'walking' | 'running' | 'hiding' | 'peeking' | 'waving' | 'typing';
   export type Chapter = 'hero' | 'about' | 'writing' | 'projects' | 'guestbook' | 'now';
   export type Waypoint = {
     chapter: Chapter;
     x: string;          // e.g. '72vw'
     y: string;          // e.g. '60vh'
     state: MikuState;
     scrubStart: number; // 0..1 progress within the section's ScrollTrigger
     scrubEnd: number;
     flipX?: boolean;    // face left when true
   };
   export const MIKU_PATH: Waypoint[] = [
     { chapter: 'hero', x: '90vw', y: '50vh', state: 'waving', scrubStart: 0, scrubEnd: 0.15 },
     // remaining waypoints added Days 3-4
   ];
   export const SPRITE: Record<MikuState, string> = {
     idle: '/redesign/miku-orbit.gif',
     walking: '/redesign/miku-dance.gif',
     running: '/redesign/miku-dance.gif',
     hiding: '/redesign/miku-orbit.gif',
     peeking: '/redesign/miku-orbit.gif',
     waving: '/redesign/miku-dance.gif',
     typing: '/redesign/miku-dance.gif',
   };
   ```

3. **Create `lib/scroll/use-scroll-story.ts`** — the lifecycle hook. Owns `gsap.matchMedia()`, registration, refresh, and revert:
   ```ts
   'use client';
   import { useEffect, type RefObject } from 'react';
   import gsap from 'gsap';
   import { ScrollTrigger } from 'gsap/ScrollTrigger';
   if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger);

   type Setup = (mm: gsap.MatchMedia, ctx: gsap.Context) => void;
   export function useScrollStory(scopeRef: RefObject<HTMLElement | null>, setup: Setup, deps: unknown[] = []) {
     useEffect(() => {
       if (!scopeRef.current) return;
       const ctx = gsap.context(() => {
         const mm = gsap.matchMedia();
         setup(mm, ctx);
       }, scopeRef);
       // root.tsx scrolls to top on variant change; pins need a refresh after layout settles
       const id = window.setTimeout(() => ScrollTrigger.refresh(), 60);
       return () => { window.clearTimeout(id); ctx.revert(); };
       // eslint-disable-next-line react-hooks/exhaustive-deps
     }, deps);
   }
   ```
   Note: `ctx.revert()` reverts every tween/ScrollTrigger created inside, including the matchMedia branches — clean teardown when the visitor leaves `v-story`.

4. **Create `components/redesign/miku-scroll-character.tsx`** — the sprite layer + imperative handle (state machine stub for Day 1, filled Days 2-6):
   ```tsx
   'use client';
   import { forwardRef, useImperativeHandle, useRef } from 'react';
   import Image from 'next/image';
   import { assetUrl } from '@/lib/asset-url';
   import { SPRITE, type MikuState } from '@/lib/scroll/miku-path';

   export type MikuHandle = {
     el: () => HTMLDivElement | null;
     setState: (s: MikuState) => void;
   };
   export const MikuScrollCharacter = forwardRef<MikuHandle>(function MikuScrollCharacter(_props, ref) {
     const wrap = useRef<HTMLDivElement>(null);
     const imgState = useRef<MikuState>('waving');
     useImperativeHandle(ref, () => ({
       el: () => wrap.current,
       setState: (s) => {
         if (s === imgState.current || !wrap.current) return;
         imgState.current = s;
         const img = wrap.current.querySelector('img');
         if (img) (img as HTMLImageElement).src = assetUrl(SPRITE[s]);
         wrap.current.dataset.state = s;
       },
     }), []);
     return (
       <div ref={wrap} className="story-miku" data-state="waving" aria-hidden="true">
         <img src={assetUrl(SPRITE.waving)} alt="" draggable={false} />
       </div>
     );
   });
   ```
   (Use a plain `<img>`, not `next/image`, for the sprite — GIF frames + GSAP `src` swap are simpler without the optimizer; remove the `next/image` import.)

5. **Create `components/redesign/v-story.tsx`** — variant shell. Renders 6 `<section data-scroll-chapter>` and the Miku overlay. Day 1 only mounts the hook; the `setup` body stays empty:
   ```tsx
   'use client';
   import { useRef } from 'react';
   import type { I18nBlock, Locale, Post, Guest, Repo } from './data';
   import { molaData } from './data';
   import { MikuScrollCharacter, type MikuHandle } from './miku-scroll-character';
   import { useScrollStory } from '@/lib/scroll/use-scroll-story';

   type Props = { t: I18nBlock; locale: Locale; posts?: Post[]; guestbook?: Guest[]; repos?: Repo[] };

   export function VStory({ t, locale, posts, guestbook, repos }: Props) {
     const d = {
       ...molaData,
       posts: posts && posts.length ? posts : molaData.posts,
       guestbook: guestbook ?? molaData.guestbook,
       repos: repos && repos.length ? repos : molaData.repos,
     };
     const scope = useRef<HTMLDivElement>(null);
     const miku = useRef<MikuHandle>(null);

     useScrollStory(scope, () => { /* Day 2+ */ }, [locale]);

     return (
       <div ref={scope} className="v-story">
         <div className="story-stage">
           <MikuScrollCharacter ref={miku} />
         </div>
         <section className="story-chapter" data-scroll-chapter="hero">{/* Day 3 */}</section>
         <section className="story-chapter" data-scroll-chapter="about">{/* Day 3 */}</section>
         <section className="story-chapter" data-scroll-chapter="writing">{/* Day 4/5 */}</section>
         <section className="story-chapter" data-scroll-chapter="projects">{/* Day 4 */}</section>
         <section className="story-chapter" data-scroll-chapter="guestbook">{/* Day 4 */}</section>
         <section className="story-chapter" data-scroll-chapter="now">{/* Day 5/6 */}</section>
       </div>
     );
   }
   ```
   Note: `d` is the same fallback pattern as `v-atlas.tsx:27-32`. Match it exactly.

6. **Create `app/redesign-styles/12-v-story.css`** — layout shell:
   ```css
   .v-story { position: relative; }
   .story-chapter { min-height: 100vh; position: relative; padding: 10vh 6vw; }
   .story-stage {           /* fixed overlay that hosts Miku above content */
     position: fixed; inset: 0; pointer-events: none; z-index: var(--story-z-miku);
   }
   .story-miku {
     position: absolute; width: var(--story-miku-size); will-change: transform;
     transform: translate(-50%, -50%); pointer-events: auto;
   }
   .story-miku img { width: 100%; height: auto; }
   ```

7. **Register in `root.tsx`** (4 edits):
   - Line 35: `... | 'notebook' | 'story';`
   - Line 98: add `'story'` to the `valid` array.
   - Line 72 `variantLabel`: add `story: 'no. 07'`.
   - Render switch: `{variant === 'story' && <VStory t={i18n} locale={locale} posts={livePosts ?? undefined} guestbook={liveGuests ?? undefined} repos={liveRepos ?? undefined} />}`
   - `TweakRadio` options: add `{ value: 'story', label: 'Story' }`.
   - Add `import { VStory } from './v-story';` near the other variant imports.

8. **Register CSS** in `app/[locale]/page.tsx` after line 18: `import '../redesign-styles/12-v-story.css';`

9. **Verify:** `npx tsc --noEmit`; manually switch to Story, scroll 6 chapters, confirm Miku stays pinned, then switch back to Terminal and confirm `ScrollTrigger.getAll().length === 0` in console (no leaked triggers).

**Optional Directions (Day 1):**
- **A.** CSS scroll-driven animations (`animation-timeline: scroll()`) — zero JS, but cannot express the 7 character states, no callbacks, weak Safari support.
- **B. GSAP ScrollTrigger + existing Lenis provider (recommended)** — full scrub/pin/callback control, already in the codebase, proven cleanup pattern. Lowest risk because we reuse `scroll-provider.tsx`.
- **C.** Framer Motion `useScroll`/`useTransform` — would add a new dependency the project deliberately avoids; heavier for imperative sprite control.

---

### Day 2 — Scroll Canvas: Character Movement

**Goal:** Miku physically moves. Define the full waypoint table, drive her position with a scrubbed GSAP timeline tied to each section, pin the hero, swap sprites by direction, and implement the peek (`clip-path` + z-index) primitive. End state: scrolling moves Miku smoothly along the path; she walks, turns, and peeks behind a placeholder card.

**Files:** `lib/scroll/miku-path.ts`, `components/redesign/v-story.tsx`, `components/redesign/miku-scroll-character.tsx`, `app/redesign-styles/12-v-story.css`.

**Steps:**

1. **Fill `MIKU_PATH`** with one or two waypoints per chapter (full set tuned Days 3-4). Each entry feeds a tween.

2. **Build the scrubbed driver** inside `v-story.tsx`'s `useScrollStory` setup. For each chapter section, read its waypoint(s) and animate the Miku element:
   ```ts
   mm.add('(min-width: 768px)', () => {
     const mikuEl = miku.current?.el();
     if (!mikuEl) return;
     gsap.set(mikuEl, { xPercent: -50, yPercent: -50 });
     document.querySelectorAll<HTMLElement>('[data-scroll-chapter]').forEach((section) => {
       const wp = MIKU_PATH.filter((w) => w.chapter === section.dataset.scrollChapter);
       wp.forEach((point) => {
         gsap.to(mikuEl, {
           left: point.x, top: point.y,
           scaleX: point.flipX ? -1 : 1,
           ease: 'none',
           scrollTrigger: {
             trigger: section, scrub: 1.5,
             start: `top+=${point.scrubStart * 100}% center`,
             end: `top+=${point.scrubEnd * 100}% center`,
             onUpdate: (self) => miku.current?.setState(self.direction === 1 ? point.state : 'running'),
           },
         });
       });
     });
   });
   ```
   Use `left`/`top` (with `vw`/`vh` strings) for absolute positioning, `scaleX` for facing. `scrub: 1.5` gives the dell.com lag-behind feel.

3. **Pin the hero** so Miku has 200vh to complete her entrance:
   ```ts
   ScrollTrigger.create({
     trigger: '[data-scroll-chapter="hero"]',
     start: 'top top', end: '+=200%', pin: true, pinSpacing: true,
   });
   ```
   `pinSpacing: true` preserves document flow so subsequent chapters do not jump.

4. **Sprite swap by direction** — `ScrollTrigger.getVelocity()` (or `self.direction`) decides facing. Negative velocity → `setState('running')` and `flipX`. Centralize in the `onUpdate` above so there is one swap path.

5. **Peek primitive** — add to `12-v-story.css`:
   ```css
   .story-miku[data-peek="1"] { clip-path: inset(0 0 0 100%); transition: clip-path var(--t-base) var(--ease-out-expo); }
   .story-miku[data-peek="0"] { clip-path: inset(0 0 0 0); }
   ```
   Toggle `dataset.peek` from a `ScrollTrigger` `onEnter`/`onLeaveBack`. Z-index juggling: Miku layer at `--story-z-miku (3)`; the card she hides behind gets `--story-z-card-front (4)` so only the peek strip shows.

6. **Velocity safety:** clamp `getVelocity()` reads — divide by a constant and `gsap.utils.clamp(-1, 1, v)` before using as an animation input so a fast flick does not throw Miku off-screen.

7. **Verify:** scroll up and down; Miku flips facing, walks between waypoints, peek strip appears/disappears, no console errors, hero pins for ~2 screens then releases cleanly.

**Optional Directions (Day 2):**
- **A. Sprite-only with GSAP position (recommended)** — reuses the existing GIFs, no canvas, cheapest to ship, easy to debug in DevTools.
- **B.** Canvas 2D + `requestAnimationFrame` — smoothest possible motion with velocity trails, but a large rewrite, harder to sync with ScrollTrigger, and GIF→canvas frame extraction is painful.
- **C.** CSS `offset-path` / motion-path — elegant for a fixed curve, but waypoints become an SVG-path-editing problem and per-section state changes get awkward.

---

### Day 3 — Hero + About Chapters

**Goal:** Two finished chapters. Hero: Miku enters from the right edge waving, walks left as hero text reveals word-by-word, pinned for 300vh. About: Miku "teleports" around the profile card and nods as skill bars fill.

**Files:** `components/redesign/v-story.tsx`, `lib/scroll/miku-path.ts`, `app/redesign-styles/12-v-story.css`. (Optionally a tiny `splitWords` util inline in `v-story.tsx`.)

**Steps:**

1. **Hero content** — render heading + lead from `t.hero` / `d.i18n[locale].lead`. Split the heading into per-word spans:
   ```tsx
   const heroWords = (t.hero?.title ?? 'mola maker').split(' ');
   // <h1 className="story-hero-title">{heroWords.map((w,i)=>(<span key={i} className="hero-word">{w} </span>))}</h1>
   ```

2. **Word reveal on scroll** (inside setup, hero branch):
   ```ts
   gsap.from('.hero-word', {
     y: 40, opacity: 0, stagger: 0.06, ease: 'power3.out',
     scrollTrigger: { trigger: '[data-scroll-chapter="hero"]', start: 'top center', toggleActions: 'play none none reverse' },
   });
   ```
   (Mirror the stagger style already in `hero-animation.tsx:42-47`.)

3. **Hero pin to 300vh** — override Day 2's hero pin `end` to `+=300%`. Update hero waypoints in `miku-path.ts`: start `{ x:'90vw', y:'50vh', state:'waving', scrubStart:0, scrubEnd:0.2 }` → walk `{ x:'30vw', y:'55vh', state:'walking', flipX:true, scrubStart:0.2, scrubEnd:0.8 }`.

4. **About chapter** — render the profile (`d.i18n[locale]` about copy) + a skills list. Skill rows:
   ```html
   <div class="skill-row"><span>CUDA</span><i class="skill-bar" style="--pct:.82"></i></div>
   ```

5. **Skill-bar fill** via ScrollTrigger `onEnter` (CSS width transition driven by a class):
   ```ts
   ScrollTrigger.batch('.skill-bar', {
     start: 'top 85%',
     onEnter: (els) => { els.forEach(el => el.classList.add('is-filled')); miku.current?.setState('idle'); },
   });
   ```
   ```css
   .skill-bar { display:block; height:6px; background:var(--rule); }
   .skill-bar::after { content:''; display:block; height:100%; width:0; background:var(--accent); transition: width var(--t-slow) var(--ease-out-expo); }
   .skill-bar.is-filled::after { width: calc(var(--pct) * 100%); }
   ```

6. **Teleport effect** — between about sub-zones, scale Miku down then up to fake a jump:
   ```ts
   gsap.timeline({ scrollTrigger: { trigger: '[data-scroll-chapter="about"]', scrub: true, start:'top center', end:'center center' } })
     .to(mikuEl, { scale: 0.2, opacity: 0, duration: 0.4 })
     .set(mikuEl, { left: '64vw', top: '60vh' })
     .to(mikuEl, { scale: 1, opacity: 1, duration: 0.4 });
   ```
   Then `setState('idle')` (cross-legged `miku-orbit.gif`).

7. **Verify:** hero words stagger in on entry and reverse on scroll-up; Miku completes her walk within the pin; skill bars fill once when scrolled into view; teleport reads as a clean jump, not a glide.

**Optional Directions (Day 3):**
- **A. Word-by-word GSAP `stagger` (recommended)** — already the house pattern (`hero-animation.tsx`), scrub-reversible, accessible (real text in DOM).
- **B.** CSS `animation-timeline: view()` per word — zero JS, but reduced-motion handling and Safari support are weaker, and it cannot coordinate with Miku's position.
- **C.** Typed.js / typewriter for the tagline as Miku "types" — cute, but adds a dep and fights screen readers; reserve as a Day-6 easter-egg flourish if desired.

---

### Day 4 — Projects + Guestbook: Hide & Seek

**Goal:** Interactivity. Projects: a card grid where Miku peeks from behind cards and leans toward the hovered one. Guestbook: Miku "reads" — her head bobs as each entry enters; she turns around when scrolling up.

**Files:** `components/redesign/v-story.tsx`, `components/redesign/miku-scroll-character.tsx`, `lib/scroll/miku-path.ts`, `app/redesign-styles/12-v-story.css`.

**Steps:**

1. **Projects grid** from `d.repos` — cards with `data-scroll-chapter="projects"` parent and `.story-card` children at `z-index: var(--story-z-card-front)`.

2. **Peek per card** — as each card scrolls in, set Miku's `left/top` near that card's edge and toggle the Day-2 peek `clip-path`. Use `ScrollTrigger.batch('.story-card', { onEnter, onLeaveBack })`.

3. **Cursor-relative lean** — add to `MikuHandle` a `lean(angleDeg: number)` method; on card hover, compute angle toward the card center and tween rotation:
   ```ts
   // in miku-scroll-character.tsx imperative handle
   lean: (deg: number) => { if (wrap.current) gsap.to(wrap.current, { rotation: deg, duration: 0.4, ease: 'power2.out' }); }
   ```
   ```tsx
   // in v-story.tsx, per card
   onMouseMove={(e) => {
     const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
     const m = miku.current?.el()?.getBoundingClientRect();
     if (!m) return;
     const angle = gsap.utils.clamp(-15, 15, ((r.left + r.width/2) - (m.left + m.width/2)) / 20);
     miku.current?.lean(angle);
   }}
   onMouseLeave={() => miku.current?.lean(0)}
   ```

4. **Guestbook chapter** from `d.guestbook` — entries as `.guestbook-entry`. Head bob on enter:
   ```ts
   ScrollTrigger.batch('.guestbook-entry', {
     start: 'top 80%',
     onEnter: () => { const el = miku.current?.el(); if (el) gsap.to(el, { y: '-=14', yoyo: true, repeat: 1, duration: 0.18 }); },
   });
   ```
   (Bob via a relative `y` tween layered on top of the scrub position — use a nested wrapper or `gsap.quickTo` so it does not fight the position tween. Prefer bobbing an **inner** `.story-miku img` element, leaving the outer wrapper for path position.)

5. **Turn-around on scroll-up** — global direction watcher:
   ```ts
   ScrollTrigger.create({
     onUpdate: (self) => { const el = miku.current?.el(); if (el) gsap.to(el, { scaleX: self.direction === -1 ? -1 : 1, duration: 0.2 }); },
   });
   ```

6. **Z-index discipline** — confirm the layering contract holds: backdrop(1) < card-back(2) < Miku(3) < card-front(4). The peek strip = card-front overlapping Miku. Document this in a comment block in `12-v-story.css`.

7. **Verify:** hovering a project card tilts Miku toward it and resets on leave; guestbook entries each trigger a single bob; scrolling up flips her; cards correctly occlude/reveal the peek strip.

**Optional Directions (Day 4):**
- **A. Per-card hover + cursor-relative lean (recommended)** — direct, performant (`gsap.to` on one element), reads as "she's curious about what you point at."
- **B.** Matter.js physics impulses on click — high delight ceiling but a big dependency + tuning cost for a portfolio.
- **C.** Pointer-following Miku (always faces cursor) — fun but competes with the scroll-driven path; reserve a lighter version for idle moments.

---

### Day 5 — Word Canvas + Text Effects

**Goal:** Living text. A keyword field ("portfolio", "miku", "blog", "code") whose words scatter when Miku "runs through" them. Ship the simplest robust version first (DOM spans), keep canvas as an upgrade.

**Files:** `components/redesign/word-canvas.tsx`, `components/redesign/v-story.tsx`, `lib/scroll/use-scroll-story.ts` (export a tiny overlap helper), `app/redesign-styles/12-v-story.css`.

**Steps:**

1. **Create `word-canvas.tsx`** — render keywords as positioned spans, each split per character for scatter:
   ```tsx
   'use client';
   const WORDS = ['portfolio', 'miku', 'blog', 'code', 'agents', 'kernels'];
   export function WordCanvas() {
     return (
       <div className="word-field" aria-hidden="true">
         {WORDS.map((w, wi) => (
           <span key={wi} className="word" style={{ ['--col' as string]: wi }}>
             {[...w].map((c, ci) => <span key={ci} className="word-char">{c}</span>)}
           </span>
         ))}
       </div>
     );
   }
   ```
   Place `<WordCanvas />` inside the `writing` (or `now`) chapter.

2. **Idle orbit** — gentle float via CSS keyframe (reuse `backdropFloat` family in `02-animations.css` or add `wordOrbit`).

3. **Scatter when Miku overlaps** — in `v-story.tsx` setup, watch overlap between Miku's rect and the word-field rect using a `ScrollTrigger` `onUpdate` throttled with `gsap.ticker` or a simple bounding-box test; when overlapping, scatter:
   ```ts
   gsap.to('.word-char', {
     x: () => gsap.utils.random(-160, 160),
     y: () => gsap.utils.random(-120, 120),
     opacity: 0, rotation: () => gsap.utils.random(-90, 90),
     stagger: 0.02, ease: 'power2.out',
     duration: 0.5,
   });
   ```
   Scatter magnitude scales with `gsap.utils.clamp(0.3, 2, Math.abs(ScrollTrigger.getVelocity('[chapter]')) / 1000)`. Reverse (`gsap.to(... {x:0,y:0,opacity:1,rotation:0})`) when Miku leaves the zone.

4. **Overlap helper** — add `export function rectsOverlap(a: DOMRect, b: DOMRect)` to a small util (or inline). Guard against running the scatter tween every frame: track a `scattered` boolean and only fire on transition.

5. **Verify:** scrolling Miku across the word field scatters letters proportional to speed and they reassemble after she passes; no per-frame tween thrash (check Performance panel for steady FPS).

**Optional Directions (Day 5):**
- **A. HTML span scatter with GSAP (recommended)** — easiest, accessible-ish (`aria-hidden` decorative), no canvas lifecycle, integrates with existing token CSS.
- **B.** Canvas particle system — biggest visual payoff (true physics, velocity trails) but its own RAF loop, retina scaling, and teardown to manage; do only if Day 5 finishes early.
- **C.** SVG `textPath` letters following Miku's walk path — beautiful but couples text to the motion-path geometry; brittle if waypoints change.

---

### Day 6 — Easter Eggs + Interactive Layer

**Goal:** Personality. Click/double-click reactions, idle yawn, goodbye wave at the bottom, and a Konami-code confetti finale.

**Files:** `components/redesign/miku-scroll-character.tsx`, `components/redesign/v-story.tsx`, `app/redesign-styles/12-v-story.css`.

**Steps:**

1. **Click → bounce + speech bubble.** Add `onClick` to `.story-miku` (it already has `pointer-events:auto`):
   ```ts
   gsap.to(el, { y: '-=40', yoyo: true, repeat: 1, duration: 0.3, ease: 'bounce.out' });
   ```
   Speech bubble = a `.story-bubble` element at `--story-z-ui`, positioned via Miku's rect, text from a `QUIPS: string[]` random pick, auto-hide after 2.2s.

2. **Double-click → pirouette.** Track click timing or use `onDoubleClick`:
   ```ts
   miku.setState('idle'); // miku-orbit.gif
   gsap.to(el, { rotation: '+=360', duration: 0.8, ease: 'power2.inOut', onComplete: () => gsap.set(el, { rotation: 0 }) });
   ```

3. **Idle yawn (8s timeout).** A debounced timer reset on `scroll`/`pointermove`; on fire, add `.is-yawning` (CSS scale/skew keyframe) then `setState('idle')`. Clear on any input. Register/cleanup the listeners inside `useScrollStory`'s `ctx` so they revert with the variant.

4. **Goodbye at bottom.** A `ScrollTrigger` at the `now`/footer end:
   ```ts
   ScrollTrigger.create({
     trigger: '[data-scroll-chapter="now"]', start: 'bottom bottom',
     onEnter: () => { miku.current?.setState('waving'); gsap.to(el, { x: '+=60vw', opacity: 0, duration: 1.2, ease: 'power2.in' }); },
     onLeaveBack: () => gsap.to(el, { x: 0, opacity: 1, duration: 0.6 }),
   });
   ```

5. **Konami code** `↑↑↓↓←→←→BA` → confetti finale. Buffer keydowns, match sequence, then a fullscreen `.story-confetti` burst (GSAP-tweened spans or a one-shot canvas) + Miku centered doing the pirouette. Listener added/removed in `ctx`.

6. **Single source for interactions:** put bounce/pirouette/yawn/wave as methods on `MikuHandle` so `v-story.tsx` only wires events → handle calls (keeps the component declarative).

7. **Verify:** click bounces + shows a quip; double-click pirouettes without leaving a residual rotation; idle 8s yawns and resets on input; reaching the bottom waves goodbye and scrolling back restores her; Konami fires once and cleans up.

**Optional Directions (Day 6):**
- **A. CSS speech bubbles (recommended)** — lightweight tooltip anchored to Miku, themeable with `--accent`/`--bg-elev`, no new deps.
- **B.** RPG-style dialog box with typed text — more characterful, more code (typing engine, queue); good stretch goal.
- **C.** Web Audio SFX on interaction — delightful but **off by default behind a toggle** (autoplay policy + taste); only if a mute control ships with it.

---

### Day 7 — Mobile + `prefers-reduced-motion` + Quality Gate

**Goal:** Ship-ready. Graceful mobile fallback, full reduced-motion support, performance hardening, and a green quality gate with the other 6 variants untouched.

**Files:** `lib/scroll/use-scroll-story.ts`, `components/redesign/v-story.tsx`, `components/redesign/miku-scroll-character.tsx`, `app/redesign-styles/12-v-story.css`.

**Steps:**

1. **Mobile branch via `matchMedia`.** All ScrollTrigger path/pin setup lives in the `(min-width: 768px)` branch. Add a separate `mm.add('(max-width: 767px)', () => { ... })` branch that:
   - Does **no pinning** (pins break momentum scroll on iOS).
   - Uses `IntersectionObserver` (or `ScrollTrigger.batch` without pin) so Miku appears at the top of each section, plays a quick entrance, then fades — anchored, not path-driven.
   ```ts
   mm.add('(max-width: 767px)', () => {
     const io = new IntersectionObserver((entries) => entries.forEach(e => {
       if (e.isIntersecting) gsap.fromTo(miku.current!.el(), { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5 });
     }), { threshold: 0.3 });
     document.querySelectorAll('[data-scroll-chapter]').forEach(s => io.observe(s));
     return () => io.disconnect();
   });
   ```

2. **Reduced-motion branch.** `mm.add('(prefers-reduced-motion: reduce)', () => { ... })`: skip all tweens, set one static Miku pose per section via plain `setState`, no transforms. Also gate `WordCanvas` scatter behind motion-allowed. (The Lenis provider already disables smooth scroll for reduced-motion/touch — confirm `v-story` does not force-enable it.)

3. **Performance.**
   - `will-change: transform` is already on `.story-miku` (Day 1) — keep it scoped, do not blanket it.
   - Lazy-load decorative GIFs: `loading="lazy"` on background images + only swap sprite `src` when a state actually changes (already guarded in `setState`).
   - `ScrollTrigger.normalizeScroll(true)` for iOS rubber-banding (guard: only on touch; can conflict with Lenis — if Lenis is active on a device, skip normalizeScroll there).
   - Verify no layout thrash: position writes go through GSAP (transforms/left-top batched), reads (`getBoundingClientRect`) are throttled.

4. **Variant-switch refresh.** Confirm `ScrollTrigger.refresh()` fires after `root.tsx`'s `window.scrollTo(top:0)` on entering `v-story` (the 60ms timeout in `useScrollStory` covers it) and that `ctx.revert()` clears everything on leaving.

5. **Final gates (run all):**
   ```bash
   npx tsc --noEmit
   npm run lint
   npm run build
   ```
   Then smoke-test: each of the 6 existing variants (terminal, magazine, atlas, stream, workplace, notebook) renders and scrolls **unchanged**; `ScrollTrigger.getAll().length === 0` after switching away from Story; `npm audit` clean per project convention.

6. **Verify:** on a <768px viewport there is no pin and scroll is smooth; with reduced-motion on, Miku is static and nothing animates; build passes; other variants are byte-for-byte behaviorally unchanged.

**Optional Directions (Day 7):**
- **A. Simplified mobile with section-anchored Miku (recommended)** — keeps the character present and on-brand without the pin fragility; one IntersectionObserver, easy to reason about.
- **B.** Remove `v-story` from mobile entirely (fall back to a standard variant) — safest but loses the headline feature on phones, where much traffic is.
- **C.** Full mobile experience with `translateY`-only lighter animations — most ambitious, highest QA cost across the device matrix; pursue only after A ships and is stable.

---

## Risk & Mitigations

1. **Pin offsets drift on variant switch / locale change / font load.**
   `root.tsx` scrolls to top and swaps content on variant change; web-font load shifts layout. Stale pin start/end positions cause Miku and content to desync.
   *Mitigation:* `ScrollTrigger.refresh()` after switch (the 60ms timeout in `useScrollStory`), and call it again on `document.fonts.ready`. Use `pinSpacing: true`. Keep `[locale]` in the hook's `deps` so the timeline rebuilds on language change.

2. **Lenis ↔ ScrollTrigger desync or double-scroll.**
   `ScrollProvider` is global; if `v-story` adds its own scroller or `normalizeScroll`, scroll position and trigger math diverge (janky scrub, wrong pin release).
   *Mitigation:* Use the **existing** `scroll-provider.tsx` only — never instantiate a second Lenis. Do not call `normalizeScroll(true)` on devices where Lenis is active. Let Lenis own the wheel; ScrollTrigger only reads.

3. **GSAP listener / trigger leaks when leaving the variant.**
   `v-story` creates many ScrollTriggers, IntersectionObservers, and key/pointer listeners. If they survive unmount, they fire against a DOM that no longer exists and degrade the other 6 variants.
   *Mitigation:* Create **everything** inside `gsap.context()` (the `useScrollStory` `ctx`) and return cleanup for non-GSAP listeners from the matchMedia branches; `ctx.revert()` on unmount. Assert `ScrollTrigger.getAll().length === 0` after switching away as part of the Day-7 gate.

4. **Per-frame work (overlap tests, velocity reads, sprite swaps) tanks FPS.**
   Naive `getBoundingClientRect` + `getVelocity` + `src` swaps every frame cause reflow storms and GIF decode churn.
   *Mitigation:* Throttle reads (transition-based, not per-frame), guard `setState`/scatter behind change-detection booleans (already in the `setState` and scatter steps), keep all position writes on transforms via GSAP, scope `will-change` to Miku only. Validate steady 60fps in the Performance panel on Day 7.

---

## Acceptance Criteria (whole feature)

- Selecting "Story" (no. 07) in the variant rail renders 6 scroll chapters with Miku traveling along the path.
- Miku walks, turns, peeks, leans on hover, bobs on guestbook entries, reacts to click/double-click, yawns when idle, waves goodbye at the bottom, and the Konami code triggers a finale.
- Words scatter when Miku passes and reassemble after.
- `<768px`: no pins, section-anchored Miku, smooth scroll.
- `prefers-reduced-motion`: static poses, zero transforms.
- `npx tsc --noEmit`, `npm run lint`, `npm run build` all pass; the 6 existing variants are unchanged; no leaked ScrollTriggers after switching away.
