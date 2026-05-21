# Comprehensive Code Review Report — molamaker-site

**Review date:** 2026-05-21 | **Phases:** 1-5 complete | **Files reviewed:** 157  
**Flags:** security_focus, framework=nextjs  
**Reviewers:** Code Quality, Architecture, Security, Performance, Testing, Documentation, Framework Best Practices, CI/CD & DevOps

---

## Executive Summary

The molamaker-site codebase demonstrates solid fundamentals: excellent TypeScript discipline (zero `any`/`@ts-ignore`), well-structured Zod validation with HTML sanitization, correct React 19 + Next.js 15 App Router patterns, and properly configured Supabase RLS policies. The design system in `globals.css` is cohesive and well-implemented. **However**, the codebase has a critical architectural flaw — an in-memory rate limiter that provides zero protection on Vercel serverless — and is severely under-tested (~4% coverage) with substantially out-of-date documentation. The AstrBot chat integration is well-isolated architecturally but has a cryptographic key reuse issue and an unauthenticated history endpoint.

---

## Findings by Priority

### Critical (P0 — Must Fix Immediately) — 7 findings

| # | Finding | Phase | Files |
|---|---------|-------|-------|
| C1 | **In-memory rate limiter provides zero protection on Vercel serverless** — every cold start has an empty Map. All rate-limited endpoints (chat, guestbook, contact, views) are effectively unregulated. Also blocks horizontal scaling. | Q/A/S/P | `lib/rate-limit.ts:1` |
| C2 | **ASTRBOT_API_KEY reused as HMAC secret for IP hashing** — if the API key is rotated or compromised, all IP-to-user mappings break or become reversible. Use separate `HMAC_IP_SECRET` env var. | Q/S | `lib/hmac-ip.ts:3` |
| C3 | **Unauthenticated chat history access** — any valid sessionId returns full conversation history. No auth, no rate limiting, no IP binding. All errors return 200 with `{ messages: [] }`. | Q/S | `app/api/chat/history/route.ts` |
| C4 | **Admin page missing auth guard** — `requireAdmin()` is only in the layout. If layout is accidentally removed or accessed via parallel route, all posts leak. | A | `app/[locale]/admin/page.tsx` |
| C5 | **`Buffer.from()` in BMAC webhook breaks on Edge runtime** — webhook silently fails on Vercel Edge, losing all supporter events. Replace with pure Web Crypto hex decoder. | S/D | `app/api/webhooks/bmc/route.ts:29` |
| C6 | **Admin slug rename is DELETE+INSERT without transaction** — data loss risk if INSERT fails between operations. Replace with RPC function. | S | `app/[locale]/admin/actions.ts:39` |
| C7 | **Content-Length header trivially spoofable** — attacker sets `Content-Length: 5` and sends 10MB body, bypassing size check entirely. | Q/S | `app/api/chat/send/route.ts:19` |

### High (P1 — Fix Before Next Release) — 12 findings

| # | Finding | Phase |
|---|---------|-------|
| H1 | Silent error swallowing across 6+ API/data files — zero observability for security events or operational failures | Q/S/P |
| H2 | Admin savePost reads raw FormData without Zod validation — `PostSchema` exists but is dead code, no content sanitization | Q/S/F |
| H3 | Writing component uses `<a>` instead of i18n-aware `<Link>` — breaks locale prefix on `zh` route | A/F |
| H4 | ~70% of user-facing text hardcoded English despite `zh` locale — Hero, Contact, Guestbook, Blog, About untranslated | A/F |
| H5 | Dual blog data source (markdown + Supabase) disconnected — admin writes to Supabase, public reads from markdown | A/F |
| H6 | IP-derived `user_id` sent to AstrBot as persistent pseudonymous identifier — privacy concern | S |
| H7 | CI pipeline has no ESLint (`next lint`) or security scanning (`npm audit`) gates | D |
| H8 | Middleware fire-and-forget fetch doubles Vercel function invocation count | P/D |
| H9 | Docker images unpinned (`:latest`) — accidental rollback to breaking upstream change has no path back | D |
| H10 | `getPostBySlug` reads ALL markdown files to find one slug — O(n) disk I/O where O(1) is possible | P |
| H11 | View counter (`incrementPostView`) forces dynamic rendering of static blog pages | P |
| H12 | Three font families loaded as render-blocking CSS from external CDN | P |

### Medium (P2 — Plan for Next Sprint) — 25 findings

| # | Finding | Phase |
|---|---------|-------|
| M1 | Missing composite index on `posts(published, published_at DESC)` | P |
| M2 | Synchronous file I/O blocks event loop in `lib/content.ts` | P |
| M3 | Dedup Map never cleans up under low traffic | P |
| M4 | Missing Cache-Control headers on chat API routes | P |
| M5 | NavWrapper auth check runs on every page without `React.cache()` | P |
| M6 | Token bucket floating-point drift after many partial refills | P |
| M7 | No `next/dynamic` for Comments component (~50KB giscus) | P/F |
| M8 | `react-markdown` loaded eagerly on blog route | P |
| M9 | ChatRoom recreates `send` callback on every keystroke (`input` in deps) | P/F |
| M10 | page_views table unbounded growth — no retention policy | P/D |
| M11 | ChatRoom and BotStatusBadge duplicate-poll `/api/bot/status` every 60s | Q |
| M12 | `deletePost` has no error handling — `{ error }` from Supabase never checked | Q |
| M13 | API response format inconsistent across 7 endpoints — 3 different error conventions | Q/A/S |
| M14 | Schema duplication — `lib/validation.ts` vs `lib/schemas.ts` with overlapping schemas | A |
| M15 | Chat send 5s timeout may be too short for LLM-backed bot | A |
| M16 | Missing RLS write policy on `pages` table — `updatePage()` calls `upsert` with anon key (potential bug) | A/S |
| M17 | `contacts`/`page_views` RLS `check(true)` weak — rely solely on app-layer rate limiting | S |
| M18 | Auth callback locale detection fragile — no `Accept-Language` fallback | A |
| M19 | No health-check endpoint for the Next.js app itself | D |
| M20 | No centralized env var validation at startup | D |
| M21 | No deployment stages or automated rollback | D |
| M22 | No structured/production logging — `console.error` in 17 locations | D |
| M23 | No backup strategy for Docker volumes (NapCat session, AstrBot plugin data) | D |
| M24 | Sitemap only covers blog — about, work, projects, chat, guestbook, contact missing | A |
| M25 | Overly restrictive `safeText` regex blocks backticks and emoji for chat | S |

### Low (P3 — Track in Backlog) — 20 findings

| # | Finding | Phase |
|---|---------|-------|
| L1 | `contactSchema` email Zod ordering produces confusing errors | Q |
| L2 | Konami component uses mutable `let` instead of `useRef` | Q |
| L3 | Widespread `as` type casts instead of runtime Zod validation | Q |
| L4 | `scroll-reveal.tsx` returns `null` component | Q |
| L5 | Hardcoded `locale === 'zh'` string comparisons in components | Q |
| L6 | `error.tsx` uses extensive inline styles and DOM event handlers | Q |
| L7 | Footer could be a Server Component (client only for `useTranslations`) | A/F |
| L8 | `annotation-sidebar-wrapper.tsx` is thin boilerplate | A |
| L9 | Schema duplication — `schema.sql` vs migration files | A |
| L10 | Page layout pattern inconsistency across pages | A |
| L11 | Chat message array unbounded client-side — no cap or virtualization | P |
| L12 | Blog page missing ISR `revalidate` export | P |
| L13 | Cursor glow repaints on every mouse move | P |
| L14 | Background dot pattern repaint cost | P |
| L15 | `fmtDate` duplicated in 4 files — extract to shared utility | F |
| L16 | No Turbopack for dev (`next dev --turbo`) | F |
| L17 | Duplicate `process.env.NEXT_PUBLIC_*` reads — centralize in constants | F |
| L18 | CSP `'unsafe-inline'` rationale undocumented (giscus requirement) | D |
| L19 | No Dependabot/Renovate for automated dependency updates | D |
| L20 | SETUP.md references `.env.template` that doesn't exist | D |

---

## Findings by Category

| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| Code Quality | 3 | 1 | 4 | 7 | 15 |
| Architecture | 1 | 3 | 9 | 4 | 17 |
| Security | 4 | 2 | 5 | 0 | 11 |
| Performance | 0 | 3 | 8 | 4 | 15 |
| Testing | 0 | 0 | 0 | 0 | 0* |
| Documentation | 0 | 0 | 0 | 0 | 0* |
| Framework Best Practices | 1 | 4 | 6 | 4 | 15 |
| CI/CD & DevOps | 2 | 4 | 7 | 2 | 15 |
| **Total (deduped)** | **7** | **12** | **25** | **20** | **~55** |

*Testing and Documentation scored separately — Testing: D-grade (3.9/10, ~4% coverage). Documentation: 5 Critical gaps (README obsolete, 4 API endpoints undocumented, zero ADRs, architecture doc stale, no CHANGELOG).

---

## Recommended Action Plan

### Sprint 1 (This Week) — Critical Fixes ~8h

1. **[C1] Replace in-memory rate limiter with Postgres-backed limiter** (4h)
   - Create `rate_limits` table with atomic SQL function
   - Update `lib/rate-limit.ts` to use Supabase
   - Add concurrency test
2. **[C2] Create separate HMAC_IP_SECRET env var** (0.5h)
   - Add `HMAC_IP_SECRET` to `.env.local.example` and ECS `.env`
   - Update `lib/hmac-ip.ts` to use separate secret
3. **[C3] Add auth + rate limiting to chat history endpoint** (1.5h)
   - Add IP-based rate limiting
   - Add session-to-IP binding validation
   - Return proper HTTP status codes on errors
4. **[C4] Add requireAdmin() to admin page.tsx** (0.5h) — one line
5. **[C5] Replace Buffer.from with Web Crypto hex decoder in BMAC webhook** (1h)
6. **[C7] Remove Content-Length pre-check** (0.5h) — one line

### Sprint 2 (Next Week) — High Priority ~12h

1. **[H1] Add structured error logging** (2h) — `lib/logger.ts` with Pino or console wrapper
2. **[H2] Add Zod validation to admin savePost** (1.5h) — use existing `PostSchema`
3. **[H3] Replace `<a>` with `<Link>` in writing.tsx** (0.5h) — one line
4. **[H6] Replace IP-derived user_id with random ID in cookie** (1.5h)
5. **[H10] Fix getPostBySlug to read single file** (1h)
6. **[H11] Move view counter to client component** (1h)
7. **[H12] Self-host critical font weights** (1.5h)
8. **[H7] Add lint + audit to CI** (0.5h) — two lines in ci.yml
9. **[H9] Pin Docker image digests** (0.5h) — run `docker inspect`, update compose file

### Sprint 3 (This Month) — Medium Priority ~16h

1. **[H4] Extract hardcoded English strings to i18n** (4h) — Hero, Contact, Guestbook, About
2. **[H5] Resolve dual blog data source** (4h) — choose markdown or Supabase, remove the other path
3. **Add integration tests for server actions + API routes** (4h) — guestbook, contact, chat send, chat history
4. **[M23] Add Docker volume backup cron job** (1h)
5. **[M16] Add RLS write policy on pages table** or remove dead pages.ts (0.5h)
6. **[M1-M9] Apply quick performance fixes** (2.5h) — index, cache headers, dynamic imports, React.cache()

### Backlog — Low Priority ~10h

1. Add E2E tests (Playwright): guestbook sign, contact send, admin CRUD, chat flow
2. Convert Footer to Server Component
3. Add Dependabot config
4. Add health-check endpoint
5. Add Vercel deployment protection
6. Create CHANGELOG.md
7. Write ADRs: CSP rationale, blog data source, rate limiter choice, locale migration
8. Regenerate README directory tree and update API docs
9. Extract shared utilities: fmtDate, locale labels, env var constants
10. Add Turbopack to dev command

---

## Review Metadata

- **Review date:** 2026-05-21T23:00:00Z → 2026-05-21T23:50:00Z
- **Phases completed:** 0 (Scope), 1 (Quality & Architecture), 2 (Security & Performance), 3 (Testing & Documentation), 4 (Best Practices & Standards), 5 (Consolidated Report)
- **Flags applied:** security_focus=true, framework=nextjs
- **Reviewers:** 8 specialized agents
- **Files analyzed:** 157 (111 tracked + 46 untracked)
- **Total findings:** ~55 unique (7 Critical, 12 High, 25 Medium, 20 Low)

### Review Output Files
- `.full-review/00-scope.md` — Review scope and file inventory
- `.full-review/01-quality-architecture.md` — Code quality + architecture findings
- `.full-review/02-security-performance.md` — Security audit + performance analysis
- `.full-review/03-testing-documentation.md` — Test coverage + documentation review
- `.full-review/04-best-practices.md` — Framework best practices + CI/CD & DevOps
- `.full-review/05-final-report.md` — This consolidated report
