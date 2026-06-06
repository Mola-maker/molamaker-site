# GeoGebra Geometry Renderer — Redesign Spec

**Date:** 2026-06-05
**Status:** Approved to build (user: "when the plan delivered just go")
**Scope:** Workplace → Math Studio geometry rendering only. Provider/model
infrastructure and the GeoGebra applet harness are kept.

## Problem

The Math Studio renderer (all uncommitted in the working tree) became a
multi-pass LLM pipeline:

```
L1 analyze-semantics (LLM) → L2 plan-from-semantics → main generate (LLM)
  → maybe-correct (LLM) → post-generation-audit (LLM)
```

Up to **four model round-trips** run before a single command reaches GeoGebra,
and the only real execution (client `runCommandLines`) happens once at the end
with **no repair loop**. Result: slow, and figures are wrong or empty ("zero
functional output"). ~3,000 lines across `lib/workplace/math-drawing/**`,
`geogebra-*.ts`, and `math-*.ts`, plus 17 coupled test files.

## Non-goals

- **Solving** the math problem is out of scope. We only render the figure from
  the stated construction steps.
- No server-side headless GeoGebra. The browser applet is the validator.

## Approaches considered

1. **Closed loop: generate → execute in real GeoGebra → repair (CHOSEN).**
   One generation call; the live applet validates; concrete GeoGebra error
   strings feed a bounded repair call. Fewest LLM hops, validated by the real
   engine.
2. Keep the multi-pass pipeline but optimize it. Rejected — that *is* the
   thing that failed; more passes ≠ more correctness.
3. Pure deterministic parser (no LLM) from a construction DSL. Rejected — the
   input is free-form Chinese olympiad prose; not a constrained DSL.

## Architecture

### New module: `lib/workplace/geometry-render/`
- `command-catalog.ts` — a **curated** reference of the ~40–60 GeoGebra commands
  actually needed for plane-geometry construction (Point, Segment, Line, Ray,
  Circle, Intersect, Midpoint, Line/Segment, PerpendicularLine,
  PerpendicularBisector, AngleBisector, Parallel, Tangent, TriangleCenter
  (incenter/circumcenter/centroid/orthocenter), Circumcircle, Polygon, Angle,
  Reflect/Rotate). Each entry: name, signature(s), one-line note. Replaces the
  auto-synced 400-command index that bloated the prompt.
- `prompts.ts` — `buildScriptPrompt(problem, catalog, history)` and
  `repairPrompt(commands, failures, catalog)`. Output contract: a single
  fenced ```geogebra block, one command per line, label points first.
- `parse-script.ts` — extract command lines from the fenced block; strip prose,
  blanks, comments; basic shape validation. (Replaces `parseGgbBlock`.)

### Kept as-is
- `lib/workplace/geogebra-eval.ts` — the client `evalCommand` /
  `evalCommandGetErrorString` helper (clean, correct).
- Provider/model plumbing: `providers/route.ts`, `models/route.ts`,
  `lib/workplace/{settings,settings-io,provider-models,model-probe,openai-chat-url,dashscope-models,dashscope-probe}.ts`.
- The applet harness in `workplace-math.tsx` (load / fit / resize / warmup).

### Rewritten: `app/api/workplace/math/route.ts`
SSE endpoint with two modes:
- `mode:"build"` — body `{ problem, provider, model, history? }`. One model
  call → stream tokens → emit `ggbCommands:{commands}`.
- `mode:"repair"` — body `{ commands, failures:[{cmd,error}], provider, model }`.
  One model call → emit corrected `ggbCommands:{commands}`.
Keeps the existing per-provider streaming (anthropic / deepseek / dashscope /
coze). Drops: semantics phase, plan phase, correction heuristics, audit phase,
command-index lookup, task-mode, continuation.

### Rewritten: `components/redesign/workplace-math.tsx`
Keeps the applet harness + provider/model picker. New `send()`:
```
1. POST mode:build → commands → runScript(commands) in applet
2. collect failures {cmd,error} from eval
3. while failures && repairs < 2:
     POST mode:repair {commands, failures} → fixed → clear → runScript(fixed)
4. surface eval ran/total and any remaining errors
```
Drops slash-command palette, meta-commands, continuation, and the KaTeX panel
(unrelated to rendering; reduces surface).

## Rollback (surgical, reversible)

1. **Snapshot** everything to a recoverable branch
   (`backup/ggb-pipeline-2026-06-05`) via stash → branch → re-apply, so no work
   is lost (including unrelated live2d/miku-hub/test files).
2. Remove only: `lib/workplace/math-drawing/**`, `geogebra-chat`,
   `geogebra-commands`, `geogebra-command-index(.generated.json)`,
   `geogebra-command-signatures`, `geogebra-command-audit`,
   `geogebra-context-builder`, `math-system-prompt`, `math-ggb-correction`,
   `math-response-sanitize`, `math-continuation`, `math-task-mode`,
   `math-correction-models`, `app/api/workplace/math/commands/`,
   `scripts/{sync-geogebra-manual,verify-math-studio}.mjs`, the `ggb:sync`
   package script, and the coupled `test/workplace/*` tests.
3. **Untouched:** everything non-geometry — live2d, miku-hub, workplace-settings,
   dashscope/provider infra, astrbot, and the `test/*.tex` cases.

## Testing

- Unit (Vitest, deterministic): `parse-script` (extraction/sanitize edge cases),
  `command-catalog` (well-formed entries), and the repair-loop reducer driven by
  a **fake GgbApi** that fails specific commands — proves it calls repair and
  converges.
- Manual E2E (needs browser + provider key): open Studio, paste a `.tex`
  construction, confirm the figure renders error-free; one repair iteration max
  on first failure.
- Gates: `npm run lint` (0 warnings), `tsc`, `npm test` green.

## Success criteria

- A construction from `test/ea联赛真题辑录.tex` renders in GeoGebra with
  `eval ran == total` (0 failed commands) within ≤2 model calls.
- p50 time-to-first-figure materially lower than the 4-hop pipeline (one
  generation call instead of three pre-passes).

## Addendum (2026-06-05) — combined "ultimate" version

The minimal v1 above (25-command catalog, render-only prompt) **regressed complex
drawing**: it lost the official command coverage, comprehension scaffolding, and
slash-command UX that made the prior pipeline usable. Final design fuses both:

- **Restored from the prior pipeline (deterministic, 0 LLM):** the 502-command
  official index + `geogebra-context-builder` relevance lookup (keyword→command,
  full index for TikZ/complex), the slash commands (`/draw /continue /draw_steps
  /translate_tikz /solve_optional /algebra` + meta `/model /status /rulesggb`),
  continuation/current-canvas editing, KaTeX panel, `parseGgbBlock` + fallbacks.
- **Dropped from the prior pipeline:** the 3 extra LLM passes (L1 semantics, L2
  plan, LLM audit) and LLM ggb-correction.
- **Kept from v1:** the real-GeoGebra execute → repair loop
  (`geometry-render/run-script.ts`), now with optional `triangleCenterFallbacks`.

Result: **1 build LLM call** (comprehension fused in-prompt via the official
lookup) + **≤2 repair calls only on real GeoGebra errors**. Fast, editable,
official-command-aware, and validated by the real engine. The 25-command catalog
and the v1 build/repair prompts were removed (superseded by the official index +
`math-system-prompt`).
