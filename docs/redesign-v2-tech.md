# Redesign v2 — Technical Reference

> **Source reference:** `lunchlab.fr` (LUMEN — La Chambre Noire), an Astro static site by Lunch Lab.
> **Target:** `molamaker-site`, Next.js 15 App Router, warm-light editorial design system.
> **Principle:** Translate lunchlab.fr's spatial, atmospheric, scroll-driven museum UX into molamaker's cream/ink/coral palette. No dark mode. No code modifications yet — this doc is the blueprint.

---

## 1. Design Token Mapping

### 1.1 Color translation

Lunchlab uses a near-black palette with warm ivory and gold accents. The translation to molamaker's light palette is a **temperature inversion** — cold dark becomes warm light, gold becomes coral.

| Role | Lunchlab token | Lunchlab value | → | Molamaker token | Molamaker value |
|------|---------------|----------------|---|-----------------|-----------------|
| Background | `--noir` | `#0A0908` | → | `--bg` | `#F5F1EB` |
| Elevated surface | `--noir-2` | `#100E0C` | → | `--bg-elev` | `#FAF7F1` |
| Deep / shadow equivalent | `--ombre` | `#1B1714` | → | `--bg-deep` | `#EFEADD` |
| Primary text | `--ivoire` | `#E8DDC9` | → | `--ink` | `#2A2520` |
| Secondary text | `--ivoire-dim` | `#BFB2A0` | → | `--ink-2` | `#4A4234` |
| Accent (gold → coral) | `--or` | `#C9A56B` | → | `--accent` | `#C96442` |
| Pale accent | `--or-pale` | `#DDB985` | → | `--accent-soft` | `#E5B79E` |
| Rule / border | (opacity rgba) | — | → | `--rule` | `#E0D9C9` |

### 1.2 Typography mapping

| Role | Lunchlab | Molamaker | Notes |
|------|----------|-----------|-------|
| Headings | Cormorant Garamond | Fraunces | Both are editorial serifs; Fraunces has more weight range |
| Body / UI | Inter | DM Sans | Both are clean geometric sans; Inter is narrower |
| Monospace labels | — | JetBrains Mono | Molamaker adds mono for labels; lunchlab has none |
| H1 weight | 300 (light) | 400 (regular) | Lunchlab's 300 on black feels light; 400 on cream is equivalent contrast |
| H1 size (max) | 148px | 76px | Lunchlab is far larger; consider increasing for hero moments |

### 1.3 Timing & easing

Lunchlab's custom curves can be adopted directly — they're math, not colors.

```css
/* Lunchlab originals — keep as-is */
--t-fast: 240ms;
--t-base: 600ms;
--t-slow: 1200ms;
--t-cine: 1800ms;
--ease-out: cubic-bezier(0.22, 1, 0.36, 1);
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
```

Molamaker currently has `--duration-fast: 150ms` and `--duration-normal: 300ms`. Recommend adding these four timing tokens to `globals.css :root`.

---

## 2. Feature-by-Feature Translation

### 2.1 Custom cursor → `components/cursor-glow.tsx` (exists, enhance)

**Lunchlab:** 8px glowing ivory dot, expands to 12px gold on hover, shrinks to 5px on press. 520px radial aura following cursor with screen blend mode. Hidden on touch.

**Molamaker current state:** `components/cursor-glow.tsx` exists (radial gradient following mouse) but lacks hover/press states.

**Recommended enhancement:**

```
State         | Lunchlab  | Molamaker adaptation
──────────────┼───────────┼──────────────────────
Default       | 8px, ivory glow | 8px, --accent-soft glow
Hover         | 12px, gold      | 12px, --accent
Press         | 5px, shrink     | 5px, shrink (keep)
Aura          | 520px, gold radial, screen blend | 520px, --accent-soft radial, multiply blend
```

CSS translation (conceptual, do not add to globals.css until implementation):

```css
.cursor {
  /* Lunchlab: background: rgba(255,242,215,0.95) */
  background: var(--accent-soft);
  /* Lunchlab: box-shadow gold glow */
  box-shadow: 0 0 8px 2px var(--accent-soft),
              0 0 18px 4px rgba(201,100,66,0.18);
}

.cursor.is-hovering {
  width: 12px; height: 12px;
  background: var(--accent);
  box-shadow: 0 0 14px 4px rgba(201,100,66,0.7),
              0 0 34px 8px rgba(201,100,66,0.18);
}

.aura {
  background: radial-gradient(
    circle,
    var(--accent-soft) 0%,
    rgba(229,183,158,0.15) 44%,
    transparent 68%
  );
  mix-blend-mode: multiply; /* instead of screen — light bg needs multiply */
}
```

### 2.2 Grain / texture overlay → CSS-only (new)

**Lunchlab:** `body::before` pseudo-element with inline SVG `feTurbulence`, `mix-blend-mode: overlay` at 8% opacity, animated via `grainShift` keyframes.

**Molamaker adaptation:** Same technique, but use `mix-blend-mode: multiply` at lower opacity (light backgrounds show grain differently). Molamaker already has a `radial-gradient` dot pattern on `body` — the grain can layer on top or replace it.

```css
body::before {
  content: "";
  position: fixed; inset: 0;
  pointer-events: none; z-index: 9999;
  opacity: 0.04; /* lighter for light bg */
  mix-blend-mode: multiply;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.6'/></svg>");
  background-size: 200px 200px;
  animation: grainShift 0.45s steps(1) infinite;
}

@keyframes grainShift {
  0%   { background-position: 0% 0%; }
  14%  { background-position: 23% 15%; }
  28%  { background-position: 55% 37%; }
  43%  { background-position: 18% 62%; }
  57%  { background-position: 73% 44%; }
  71%  { background-position: 42% 78%; }
  85%  { background-position: 88% 22%; }
  100% { background-position: 0% 0%; }
}
```

### 2.3 Vignette overlay → CSS-only (new)

**Lunchlab:** `body::after` with fixed `radial-gradient(transparent 50%, rgba(0,0,0,0.55))`.

**Molamaker adaptation:** Invert the gradient — dark vignette becomes warm vignette using `--bg-deep`.

```css
body::after {
  content: "";
  position: fixed; inset: 0;
  pointer-events: none; z-index: 9998;
  background: radial-gradient(
    ellipse at center,
    transparent 50%,
    var(--bg-deep) 100%
  );
  opacity: 0.3;
}
```

### 2.4 Scene system → `/journey` page (GSAP + ScrollTrigger)

**Lunchlab:** 8 `position: fixed` scenes, `opacity` + `transform: translateX` transitions. Scroll/Swipe-driven navigation wrapping around. Vanilla JS scene manager.

**Molamaker adaptation:** The `/journey` page already uses GSAP ScrollTrigger with Lenis smooth scroll. Instead of horizontal slide transitions, molamaker can use **vertical scroll-driven scenes** — each section is one "chamber" (the journey already has 6 sections). The scroll naturally drives scene changes, no JS scene manager needed.

Key differences from lunchlab:

| Aspect | Lunchlab | Molamaker /journey |
|--------|----------|---------------------|
| Scene trigger | JS event + arrow buttons | Natural scroll (ScrollTrigger) |
| Direction | Horizontal slide | Vertical scroll |
| Image reveal | `clip-path: inset` bottom→top | GSAP `fromTo` with `clip-path` |
| Progress indicator | Dot nav | Progress bar or scroll indicator |
| Number watermarks | Roman numerals `I-VI`, giant serif | Keep the existing section structure |

### 2.5 Artwork frame → content cards (conceptual)

**Lunchlab:** Each artwork scene is a 3-column grid: `1fr 1.1fr 1fr` with the image in the center column. Image has a `clip-path: inset(0 0 100% round 2px)` that animates to `inset(0 0 0% round 2px)` on scene activation. Deep box shadows create depth. Hotspot buttons positioned absolutely over the image.

**Molamaker adaptation:** The 3-column layout translates to the existing `about-grid` pattern (`1.4fr 1fr`). The `clip-path` reveal can be adapted for blog post featured images or project cards.

```css
/* Conceptual — for journey artwork reveals */
.journey-reveal-frame {
  clip-path: inset(0 0 100% round 2px);
  transition: clip-path var(--t-cine) var(--ease-out) 200ms;
}

.journey-reveal-frame.is-visible {
  clip-path: inset(0 0 0% round 2px);
}
```

### 2.6 Hotspots → interactive annotations (conceptual)

**Lunchlab:** Absolutely-positioned `<button>` elements over artwork images. Positioned via CSS custom properties `--hx: X%; --hy: Y%`. Staggered fade-in with `transition-delay: 700ms…1500ms`. Each hotspot opens a tooltip with art analysis.

**Molamaker adaptation:** Can be used for:
- Blog post images with annotation overlays
- Project screenshots with feature callouts
- Journey page interactive elements

```css
.hotspot {
  position: absolute;
  left: var(--hx); top: var(--hy);
  width: 18px; height: 18px;
  margin: -9px 0 0 -9px;
  background: var(--accent);
  border: none; border-radius: 50%;
  cursor: pointer;
  opacity: 0;
  transform: scale(0.6);
  transition: opacity var(--t-base) var(--ease-out),
              transform var(--t-base) var(--ease-out);
}

.scene.is-active .hotspot {
  opacity: 1;
  transform: scale(1);
}
```

### 2.7 Poem / text panels → prose sidebars

**Lunchlab:** Each artwork has a right-aligned poem panel: `<h2>` with italic line wraps, `<p>` fragments, a `— Chambre N` signature. Text fades in with delay.

**Molamaker adaptation:** This matches the existing editorial style well. Fraunces italic headings + DM Sans body already achieve a similar feel. The poem panel can be used for blog post pull quotes, journey section descriptions, or about-page vignettes.

Existing styles that already serve this purpose:
- `h1.display em` / `h2 em` → italic accent words (coral)
- `p.lead` → editorial lead paragraphs
- `.label` → mono uppercase labels (equivalent to lunchlab's scene markers)

### 2.8 Ambient audio → optional enhancement

**Lunchlab:** Three Satie Gnossiennes OGG files, Tone.js for playback management, user-activated via "activez le son" prompt.

**Molamaker adaptation:** Can add a subtle ambient track to `/journey` page using the same Tone.js pattern. Since Tone.js is already a dependency (lunchlab loads it from CDN), adding it to molamaker would require `npm install tone`.

---

## 3. Component Architecture Map

How each lunchlab feature maps to a molamaker file (existing or new):

| Lunchlab feature | Lunchlab selector/class | → | Molamaker target file |
|------------------|-------------------------|---|----------------------|
| Custom cursor dot | `.cursor` | → | `components/cursor-glow.tsx` (enhance) |
| Cursor aura | `.aura` | → | `components/cursor-glow.tsx` (enhance) |
| Grain overlay | `body::before` | → | `app/globals.css` (new keyframes + pseudo) |
| Vignette | `body::after` | → | `app/globals.css` (new pseudo) |
| Navigation chrome | `.chrome-top`, `.chrome-bottom` | → | Already exists: `nav.top` + `footer` |
| Progress dots | `.progress-dot` | → | `components/journey/` (new component) |
| Scene container | `.stage`, `.scene` | → | `components/journey/journey-experience.tsx` (existing) |
| Threshold (hero) | `.scene-threshold` | → | `components/hero.tsx` (existing) |
| Artwork frame | `.work-frame`, `.work-canvas` | → | New journey scene component |
| Hotspots | `.hotspot` | → | New interactive component |
| Poem panel | `.work-poem` | → | New journey prose component |
| Exit scene | `.scene-exit` | → | Existing: last journey section |
| Cartouche (label) | `.work-cartouche` | → | Existing: `.label` pattern |
| Audio init | `#audio-init` | → | New `components/journey/audio-layer.tsx` |

---

## 4. CSS Variable Expansion Plan

Add these to `app/globals.css :root`:

```css
/* Timing tokens (from lunchlab.fr) */
--t-fast: 240ms;
--t-base: 600ms;
--t-slow: 1200ms;
--t-cine: 1800ms;
--ease-out-expo: cubic-bezier(0.22, 1, 0.36, 1);
--ease-in-out-expo: cubic-bezier(0.65, 0, 0.35, 1);

/* Depth tokens */
--shadow-frame: 0 30px 80px rgba(60,40,20,0.15),
                0 60px 160px rgba(60,40,20,0.08);
--shadow-glow: 0 0 14px 4px rgba(201,100,66,0.4);

/* Existing tokens to keep as-is */
/* --bg, --ink, --accent, --rule, etc. — no changes */
```

---

## 5. Implementation Priority

Ordered by effort-to-impact ratio (lowest effort, highest visual payoff first):

| # | Feature | Files touched | Effort | Visual impact |
|---|---------|---------------|--------|---------------|
| 1 | Grain overlay (CSS-only) | `globals.css` (30 lines) | 15 min | High — instant atmosphere |
| 2 | Vignette overlay (CSS-only) | `globals.css` (10 lines) | 5 min | Medium — depth framing |
| 3 | Timing tokens | `globals.css` (6 lines) | 2 min | Foundation for everything else |
| 4 | Cursor glow enhancement | `cursor-glow.tsx` | 30 min | High — polish |
| 5 | Journey scene transitions | `journey-experience.tsx` | 1-2 hrs | High — core UX |
| 6 | clip-path reveal frames | `journey-experience.tsx` | 45 min | Medium |
| 7 | Hotspot annotations | New component | 2 hrs | Medium |
| 8 | Ambient audio layer | New component + Tone.js | 1 hr | Low (nice-to-have) |
| 9 | Progress indicator | New component | 30 min | Low |

---

## 6. Key Technical Patterns from lunchlab.fr

### 6.1 Fixed-stage scroll hijack pattern

```css
/* Lunchlab: entire experience is position:fixed */
.stage { position: fixed; inset: 0; }
.scene { position: absolute; inset: 0; opacity: 0; pointer-events: none; }
.scene.is-active { opacity: 1; pointer-events: auto; }
```

Molamaker equivalent: GSAP ScrollTrigger with `pin: true` and `scrub`.

### 6.2 clip-path curtain reveal

```css
/* Lunchlab: artwork rolls up from bottom */
.work-canvas {
  clip-path: inset(0 0 100% round 2px);
  transition: clip-path 1800ms cubic-bezier(0.65,0,0.35,1) 200ms;
}
.scene.is-active .work-canvas {
  clip-path: inset(0 0 0% round 2px);
}
```

GSAP equivalent:
```js
gsap.fromTo(frame, 
  { clipPath: 'inset(0 0 100% round 2px)' },
  { clipPath: 'inset(0 0 0% round 2px)', duration: 1.8, ease: 'power3.inOut' }
);
```

### 6.3 Staggered hotspot entrance

```css
.hotspot {
  opacity: 0;
  transform: scale(0.6);
  transition: opacity 600ms var(--ease-out),
              transform 600ms var(--ease-out);
}
/* Each hotspot gets a staggered delay via inline style */
.hotspot:nth-child(1) { transition-delay: 700ms; }
.hotspot:nth-child(2) { transition-delay: 900ms; }
/* ... */
```

### 6.4 Noise grain via SVG filter

The grain is a single `body::before` pseudo-element with an inline SVG data URI containing `feTurbulence`. The `background-position` is animated in discrete `steps(1)` to create a film-grain flicker effect. Total cost: zero JS, ~3KB CSS.

### 6.5 Cursor state machine

Lunchlab tracks cursor state via CSS classes on the `.cursor` element:
- `.is-hovering` — over interactive elements
- `.is-spotlight` — over artwork canvases
- `.is-pressing` — mousedown

These are toggled by JS event listeners on `[data-hover="true"]` elements. Molamaker's `cursor-glow.tsx` can adopt the same pattern.

---

## 7. What NOT to copy

| Lunchlab pattern | Reason to skip |
|------------------|----------------|
| `cursor: none` on body | Accessibility concern — keep native cursor as fallback |
| Horizontal swipe navigation | Molamaker uses vertical scroll; horizontal swipe fights browser back gesture on mobile |
| Dark-only color scheme | Molamaker is light; dark mode would be an opt-in, not a replacement |
| Full-viewport fixed stage | Conflicts with molamaker's existing page structure (nav, sections, footer) — keep scoped to `/journey` |
| Vanilla JS scene manager | Molamaker uses React + GSAP; port the UX, not the implementation |
| `user-select: none` on images | Accessibility — allow text selection on the page |

---

## 8. Quick-reference: lunchlab.fr CSS class inventory

```
Global:
  .cursor, .aura, .chrome, .chrome-top, .chrome-bottom
  .lang-toggle, .sound-toggle, .progress, .progress-dot
  .hint, .skip-link

Stage:
  .stage (fixed inset 0)
  
Scenes:
  .scene (absolute, opacity 0)
  .scene.is-active (opacity 1)
  .scene-threshold (entry hero)
  .scene-work (×6 artwork scenes)
  .scene-exit (outro)

Threshold:
  .threshold-inner, .threshold-mark, .threshold-title
  .threshold-sub, .threshold-list, .threshold-tip
  .threshold-bg-wrap, .threshold-beam, .threshold-fog
  .threshold-spot, .threshold-vignette, .threshold-deco

Work:
  .work-num (giant Roman numeral)
  .work-frame, .work-canvas, .work-img
  .work-shade, .work-glow, .work-grain
  .work-cartouche, .work-poem, .work-meta
  .canvas-hint, .canvas-tools, .canvas-btn
  .hotspot, .signature

Exit:
  .exit-inner, .exit-line, .exit-sub
  .exit-quote, .exit-restart

Overlays:
  .panel-backdrop, .scene-flash, .flash-num
  .work-title-card (#work-title-card)
  .swipe-hint-mobile, .nav-arrow, .nav-zone

Canvas:
  #dust-canvas, #trail-canvas
```

---

*Document generated from Firecrawl scrape of lunchlab.fr on 2026-05-22. CSS extracted from inline `<style>` tag (49,705 chars). JS is bundled Astro output and not individually extractable; only Tone.js CDN link identified. All molamaker CSS variable values verified against `app/globals.css` at commit `4306535`.*
