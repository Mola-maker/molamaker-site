---
name: autonomous-web-loop
description: >-
  Autonomously builds and ships full-stack website features end-to-end with
  expert frontend and backend skill, running an iterative
  plan-parallelize-implement-verify loop and orchestrating multiple parallel
  subagents to maximize speed and conserve context. Use when implementing
  website features, pages, APIs, or refactors in this Next.js + React +
  Supabase project, or whenever a task is large enough to benefit from parallel
  agents or an autonomous build-verify loop.
---

# Autonomous Web Loop

Builds full-stack website features autonomously: plan, fan out parallel
subagents for independent work, implement with senior-level frontend/backend
judgment, then run a hard verification gate and iterate until green.

This project's stack: **Next.js 16 (App Router) · React 19 · TypeScript ·
Supabase · next-intl · GSAP · Vitest · Playwright**. Match these conventions.

## The Loop

Copy this checklist and track it for any non-trivial task:

```
- [ ] 1. PLAN: scope the task, split into independent vs sequential work
- [ ] 2. PARALLELIZE: fan out parallel subagents for independent slices
- [ ] 3. IMPLEMENT: write code with frontend/backend best practices
- [ ] 4. VERIFY: run the verification gate (lint, types, tests, build)
- [ ] 5. ITERATE: fix failures, re-verify; loop until green
- [ ] 6. REPORT: summarize changes, decisions, and residual risks
```

Do not end your turn before the verification gate passes or you are genuinely
blocked.

## 1. Plan

- Read before writing. Find the existing pattern for the thing you're building
  (a sibling page, route handler, component) and follow it.
- Decompose the task into **independent slices** (can run in parallel) vs
  **sequential slices** (depend on shared types/contracts). Decide the shared
  contracts (types, API shapes, DB schema) first so parallel work doesn't
  conflict.
- For multi-step work, write a todo list and keep it current.

## 2. Parallelize (context-conserving orchestration)

The point of parallel subagents is to **keep heavy exploration and bulk work
out of the orchestrator's context**. Each subagent returns only a tight summary.

**Spawn parallel subagents when slices are independent.** Send one message with
multiple `Task` calls so they run concurrently. Good split axes:

- By layer: one agent on the API/route + DB, one on the React UI, once the
  shared types/contract is fixed.
- By file region: independent components, routes, or locale files.
- By role on the same code: reviewer + implementer, or factual + security +
  consistency reviewers.

**Choose the right agent type** (see [AGENTS.md](AGENTS.md) for the catalog and
routing rules). Common picks here:

- `explore` — read-only codebase exploration; use instead of running searches
  directly when scoping unfamiliar areas.
- `react-reviewer` / `typescript-reviewer` — review `.tsx`/`.ts` changes.
- `react-build-resolver` / `build-error-resolver` — fix a failing build.
- `e2e-runner` — Playwright flows for critical paths.
- `code-reviewer`, `security-reviewer` — run before declaring done.

**Rules for conserving context:**

- Each subagent prompt must be **self-contained**: it cannot see this chat.
  Include the goal, relevant file paths, the shared contract, and exactly what
  to return.
- Tell each subagent to return a **short structured result** (files changed,
  decisions, follow-ups), not full file dumps.
- Run independent agents in the background when the user is multitasking; keep
  working instead of polling.
- Keep sequential dependencies sequential — never parallelize work that shares
  an unsettled contract.

## 3. Implement

Apply senior frontend + backend judgment. Stack-specific essentials:

**Frontend (React 19 / Next 16 App Router)**

- Default to Server Components; add `"use client"` only when you need state,
  effects, or browser APIs. Keep client bundles small.
- Fetch data in Server Components / route handlers; never leak secrets to the
  client. Co-locate loading and `error.tsx` boundaries.
- All user-facing strings go through `next-intl`; add keys to every locale.
  Run `npm run i18n:check`.
- Animations use GSAP via `@gsap/react` (`useGSAP`); clean up on unmount.
- Accessibility: semantic elements, labels, focus states, keyboard support.

**Backend (Supabase / route handlers)**

- Validate every input at the boundary with `zod` before use.
- Use the SSR Supabase client (`@supabase/ssr`); rely on Row Level Security,
  never trust client-supplied user ids.
- Schema changes go in `supabase/migrations`; regenerate types with
  `npm run db:types`.
- Consistent response envelope, explicit error handling, no silent failures.

**General** — follow the workspace rules: immutable data, small focused files
(<800 lines), comprehensive error handling, no hardcoded secrets.

## 4. Verify (hard gate)

Run the gate after implementing. It runs lint + typecheck + tests, and build on
demand:

```bash
node .cursor/skills/autonomous-web-loop/scripts/verify.mjs          # lint + types + test
node .cursor/skills/autonomous-web-loop/scripts/verify.mjs --build  # also next build
```

Or run the underlying checks directly:

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build   # for routing/build-sensitive changes
```

## 5. Iterate

If the gate fails:

1. Read the actual error; fix the root cause, not the symptom.
2. For stubborn build/type errors, delegate to `build-error-resolver` /
   `react-build-resolver` with the error output.
3. Re-run the gate. **Only proceed when it passes.**

## 6. Report

End with: what changed (key files), notable decisions/trade-offs, verification
result, and any residual risks or follow-ups.

## Additional Resources

- For the parallel subagent catalog and routing rules, see [AGENTS.md](AGENTS.md)
