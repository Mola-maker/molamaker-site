# Phase 4: Best Practices & Standards

## Framework & Language Findings

### Critical
- **FB1.** In-memory rate limiter incompatible with serverless — Map state lost on every cold start (same as S-C3/P-C1/P-C2)

### High
- **FB2.** Admin savePost reads raw FormData without Zod — `PostSchema` exists but is dead code
- **FB3.** Writing component uses `<a>` instead of i18n-aware `<Link>` — breaks locale prefix in `zh`
- **FB4.** ChatRoom recreates `send` callback on every keystroke — `input` in useCallback deps
- **FB5.** Hardcoded English in Hero, Contact, Guestbook, Blog — despite `zh` locale support

### Medium
- **FB6.** Footer is client component only for `useTranslations` — could be async server component
- **FB7.** Dual disconnected blog data sources (markdown + Supabase) — admin writes to Supabase, public reads from markdown
- **FB8.** Inconsistent error response format — Server Actions vs Chat API use different shapes
- **FB9.** Dead code: `lib/schemas.ts` (not imported), `lib/data/pages.ts` (not imported)
- **FB10.** Comments component not dynamically imported — giscus script loads eagerly

### Low
- **FB11.** Duplicate `process.env.NEXT_PUBLIC_*` reads — should centralize in `lib/constants.ts`
- **FB12.** No Turbopack for dev (`next dev --turbo` available in Next.js 15)
- **FB13.** Synchronous fs reads in RSC context — `readFileSync` blocks event loop
- **FB14.** 17 `console.error` calls across data layer — no structured logging
- **FB15.** Duplicated `fmtDate` in 4 files — extract to shared utility

### Positive Patterns (Well Done)
1. Zero `any` types, zero `@ts-ignore` — excellent TypeScript discipline
2. React 19 `useActionState` used correctly in Guestbook/Contact forms
3. Params as `Promise<>` per Next.js 15 convention
4. Streaming with `<Suspense>` + skeleton fallbacks on home page
5. `NavWrapper` (server) → `Nav` (client) canonical Server/Client boundary
6. Zod v4 with sanitization transforms and `.pipe()` refinement
7. `next/dynamic` for AnnotationSidebar with `ssr: false`
8. Security headers in next.config.mjs
9. BMAC webhook with proper HMAC verification via Web Crypto
10. IP hashing before sending to AstrBot

---

## CI/CD & DevOps Findings

### Critical
- **DO1.** In-memory rate limiter useless on Vercel serverless (same as FB1)
- **DO2.** `Buffer.from()` in BMAC webhook breaks on Edge runtime — replace with Web Crypto hex decoder

### High
- **DO3.** CI pipeline has no linting (`next lint`) or security scanning (`npm audit`) gates
- **DO4.** Middleware fetch doubles Vercel function invocation count — remove or move to client beacon
- **DO5.** Docker images unpinned (`:latest`) in deploy/astrbot/docker-compose.yml

### Medium
- **DO6.** No health-check endpoint for the Next.js app itself
- **DO7.** No centralized env var validation at startup — misconfigured deploys fail cryptically at runtime
- **DO8.** No deployment stages or automated rollback — merges to main go directly to production
- **DO9.** No structured/production logging — `console.error` in dev only
- **DO10.** No backup strategy for Docker volumes (NapCat session data, AstrBot plugin data)
- **DO11.** page_views table unbounded growth — no retention policy or aggregation

### Low
- **DO12.** Chat history endpoint missing cache-control headers
- **DO13.** No Dependabot/Renovate for automated dependency updates
- **DO14.** CSP `'unsafe-inline'` for giscus — acceptable tradeoff but undocumented
- **DO15.** SETUP.md references `.env.template` that doesn't exist in repo
