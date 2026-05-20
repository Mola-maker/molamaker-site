# Comprehensive Code Review Report

## Review Target
Full codebase review of **molamaker-site** — a Next.js 15.5 personal portfolio/journal site with Supabase backend, spanning 19 source files across App Router, components, lib, middleware, and config.

## Executive Summary
The codebase demonstrates solid architectural fundamentals — clean component boundaries, appropriate Server/Client split, parallel data fetching, and optimistic UI patterns. However, the project carries significant technical debt concentrated in three areas: **zero security hardening** (no CSRF protection on forms, no rate limiting, no security headers, no input validation), **zero test coverage** (no test framework, no CI pipeline, no lock file), and **missing Next.js App Router conventions** (no `loading.tsx`, `error.tsx`, `not-found.tsx`, `sitemap.ts`, `robots.ts`, or `generateMetadata` on blog routes). The site functions correctly for a personal portfolio at its current scale, but every mutation endpoint is unprotected and any Supabase outage or render error crashes the entire user experience with no fallback. Addressing the CRITICAL items is essential before the site grows beyond a personal journal.

## Findings by Priority

### Critical Issues (P0 — Must Fix Immediately)

#### C1 — Missing error handling for Supabase query failures (Phase 1: Code Quality)
- **Source:** `01-quality-architecture.md` -- Finding C1
- **Files:** `app/page.tsx` (lines 16-30), `app/blog/[slug]/page.tsx` (lines 14-23)
- **Description:** All three Supabase queries in the home page and the blog post query ignore `.error` fields, rendering silently with fallback values (empty arrays, default counts) when Supabase is unreachable.
- **Fix:** Check `.error` on every query result; at minimum, `console.error` the failure. Add error boundary with user-facing fallback message.

#### C2 — No CSRF protection on server actions (Phase 1: Code Quality)
- **Source:** `01-quality-architecture.md` -- Finding C2
- **Files:** `app/actions.ts` (lines 6-36), `components/guestbook.tsx` (lines 28-53), `components/contact.tsx` (lines 17-33)
- **Description:** Guestbook and contact forms invoke server actions imperatively via `onClick`, bypassing Next.js's built-in CSRF protection that only applies to `<form action={...}>` submissions.
- **Fix:** Convert both forms to use `<form action={serverAction}>` with `useActionState` and `useOptimistic` hooks.

#### C3 — No rate limiting on form submission endpoints (Phase 1: Code Quality)
- **Source:** `01-quality-architecture.md` -- Finding C3
- **Files:** `app/actions.ts` (lines 6-36), `app/api/views/route.ts` (lines 4-16)
- **Description:** All mutation endpoints (guestbook, contact form, page view tracking) have zero rate limiting, making the site vulnerable to spam floods and Supabase quota exhaustion.
- **Fix:** Implement a lightweight in-memory token-bucket rate limiter in `lib/rate-limit.ts` and gate all mutation endpoints by client IP.

#### C4 — Zero test coverage (Phase 1: Code Quality)
- **Source:** `01-quality-architecture.md` -- Finding C4
- **Files:** Entire project (no test files, directories, or test runner dependencies)
- **Description:** The project has no tests of any kind — no unit tests, integration tests, or E2E tests. Violates the project's 80% coverage rule.
- **Fix:** Install Vitest + @testing-library/react + Playwright. Write tests for server actions first (highest risk code), then data-fetching paths, then client components.

#### C5 — No error boundary wrapping the app tree (Phase 1: Code Quality)
- **Source:** `01-quality-architecture.md` -- Finding C5
- **Files:** `app/layout.tsx` (line 14)
- **Description:** No `error.tsx` at the root level. If any client component throws during render, the entire page crashes to Next.js's default unhandled-error page.
- **Fix:** Create `app/error.tsx` with a styled fallback UI and a "Try again" reset button.

#### ARCH-C1 — No data access layer: inline Supabase queries violate Repository Pattern (Phase 1: Architecture)
- **Source:** `01-quality-architecture.md` -- Finding ARCH-C1
- **Files:** `app/page.tsx`, `app/actions.ts`, `app/blog/[slug]/page.tsx`, `app/api/views/route.ts`
- **Description:** Every Supabase query is written inline at the call site with no repository layer, preventing testing, causing schema coupling, and violating the project's documented Repository Pattern.
- **Fix:** Create `lib/data/posts.ts`, `lib/data/guestbook.ts`, `lib/data/contacts.ts`, `lib/data/page-views.ts` modules encapsulating query construction and error handling.

#### ARCH-C2 — Single monolithic page composition prevents streaming and progressive rendering (Phase 1: Architecture)
- **Source:** `01-quality-architecture.md` -- Finding ARCH-C2
- **Files:** `app/page.tsx` (lines 13-46)
- **Description:** The home page fetches three data sources in a single `Promise.all` then renders all 7 sections synchronously, blocking all HTML delivery until the slowest query completes.
- **Fix:** Adopt Suspense streaming: wrap data-dependent sections in `<Suspense>` with skeleton fallbacks. Move data fetching into individual `*Async` components.

#### S1 — No CSRF Protection on Mutation Endpoints (Phase 2: Security)
- **Source:** `02-security-performance.md` -- Finding S1
- **Files:** `components/guestbook.tsx` (lines 28-53, 79), `components/contact.tsx` (lines 17-33, 71), `app/actions.ts` (lines 6-36)
- **Description:** Server actions called via `onClick` bypass Next.js's CSRF token verification. Any third-party website can trigger guestbook/contact form submissions on behalf of a visiting user. CVSS 8.1, CWE-352.
- **Fix:** Convert to `<form action={serverAction}>` with `useActionState`. This is the same fix as C2.

#### S2 — No Rate Limiting on Any Mutation Endpoint (Phase 2: Security)
- **Source:** `02-security-performance.md` -- Finding S2
- **Files:** `app/actions.ts` (lines 6-17, 19-36), `app/api/views/route.ts` (lines 4-16)
- **Description:** All three mutation endpoints have zero rate limiting. An attacker can flood guestbook, abuse contact form, or inflate view counts via curl loops. CVSS 7.5, CWE-770.
- **Fix:** Implement `lib/rate-limit.ts` with in-memory token bucket. Gate all mutation endpoints with `checkRateLimit(key, maxTokens, windowMs)`. This is the same fix as C3.

#### S3 — Missing Input Validation Beyond String Length Trimming (Phase 2: Security)
- **Source:** `02-security-performance.md` -- Finding S3
- **Files:** `app/actions.ts` (lines 7-8, 19-23), `components/guestbook.tsx` (lines 65-70), `components/contact.tsx` (lines 45-56)
- **Description:** Server actions validate only with `.trim()` and `.slice()`. No email format check, no content sanitization, no profanity/spam filtering, and no duplicate detection. CVSS 6.5, CWE-20.
- **Fix:** Create `lib/validation.ts` with `validateName()`, `validateMessage()`, and `validateEmail()` functions using regex patterns for safe text and email format.

#### P1 — Blocking Fonts Block First Paint (Phase 2: Performance)
- **Source:** `02-security-performance.md` -- Finding P1
- **Files:** `app/layout.tsx` (lines 22-27)
- **Description:** Three font families loaded via external `<link>` tags from Google Fonts are render-blocking. Browser must fetch CSS from fonts.googleapis.com, parse @font-face, then fetch font files before text renders. LCP penalty of 500ms-2s on slow connections.
- **Fix:** Migrate to `next/font/google` which self-hosts font files at build time, eliminates external requests, and provides automatic `size-adjust` fallbacks.

#### P2 — Entire Home Page Blocks on 3 Data Queries (Phase 2: Performance)
- **Source:** `02-security-performance.md` -- Finding P2
- **Files:** `app/page.tsx`
- **Description:** `Promise.all` with 3 Supabase queries before returning any JSX. Browser receives zero HTML until all queries complete. No `loading.tsx`, no `<Suspense>`, no streaming.
- **Fix:** Add `app/loading.tsx` and wrap data-dependent sections in `<Suspense>` boundaries with skeleton fallbacks. This is the same fix as ARCH-C2 and M6.

#### P3 — Blog Page Uses `select('*')` (Phase 2: Performance)
- **Source:** `02-security-performance.md` -- Finding P3
- **Files:** `app/blog/[slug]/page.tsx` (lines 19-23)
- **Description:** `select('*')` fetches every column from `posts` table. Future column additions silently increase payload. Other queries in the project use selective columns.
- **Fix:** Enumerate needed columns: `.select('slug, title, published_at, read_time, view_count, excerpt, content')`.

#### T1 — Zero test coverage across the entire project (Phase 3: Testing)
- **Source:** `03-testing-documentation.md` -- Finding T1
- **Files:** Entire project (no test files, directories, or test runner configured)
- **Description:** No tests of any kind. Server actions, data-fetching paths, and client components with state are all untested. `package.json` has no test script.
- **Fix:** Set up Vitest + @testing-library/react + Playwright. Prioritized test plan: server actions first, then API route, data fetching, optimistic update, contact form, blog page, middleware.

#### D1 — README references non-existent `.env.local.example` file (Phase 3: Documentation)
- **Source:** `03-testing-documentation.md` -- Finding D1
- **Files:** `README.md` (line 21)
- **Description:** README instructs `cp .env.local.example .env.local` but `.env.local.example` does not exist in the repository.
- **Fix:** Create `.env.local.example` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` templates.

#### D2 — Zero inline documentation in source code (Phase 3: Documentation)
- **Source:** `03-testing-documentation.md` -- Finding D2
- **Files:** All 19 source files
- **Description:** Only 3 trivial comments exist across the entire codebase. Server actions, optimistic update logic, middleware analytics pipeline, and Supabase client patterns are completely undocumented.
- **Fix:** Add JSDoc to all exported functions. Add inline comments to complex logic (optimistic update flow, middleware analytics pipeline, server action return type contract).

#### D3 — No API documentation for any endpoint (Phase 3: Documentation)
- **Source:** `03-testing-documentation.md` -- Finding D3
- **Files:** Entire project
- **Description:** Three mutation endpoints (`signGuestbook`, `sendContact`, `POST /api/views`) have zero documentation — no request format, response format, error conditions, or rate limits documented.
- **Fix:** Create `docs/api.md` with FormData field tables for server actions, JSON schemas for REST endpoints, response shapes, and error codes.

#### D4 — No architecture documentation (Phase 3: Documentation)
- **Source:** `03-testing-documentation.md` -- Finding D4
- **Files:** Entire project (no `docs/` directory, no ADRs)
- **Description:** Missing architecture decision records, system diagrams, data flow documentation, ISR strategy rationale, and technology choice justifications.
- **Fix:** Create `docs/architecture.md` covering system overview, data flow diagrams, ISR strategy, and technology choice ADRs.

#### DEVOP-C1 — No CI/CD pipeline of any kind (Phase 4: CI/CD)
- **Source:** `04-best-practices.md` -- Finding DEVOP-C1
- **Files:** None (no `.github/workflows/`, no CI config)
- **Description:** Zero continuous integration infrastructure. No GitHub Actions, no automated type-check, lint, build, or test gates. Every merge to `main` triggers Vercel deploy with no pre-deployment validation.
- **Fix:** Create `.github/workflows/ci.yml` with checkout, install, type-check (`tsc --noEmit`), lint (`npm run lint`), and build (`npm run build`) steps.

#### DEVOP-C2 — No lock file committed to version control (Phase 4: CI/CD)
- **Source:** `04-best-practices.md` -- Finding DEVOP-C2
- **Files:** No `package-lock.json`, `yarn.lock`, or `pnpm-lock.yaml`
- **Description:** Dependency resolution is non-deterministic. Every `npm install` can produce different dependency trees. Vercel may install different versions than local development.
- **Fix:** Run `npm install` to generate `package-lock.json` and commit it. Use `npm ci` in CI pipelines.

#### DEVOP-C3 — No environment variable template file despite README referencing it (Phase 4: CI/CD)
- **Source:** `04-best-practices.md` -- Finding DEVOP-C3
- **Files:** `README.md` (line 21), project root (`.env.local.example` absent)
- **Description:** The README references `.env.local.example` but it does not exist. A new developer cannot know required environment variables.
- **Fix:** Create `.env.local.example` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` templates. This is the same fix as D1.

#### DEVOP-C4 — No infrastructure as code for Supabase resources (Phase 4: CI/CD)
- **Source:** `04-best-practices.md` -- Finding DEVOP-C4
- **Files:** No `supabase/config.toml`, no migration tooling
- **Description:** Supabase configuration exists only in the dashboard UI. No local Supabase for development. `supabase/schema.sql` is a one-shot script with no migration versioning.
- **Fix:** Run `npx supabase init`, link to existing project, pull current schema into versioned migrations. Add `supabase/config.toml` to version control.

#### B1 — Google Fonts via `<link>` instead of `next/font/google` (Phase 4: Best Practices)
- **Source:** `04-best-practices.md` -- Finding B1
- **Files:** `app/layout.tsx` (lines 22-27)
- **Description:** Three font families loaded via external `<link>` tags. Causes render-blocking, layout shift, leaks user IP to Google, and forgoes Next.js font optimization.
- **Fix:** Migrate to `next/font/google` with `variable` CSS custom properties. Update `globals.css` to reference the CSS variables. This is the same fix as P1 and M3.

#### B2 — Missing `viewport` export in layout.tsx (Phase 4: Best Practices)
- **Source:** `04-best-practices.md` -- Finding B2
- **Files:** `app/layout.tsx`
- **Description:** Next.js 15 requires `viewport` to be exported separately from `metadata`. The layout has `metadata` but no `viewport` export — no `themeColor` for browser chrome, no explicit viewport meta tag for mobile.
- **Fix:** Add `export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#F5F1EB' }`. This is the same fix as H8.

#### B3 — Missing `generateMetadata` on blog route (Phase 4: Best Practices)
- **Source:** `04-best-practices.md` -- Finding B3
- **Files:** `app/blog/[slug]/page.tsx`
- **Description:** No dynamic metadata export. Every blog post renders with the root layout's generic title/description. Social sharing cards show generic site info.
- **Fix:** Add `generateMetadata` async function querying post title and excerpt from Supabase for OpenGraph and Twitter card tags. This is the same fix as H4 and ARCH-H3.

#### B4 — Missing `generateStaticParams` on blog route (Phase 4: Best Practices)
- **Source:** `04-best-practices.md` -- Finding B4
- **Files:** `app/blog/[slug]/page.tsx`
- **Description:** No `generateStaticParams` means all blog posts are fully dynamic. Every first visit to any post incurs a cold-start ISR miss.
- **Fix:** Add `generateStaticParams` querying all post slugs from Supabase for build-time pre-rendering. This is the same fix as ARCH-H3 and P6.

#### B5 — Missing `loading.tsx`, `error.tsx`, `not-found.tsx` (Phase 4: Best Practices)
- **Source:** `04-best-practices.md` -- Finding B5
- **Files:** `app/loading.tsx` (absent), `app/error.tsx` (absent), `app/not-found.tsx` (absent)
- **Description:** Next.js App Router conventions for loading, error, and not-found boundaries are entirely absent. No loading UI during SSR, no error boundary for failures, no custom 404 page.
- **Fix:** Create all three files with styled fallback UIs matching the site's visual language. This is the same fix as C5, ARCH-H1, M6, and P12.

#### B6 — Missing `sitemap.ts` and `robots.ts` (Phase 4: Best Practices)
- **Source:** `04-best-practices.md` -- Finding B6
- **Files:** `app/sitemap.ts` (absent), `app/robots.ts` (absent)
- **Description:** No sitemap or robots.txt generation. Search engines have no structured way to discover blog posts, directly harming SEO.
- **Fix:** Create `app/sitemap.ts` querying all post slugs, and `app/robots.ts` with allow-all rules. This is the same fix as L3.

#### B7 — Server actions called imperatively via `onClick` instead of `<form action>` (Phase 4: Best Practices)
- **Source:** `04-best-practices.md` -- Finding B7
- **Files:** `components/guestbook.tsx` (lines 28-53, 79), `components/contact.tsx` (lines 17-33, 71)
- **Description:** Framework pattern violation: forms bypass progressive enhancement, bypass Next.js CSRF, and ignore React 19's `useActionState`/`useOptimistic` hooks. No-JS fallback is completely dead.
- **Fix:** Refactor to `<form action={formAction}>` with `useActionState` and `useOptimistic`. This is the same fix as C2, S1, and ARCH-H2.

### High Priority (P1 — Fix Before Next Release)

#### H1 — Duplicate type definitions across files (Phase 1: Code Quality)
- **Source:** `01-quality-architecture.md` -- Finding H1
- **Files:** `lib/supabase/server.ts`, `lib/supabase/middleware.ts`, `components/writing.tsx`, `components/guestbook.tsx`
- **Description:** `CookieToSet` type duplicated in two files; `Post` type in writing.tsx not shared with blog page; `Entry` type in guestbook.tsx not shared with page.tsx. Types will drift over time.
- **Fix:** Create `lib/types.ts` with shared `Post`, `GuestbookEntry`, `CookieToSet` interfaces. Run `npx supabase gen types typescript --linked` for database-generated types.

#### H2 — Empty catch block swallows all errors in API route (Phase 1: Code Quality)
- **Source:** `01-quality-architecture.md` -- Finding H2
- **Files:** `app/api/views/route.ts` (line 13)
- **Description:** `catch { return NextResponse.json({ ok: false }, { status: 500 }); }` discards the error object completely. No logging, no visibility into why view tracking failed.
- **Fix:** Add `console.error('[views] Failed to record page view:', error)` in the catch block.

#### H3 — Middleware analytics fetch reliability on Edge Runtime (Phase 1: Code Quality)
- **Source:** `01-quality-architecture.md` -- Finding H3
- **Files:** `middleware.ts` (lines 4-18)
- **Description:** Fire-and-forget `fetch` with `.catch(() => {})` may behave unexpectedly on Edge Runtime. No timeout, self-referential endpoint call, and the floating promise may keep middleware alive past its intended lifetime.
- **Fix:** Add `AbortSignal` timeout of 3 seconds on the fetch. Use `waitUntil` if available on Vercel.

#### H4 — Missing per-page SEO metadata (Phase 1: Code Quality)
- **Source:** `01-quality-architecture.md` -- Finding H4
- **Files:** `app/blog/[slug]/page.tsx` (lines 8-65)
- **Description:** Blog post pages have no `generateMetadata` export. Search engines see duplicate titles across all posts. Social sharing cards show no post-specific content.
- **Fix:** Add `generateMetadata` async function exporting post-specific `title`, `description`, and `openGraph` metadata. This is the same fix as B3.

#### H5 — Hardcoded external image URLs (Phase 1: Code Quality)
- **Source:** `01-quality-architecture.md` -- Finding H5
- **Files:** `components/nav.tsx` (line 8), `components/about.tsx` (line 30)
- **Description:** GitHub avatar URL hardcoded in two places. Creates runtime dependency on GitHub's CDN. If the avatar changes, both files must be updated.
- **Fix:** Extract to `lib/constants.ts` as `SITE_CONFIG.avatarUrl` with an environment variable fallback.

#### H6 — Input validation relies solely on string length trimming (Phase 1: Code Quality)
- **Source:** `01-quality-architecture.md` -- Finding H6
- **Files:** `app/actions.ts` (lines 6-36), `components/contact.tsx` (lines 17-33)
- **Description:** No email format validation, no content sanitization, no profanity/spam filtering, no duplicate-detection logic.
- **Fix:** Create `lib/validation.ts` with email regex, safe-text character class, and structured `ValidationResult` return type. This is the same fix as S3.

#### H7 — Simulated live-reader counter is misleading (Phase 1: Code Quality)
- **Source:** `01-quality-architecture.md` -- Finding H7
- **Files:** `components/hero.tsx` (lines 7-12)
- **Description:** "reading now" counter is a pure random walk with no connection to actual readership. On a portfolio site where credibility matters, this undermines trust.
- **Fix:** Either remove the counter, wire it to a real data source (Supabase Realtime), or label it honestly as an approximation.

#### H8 — Missing viewport metadata export (Phase 1: Code Quality)
- **Source:** `01-quality-architecture.md` -- Finding H8
- **Files:** `app/layout.tsx` (lines 1-31)
- **Description:** Next.js 15 requires `viewport` object exported separately from `metadata`. The layout only exports `metadata`, which may break responsive behavior on mobile devices.
- **Fix:** Add `export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#F5F1EB' }`. This is the same fix as B2.

#### ARCH-H1 — Missing Next.js App Router conventions: loading.tsx, error.tsx, not-found.tsx (Phase 1: Architecture)
- **Source:** `01-quality-architecture.md` -- Finding ARCH-H1
- **Files:** `app/loading.tsx` (absent), `app/error.tsx` (absent), `app/not-found.tsx` (absent)
- **Description:** Three built-in App Router file conventions entirely missing. No loading skeleton, no error boundary, and no custom 404 page despite `notFound()` being called in blog route.
- **Fix:** Create all three files. This is the same fix as C5, B5, M6, and P12.

#### ARCH-H2 — Server Actions invoked imperatively via onClick, bypassing progressive enhancement (Phase 1: Architecture)
- **Source:** `01-quality-architecture.md` -- Finding ARCH-H2
- **Files:** `components/guestbook.tsx` (lines 28-53), `components/contact.tsx` (lines 17-33)
- **Description:** Imperative action calls via `onClick` bypass progressive enhancement (no JS = dead forms), bypass Next.js CSRF, ignore HTML form semantics (no `<form>` element), and duplicate infrastructure code.
- **Fix:** Convert to `<form action={serverAction}>` with `useActionState`. This is the same fix as C2, S1, and B7.

#### ARCH-H3 — No `generateMetadata` or `generateStaticParams` on dynamic blog route (Phase 1: Architecture)
- **Source:** `01-quality-architecture.md` -- Finding ARCH-H3
- **Files:** `app/blog/[slug]/page.tsx` (lines 1-65)
- **Description:** Missing both critical Next.js exports. Every blog post slug incurs a full server-side render on first request. Every post shares the same generic SEO metadata.
- **Fix:** Add `generateStaticParams` for build-time pre-rendering and `generateMetadata` for per-post SEO. This is the same fix as H4, B3, B4, and P6.

#### ARCH-H4 — Middleware conflates infrastructure (session refresh) with observability (analytics) (Phase 1: Architecture)
- **Source:** `01-quality-architecture.md` -- Finding ARCH-H4
- **Files:** `middleware.ts` (lines 4-23)
- **Description:** Middleware calls `updateSession` on every request despite the site having no authenticated features. This adds a Supabase round-trip for no benefit. The analytics ping also adds latency to the hot path.
- **Fix:** Remove `updateSession` from middleware since there are no authenticated routes. Move analytics tracking to a client-side component or remove the API route call from middleware.

#### S4 — Missing Security Headers (CSP, HSTS, X-Frame-Options, etc.) (Phase 2: Security)
- **Source:** `02-security-performance.md` -- Finding S4
- **Files:** `next.config.mjs` (lines 1-9), `app/layout.tsx` (lines 4-12)
- **Description:** No Content-Security-Policy, Strict-Transport-Security, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, or Permissions-Policy headers. CVSS 6.1, CWE-693.
- **Fix:** Add `async headers()` to `next.config.mjs` returning all six security headers. Test in report-only mode first for CSP.

#### S5 — Information Leakage via Raw Error Messages Returned to Client (Phase 2: Security)
- **Source:** `02-security-performance.md` -- Finding S5
- **Files:** `app/actions.ts` (line 13, line 33)
- **Description:** Server actions return raw Supabase error messages to the client, potentially leaking table/column names and constraint details. CVSS 5.3, CWE-209.
- **Fix:** Log full error server-side with `console.error`, return sanitized message: `'Something went wrong. Please try again later.'`. This is the same fix as L4.

#### S6 — Uncaught Exception on Missing Environment Variables (Phase 2: Security)
- **Source:** `02-security-performance.md` -- Finding S6
- **Files:** `lib/supabase/server.ts` (lines 9-10), `lib/supabase/client.ts` (lines 5-6), `lib/supabase/middleware.ts` (lines 10-11)
- **Description:** All three Supabase client factories use non-null assertions (`!`) on env vars. If either is missing, the app crashes with a cryptic TypeError. CVSS 5.9, CWE-248.
- **Fix:** Create `lib/supabase/env.ts` with `requireEnv()` validation function that throws a clear error message at import time. This is the same fix as ARCH-M4.

#### S7 — RLS Policies Allow Unrestricted Anonymous Data Insertion (Phase 2: Security)
- **Source:** `02-security-performance.md` -- Finding S7
- **Files:** `supabase/schema.sql` (lines 55-59)
- **Description:** `with check (true)` on contacts and page_views insert policies means anyone with the anon key can write directly to Supabase tables via REST API, bypassing Next.js server actions. CVSS 6.5, CWE-284.
- **Fix:** Tighten RLS policies with length/content checks, or use service_role key for server-side writes and revoke anon insert policies.

#### S8 — Silent Failure in Analytics Pipeline Prevents Abuse Detection (Phase 2: Security)
- **Source:** `02-security-performance.md` -- Finding S8
- **Files:** `middleware.ts` (lines 12-16), `app/api/views/route.ts` (lines 13-15)
- **Description:** Three layers of silent failure: middleware `.catch(() => {})`, API route empty `catch`, and no monitoring/alerting. Failures can persist indefinitely. CVSS 5.3, CWE-778.
- **Fix:** Add structured error logging to all catch blocks. Add AbortSignal timeout to middleware fetch. This is the same fix as H2 and H3.

#### S9 — No Duplicate or Spam Detection for Form Submissions (Phase 2: Security)
- **Source:** `02-security-performance.md` -- Finding S9
- **Files:** `app/actions.ts` (lines 6-17, 19-36)
- **Description:** No mechanism prevents repeated identical submissions. An attacker can submit the same entry thousands of times. CVSS 5.3, CWE-799.
- **Fix:** Create `lib/dedup.ts` with in-memory submission tracking using content hashing and time windows.

#### P4 — Middleware Fires Extra HTTP Round-Trip for Analytics on Every Navigation (Phase 2: Performance)
- **Source:** `02-security-performance.md` -- Finding P4
- **Files:** `middleware.ts` (lines 4-17)
- **Description:** Fire-and-forget `fetch` to `/api/views` plus `updateSession` call (Supabase round-trip) on every page navigation, adding 50-150ms latency per request for no benefit.
- **Fix:** Remove `updateSession` from middleware. Move analytics to client-side component. This is the same fix as ARCH-H4.

#### P5 — Missing Database Indexes — Risk of Sequential Scans (Phase 2: Performance)
- **Source:** `02-security-performance.md` -- Finding P5
- **Files:** Schema queries in `app/page.tsx`, `app/blog/[slug]/page.tsx`
- **Description:** No indexes defined beyond primary keys. Queries sorting by `published_at DESC` and `created_at DESC` will perform table scans as data grows.
- **Fix:** Add indexes: `idx_posts_published_at`, `idx_posts_slug`, `idx_guestbook_created_at`, `idx_page_views_path`.

#### P6 — No `generateStaticParams` — Every Blog Page Pays ISR Miss Penalty (Phase 2: Performance)
- **Source:** `02-security-performance.md` -- Finding P6
- **Files:** `app/blog/[slug]/page.tsx`
- **Description:** Zero blog posts pre-rendered at build time. First visit to any post always hits an ISR cache miss.
- **Fix:** Add `generateStaticParams` querying all post slugs. This is the same fix as B4 and ARCH-H3.

#### P7 — `<img>` Instead of `next/image` — No Optimization or Lazy Loading (Phase 2: Performance)
- **Source:** `02-security-performance.md` -- Finding P7
- **Files:** `components/about.tsx` (lines 30-33), `components/nav.tsx` (lines 6-9)
- **Description:** Unoptimized `<img>` tags bypass Next.js image optimization: no WebP/AVIF conversion, no responsive srcset, no lazy loading, no explicit dimensions (causes CLS).
- **Fix:** Use `next/image` with explicit `width` and `height` attributes. The `remotePatterns` config already supports the GitHub avatar domain.

#### P8 — Supabase Query Errors Silently Ignored — No Graceful Degradation (Phase 2: Performance)
- **Source:** `02-security-performance.md` -- Finding P8
- **Files:** `app/page.tsx` (lines 17-30)
- **Description:** All queries use `?? []` / `?? 1247` fallbacks with zero error checking. When Supabase is down, the page renders as if there are zero posts/entries with no user-facing indication.
- **Fix:** Check `.error` on each query result and log or render a fallback message. This is the same fix as C1.

#### T2 — No test infrastructure configured (Phase 3: Testing)
- **Source:** `03-testing-documentation.md` -- Finding T2
- **Files:** `package.json`, project root (no `vitest.config.ts`, `playwright.config.ts`)
- **Description:** No test runner, no test configuration, no test utilities. Adding tests requires setting up the entire testing infrastructure from scratch.
- **Fix:** Install vitest + @testing-library/react + @testing-library/jest-dom + jsdom. Create `vitest.config.ts` with jsdom environment and `@` path alias.

#### T3 — No E2E tests for critical user flows (Phase 3: Testing)
- **Source:** `03-testing-documentation.md` -- Finding T3
- **Files:** None (no Playwright or Cypress tests)
- **Description:** Five critical user flows have no E2E coverage: home page loads all 7 sections, guestbook submit flow, contact form submit flow, blog post render, analytics recording.
- **Fix:** Create `e2e/` directory with Playwright tests covering all five flows.

#### T4 — No Supabase local development environment for testing (Phase 3: Testing)
- **Source:** `03-testing-documentation.md` -- Finding T4
- **Files:** Project root (no `supabase/config.toml`, no `docker-compose.yml`)
- **Description:** All queries hit production Supabase. Tests cannot run in CI without live Supabase connection. Schema changes cannot be tested locally.
- **Fix:** Run `npx supabase init` and `npx supabase start` to create a local Docker-based Supabase instance for development and testing.

#### D5 — README content editing instructions are misleading (Phase 3: Documentation)
- **Source:** `03-testing-documentation.md` -- Finding D5
- **Files:** `README.md` (lines 69-77)
- **Description:** README claims the `content` column "can be Markdown or plain text" but there is no Markdown rendering in the codebase. Also missing documentation on how to set `read_time`, `excerpt` vs `content`, and `published_at` sort behavior.
- **Fix:** Correct the README to state "Plain text only — Markdown is not yet supported." Document all columns and their purpose.

#### D6 — supabase/schema.sql has minimal comments and no design rationale (Phase 3: Documentation)
- **Source:** `03-testing-documentation.md` -- Finding D6
- **Files:** `supabase/schema.sql` (68 lines)
- **Description:** Schema has a 2-line header and zero column-level, RLS policy, or function documentation. Missing rationale for why guestbook has length checks but contacts/page_views use `with check (true)`.
- **Fix:** Add SQL column comments, RLS policy design rationale, function behavior docs, and index strategy acknowledgment.

#### D7 — No documentation of the middleware analytics pipeline (Phase 3: Documentation)
- **Source:** `03-testing-documentation.md` -- Finding D7
- **Files:** `middleware.ts`, `app/api/views/route.ts`
- **Description:** The most architecturally complex feature has zero documentation explaining the fire-and-forget pattern, path filtering, `updateSession` call despite no auth routes, and error suppression rationale.
- **Fix:** Add a block comment at the top of `middleware.ts` explaining the analytics pipeline design, trade-offs, and path filtering logic.

#### DEVOP-H1 — No error tracking or crash reporting service (Phase 4: CI/CD)
- **Source:** `04-best-practices.md` -- Finding DEVOP-H1
- **Files:** All 19 source files (no Sentry, LogRocket, or equivalent)
- **Description:** No error tracking, crash reporting, or monitoring integration. Server errors swallowed silently. Client errors invisible. No alerting for downtime or failures.
- **Fix:** Integrate Sentry (`@sentry/nextjs`) or add structured `console.error` logging with correlation IDs in all catch blocks.

#### DEVOP-H2 — No logging strategy or structured logging (Phase 4: CI/CD)
- **Source:** `04-best-practices.md` -- Finding DEVOP-H2
- **Files:** All source files (zero logging dependencies; only 1 implicit `console.error` path)
- **Description:** No request logging, no performance timing, no audit trail for mutations. Impossible to debug production issues without reproducing locally.
- **Fix:** Create `lib/logger.ts` with structured JSON logging (level, message, timestamp, correlationId, error details). Wire into every catch block.

#### DEVOP-H3 — No monitoring, metrics, or dashboards (Phase 4: CI/CD)
- **Source:** `04-best-practices.md` -- Finding DEVOP-H3
- **Files:** None (no monitoring configuration, no health check endpoint)
- **Description:** Zero observability beyond Vercel's deployment logs. No health check endpoint, no Core Web Vitals monitoring, no uptime monitoring, no business metrics.
- **Fix:** Add `app/api/health/route.ts` checking Supabase connectivity. Enable Vercel Web Analytics and Speed Insights. Set up free uptime monitor.

#### DEVOP-H4 — No secret management or rotation strategy (Phase 4: CI/CD)
- **Source:** `04-best-practices.md` -- Finding DEVOP-H4
- **Files:** `lib/supabase/server.ts`, `lib/supabase/client.ts`, `lib/supabase/middleware.ts`
- **Description:** Environment variables accessed via `process.env` with non-null assertions and no validation. No documented rotation procedure for Supabase keys. Vercel env vars configured only via dashboard.
- **Fix:** Add `lib/supabase/env.ts` with validated constants. Document rotation procedure. Use `vercel env` CLI for IaC env var management.

#### DEVOP-H5 — No preview or staging environment (Phase 4: CI/CD)
- **Source:** `04-best-practices.md` -- Finding DEVOP-H5
- **Files:** None (single Vercel project, single environment)
- **Description:** Only production environment exists. No preview deployments explicitly configured, no staging environment, no environment parity guarantee.
- **Fix:** Configure Vercel preview deployments explicitly via `vercel.json`. Set up deployment protection for non-main branches.

#### B8 — `@supabase/ssr` at ^0.5.2 is significantly outdated (Phase 4: Best Practices)
- **Source:** `04-best-practices.md` -- Finding B8
- **Files:** `package.json` (line 12)
- **Description:** `@supabase/ssr` pinned to ^0.5.2 while 0.7.x is current (May 2026). Includes API changes in `createBrowserClient` and `createServerClient`, better TypeScript types.
- **Fix:** Run `npm install @supabase/ssr@latest @supabase/supabase-js@latest` and verify cookie handler APIs match.

#### B9 — `select('*', { count: 'exact', head: true })` should use explicit column (Phase 4: Best Practices)
- **Source:** `04-best-practices.md` -- Finding B9
- **Files:** `app/page.tsx` (line 29)
- **Description:** Using `'*'` with `head: true` signals wrong intent and forces unnecessary column resolution. Use an explicit lightweight column like `'id'`.
- **Fix:** Change to `select('id', { count: 'exact', head: true })`. This is the same fix as P13.

#### B10 — No Zod or other schema-based input validation (Phase 4: Best Practices)
- **Source:** `04-best-practices.md` -- Finding B10
- **Files:** `app/actions.ts` (lines 6-36)
- **Description:** Server actions use manual string coercion. No structured validation, no typed results, no inferred TypeScript types from schema. The TypeScript ruleset recommends Zod.
- **Fix:** Install `zod`, create `lib/validations.ts` with `guestbookSchema` and `contactSchema` using `z.object({...})`, use `schema.safeParse()` in server actions.

#### B11 — No shared types directory; types duplicated across components (Phase 4: Best Practices)
- **Source:** `04-best-practices.md` -- Finding B11
- **Files:** `components/writing.tsx`, `components/guestbook.tsx`, `components/work.tsx`
- **Description:** Domain types defined inline in each component file. `Post` type exists in `writing.tsx` and implicitly in `blog/[slug]/page.tsx`. `Entry` type has no shared definition with server action.
- **Fix:** Create `lib/types.ts` with `Post`, `GuestbookEntry`, and `Project` interfaces. This is the same fix as H1.

#### B12 — `CookieToSet` type duplicated across two files (Phase 4: Best Practices)
- **Source:** `04-best-practices.md` -- Finding B12
- **Files:** `lib/supabase/server.ts` (line 4), `lib/supabase/middleware.ts` (line 4)
- **Description:** The exact same type alias is defined twice. If the cookie options interface changes, both definitions must be updated.
- **Fix:** Move to `lib/types.ts` and import in both files. This is the same fix as H1.

#### B13 — Missing security headers (Phase 4: Best Practices)
- **Source:** `04-best-practices.md` -- Finding B13
- **Files:** `next.config.mjs`, `middleware.ts`
- **Description:** No CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, or Permissions-Policy configured. This is the same finding as S4.
- **Fix:** Add `async headers()` to `next.config.mjs`. Set `poweredByHeader: false`. This is the same fix as S4.

### Medium Priority (P2 — Plan for Next Sprint)

#### M1 — Inline styles mixed with CSS classes on blog post page (Phase 1: Code Quality)
- **Source:** `01-quality-architecture.md` -- Finding M1
- **Files:** `app/blog/[slug]/page.tsx` (lines 31, 41, 43, 47-52, 55)
- **Description:** Blog post page uses inline `style={{}}` objects for layout-critical styles while the rest of the project uses global CSS. Mixing makes restyling inconsistent.
- **Fix:** Extract blog-specific styles into `globals.css` under `.post-body`, `.article-header`, `.article-excerpt`, `.article-body`, `.article-back` classes.

#### M2 — setTimeout without cleanup in contact form (Phase 1: Code Quality)
- **Source:** `01-quality-architecture.md` -- Finding M2
- **Files:** `components/contact.tsx` (line 31)
- **Description:** `setTimeout(() => setOk(false), 5000)` without cleanup. If user navigates away within 5 seconds, the callback fires on an unmounted component.
- **Fix:** Wrap in `useEffect` with cleanup: `useEffect(() => { if (!showSuccess) return; const id = setTimeout(() => setShowSuccess(false), 5000); return () => clearTimeout(id); }, [showSuccess])`.

#### M3 — Google Fonts loaded via `<link>` instead of `next/font/google` (Phase 1: Code Quality)
- **Source:** `01-quality-architecture.md` -- Finding M3
- **Files:** `app/layout.tsx` (lines 21-27)
- **Description:** Raw `<link>` tags in a manual `<head>` element load Google Fonts. `next/font/google` self-hosts at build time, eliminates layout shift, and removes runtime Google dependency.
- **Fix:** Migrate to `next/font/google` with CSS variable exports. This is the same fix as B1 and P1.

#### M4 — Redundant middleware path filtering (Phase 1: Code Quality)
- **Source:** `01-quality-architecture.md` -- Finding M4
- **Files:** `middleware.ts` (lines 7-11)
- **Description:** Middleware manually checks `path.startsWith('/_next')`, `/api`, and `path.includes('.')` in addition to the `config.matcher` which already excludes `_next/static`, `_next/image`, and `favicon.ico`.
- **Fix:** Consolidate all exclusions into the `config.matcher` regex pattern and remove the runtime checks.

#### M5 — Section IDs hardcoded in both nav and section components (Phase 1: Code Quality)
- **Source:** `01-quality-architecture.md` -- Finding M5
- **Files:** `components/nav.tsx` (lines 14-18), multiple section components
- **Description:** Navigation links reference `#about`, `#work`, etc. and each section independently sets its `id`. If renamed in one place but not the other, nav links silently break.
- **Fix:** Centralize section identifiers in `lib/constants.ts` as `SECTION_IDS` constant. Import in both nav and section components.

#### M6 — No loading states or Suspense boundaries (Phase 1: Code Quality)
- **Source:** `01-quality-architecture.md` -- Finding M6
- **Files:** `app/page.tsx`, `app/blog/[slug]/page.tsx`
- **Description:** No `loading.tsx` file. On slow connections or ISR cache misses, user sees a blank page until server response completes.
- **Fix:** Create `app/loading.tsx` and `app/blog/[slug]/loading.tsx` with styled skeleton UIs. This is the same fix as P2, P12, and B5.

#### M7 — `select('*')` on blog post query fetches unnecessary columns (Phase 1: Code Quality)
- **Source:** `01-quality-architecture.md` -- Finding M7
- **Files:** `app/blog/[slug]/page.tsx` (line 21)
- **Description:** `select('*')` fetches every column including potentially large `content` fields even when they're not needed. Inconsistent with `app/page.tsx` which uses selective columns.
- **Fix:** Explicitly list needed columns. This is the same fix as P3 and B9.

#### ARCH-M1 — Shared UI chrome (Nav + Footer) duplicated instead of extracted into layout (Phase 1: Architecture)
- **Source:** `01-quality-architecture.md` -- Finding ARCH-M1
- **Files:** `app/page.tsx` (lines 33, 44), `app/blog/[slug]/page.tsx` (lines 29, 63)
- **Description:** Both pages manually render `<Nav />` and `<Footer />`. If a new shared component is added, it must be added to every page individually.
- **Fix:** Move `<Nav />` and `<Footer />` into `app/layout.tsx` wrapping `{children}`. 5-line change.

#### ARCH-M2 — Site sections use anchor-based navigation instead of App Router route segmentation (Phase 1: Architecture)
- **Source:** `01-quality-architecture.md` -- Finding ARCH-M2
- **Files:** `components/nav.tsx` (lines 14-18), `app/page.tsx` (lines 32-45)
- **Description:** Traditional anchor links within a single monolithic page limit code splitting, force all data to be fetched upfront, and prevent independent ISR revalidation per section.
- **Fix:** For current scale, this is acceptable but should be documented as a known trade-off. When the site outgrows single-page, consider route groups with per-section pages.

#### ARCH-M3 — Client-side Supabase browser client defined but never used (Phase 1: Architecture)
- **Source:** `01-quality-architecture.md` -- Finding ARCH-M3
- **Files:** `lib/supabase/client.ts` (lines 1-8)
- **Description:** `createBrowserClient` is defined but no component imports or uses it. Dead infrastructure code suggests templated scaffolding or abandoned real-time subscription plans.
- **Fix:** Either remove as dead code, or document intended future use (e.g., Supabase Realtime subscriptions).

#### ARCH-M4 — No environment variable validation at application startup (Phase 1: Architecture)
- **Source:** `01-quality-architecture.md` -- Finding ARCH-M4
- **Files:** `lib/supabase/server.ts` (lines 9-10), `lib/supabase/client.ts` (lines 5-6), `lib/supabase/middleware.ts` (lines 10-11)
- **Description:** Non-null assertions on env vars with zero validation. Missing variables cause cryptic runtime crashes mid-request instead of failing fast with a clear message.
- **Fix:** Create `lib/supabase/env.ts` with `requireEnv()` that throws a descriptive error at import time. This is the same fix as S6.

#### ARCH-M5 — View tracking via self-referential middleware creates circular dependency (Phase 1: Architecture)
- **Source:** `01-quality-architecture.md` -- Finding ARCH-M5
- **Files:** `middleware.ts` (lines 12-16), `app/api/views/route.ts` (lines 4-16)
- **Description:** Middleware calls an API route that it itself intercepts, creating temporal coupling and testing complexity. Architecture: Browser -> Middleware -> fetch /api/views -> Middleware -> API Route -> Supabase.
- **Fix:** Decouple view tracking from middleware. Move to a `<ViewTracker path={pathname} />` client component in `app/layout.tsx`.

#### S10 — Missing Content Security Policy for Third-Party Resources (Phase 2: Security)
- **Source:** `02-security-performance.md` -- Finding S10
- **Files:** `app/layout.tsx` (lines 21-27), `next.config.mjs` (lines 1-9)
- **Description:** Google Fonts loaded via external `<link>` tags with no SRI hash and no CSP. If fonts.googleapis.com is compromised, malicious CSS could be injected. CVSS 4.3, CWE-829.
- **Fix:** Migrate to `next/font/google` which self-hosts fonts at build time. This is the same fix as B1, P1, and M3.

#### S11 — Latent Stored XSS Risk from Unsanitized Database Content (Phase 2: Security)
- **Source:** `02-security-performance.md` -- Finding S11
- **Files:** `app/actions.ts` (lines 7-8), `components/guestbook.tsx` (line 91), `app/blog/[slug]/page.tsx` (line 53)
- **Description:** Guestbook messages and blog content stored without HTML sanitization. Currently safe due to React JSX auto-escaping, but latent risk if markdown rendering or `dangerouslySetInnerHTML` is added.
- **Fix:** Add a warning comment noting the reliance on React escaping. If markdown rendering is added later, add DOMPurify sanitization first.

#### S12 — Public Anon Key Grants Direct Database Access to Anyone (Phase 2: Security)
- **Source:** `02-security-performance.md` -- Finding S12
- **Files:** `lib/supabase/client.ts` (lines 5-6), `supabase/schema.sql` (lines 47-59)
- **Description:** Supabase anon key is public by design, but combined with permissive RLS policies, anyone can read/write directly via REST API, bypassing server-side validation. CVSS 5.3, CWE-200.
- **Fix:** Use service_role key for server-side writes. Tighten anon RLS policies. This is the same fix as S7.

#### S13 — View Count Inflation via Unauthenticated API Endpoint (Phase 2: Security)
- **Source:** `02-security-performance.md` -- Finding S13
- **Files:** `app/api/views/route.ts` (lines 4-16), `components/hero.tsx` (line 27)
- **Description:** `/api/views` accepts any path with no deduplication. The schema declares `session_id` but API route never populates it. Trivial to inflate view counts. CVSS 4.3, CWE-837.
- **Fix:** Add session-based deduplication via `visitor_sid` cookie with a 5-minute dedup window.

#### P9 — Blog View Count RPC + Post Fetch Are Sequential (Not Parallel) (Phase 2: Performance)
- **Source:** `02-security-performance.md` -- Finding P9
- **Files:** `app/blog/[slug]/page.tsx` (lines 16-23)
- **Description:** `increment_view` RPC and post `select` query run sequentially (two round-trips) when they are independent and can run in parallel.
- **Fix:** Wrap both in `Promise.all` to execute concurrently.

#### P10 — `Date.now()` in Render — Impure Component Causing Hydration Warnings (Phase 2: Performance)
- **Source:** `02-security-performance.md` -- Finding P10
- **Files:** `components/guestbook.tsx` (lines 13-19)
- **Description:** `timeAgo()` calls `Date.now()` during render, causing SSR/hydration mismatch since server-rendered time differs from client-rendered time.
- **Fix:** Extract to a `TimeAgo` client component with `useState` + `useEffect` interval. This is the same fix as B21.

#### P11 — Inline Styles Create New Objects on Every Render (Phase 2: Performance)
- **Source:** `02-security-performance.md` -- Finding P11
- **Files:** `app/blog/[slug]/page.tsx` (lines 31-54)
- **Description:** Multiple `style={{}}` objects create new references on every render. Move to CSS classes for better performance and consistency.
- **Fix:** Extract to CSS classes in `globals.css`. This is the same fix as M1.

#### P12 — Missing `loading.tsx` for Route-Level Suspense (Phase 2: Performance)
- **Source:** `02-security-performance.md` -- Finding P12
- **Files:** `app/` (file absent)
- **Description:** No loading skeleton renders during SSR/ISR. This is the same finding as M6 and part of B5.
- **Fix:** Create `app/loading.tsx`. This is the same fix as M6, P2, and B5.

#### P13 — `select('*', { count: 'exact', head: true })` — Inefficient Count Query (Phase 2: Performance)
- **Source:** `02-security-performance.md` -- Finding P13
- **Files:** `app/page.tsx` (lines 27-29)
- **Description:** `select('*')` with `head: true` builds full column list unnecessarily for a count-only query.
- **Fix:** Use `select('id', { count: 'exact', head: true })` or a lightweight RPC. This is the same fix as B9.

#### T5 — No TypeScript type-check in CI pipeline (Phase 3: Testing)
- **Source:** `03-testing-documentation.md` -- Finding T5
- **Files:** `package.json` (no `type-check` script), no CI config files
- **Description:** No CI/CD pipeline exists. Only validation is manual `npm run build` and `npm run lint`.
- **Fix:** Add `"type-check": "tsc --noEmit"` script and include in CI workflow. This is the same fix as DEVOP-C1.

#### T6 — No lint rules beyond Next.js defaults (Phase 3: Testing)
- **Source:** `03-testing-documentation.md` -- Finding T6
- **Files:** No `.eslintrc.json`, `.eslintrc.js`, or `eslint.config.mjs`
- **Description:** Relies entirely on Next.js built-in ESLint. Missing rules for unused imports, no console.log in production, and import ordering.
- **Fix:** Create `eslint.config.mjs` extending `next/core-web-vitals` and `next/typescript` with additional strict rules. This is the same fix as B20.

#### D8 — README deployment instructions are incomplete (Phase 3: Documentation)
- **Source:** `03-testing-documentation.md` -- Finding D8
- **Files:** `README.md` (lines 60-69)
- **Description:** "Add the 3 env vars from `.env.local`" but env vars never listed by name. Missing Supabase project creation steps, schema.sql execution, Vercel env var configuration.
- **Fix:** Expand deployment section with explicit env var table, Supabase project setup steps, and database initialization instructions.

#### D9 — No CONTRIBUTING.md (Phase 3: Documentation)
- **Source:** `03-testing-documentation.md` -- Finding D9
- **Files:** `CONTRIBUTING.md` (absent)
- **Description:** For a public GitHub repo, absence signals no contribution acceptance. Should cover dev setup, branch naming, commit format, PR process, testing requirements.
- **Fix:** Create minimal `CONTRIBUTING.md` with development setup, PR checklist, and Conventional Commits format.

#### D10 — ISR strategy undocumented (Phase 3: Documentation)
- **Source:** `03-testing-documentation.md` -- Finding D10
- **Files:** `app/page.tsx`, `app/blog/[slug]/page.tsx`
- **Description:** Two ISR values set without rationale: why 30s for home page and 60s for blog posts. No documentation of cold start behavior, `revalidatePath` interaction, or CDN cache behavior.
- **Fix:** Document ISR strategy in architecture docs or as block comments explaining the revalidation rationale.

#### D11 — No LICENSE file (Phase 3: Documentation)
- **Source:** `03-testing-documentation.md` -- Finding D11
- **Files:** `LICENSE` (absent)
- **Description:** Public GitHub repo without a license is "all rights reserved" by default. Nobody can legally use, modify, or distribute the code.
- **Fix:** Add an MIT `LICENSE` file.

#### DEVOP-M1 — No `vercel.json` for deployment configuration (Phase 4: CI/CD)
- **Source:** `04-best-practices.md` -- Finding DEVOP-M1
- **Files:** `vercel.json` (absent)
- **Description:** Relies entirely on Vercel auto-detection. No explicit build configuration, routing rules, cron jobs, or environment-specific overrides.
- **Fix:** Create minimal `vercel.json` with `buildCommand`, `installCommand`, security headers, and asset cache rules.

#### DEVOP-M2 — No backup or disaster recovery strategy for Supabase (Phase 4: CI/CD)
- **Source:** `04-best-practices.md` -- Finding DEVOP-M2
- **Files:** None (no backup configuration, no documented recovery procedure)
- **Description:** Entire data layer lives in Supabase with no automated backup, no point-in-time recovery, and no documented restore procedure. `schema.sql` recovers schema but not data.
- **Fix:** Add documented manual backup step. Set up weekly schema dump GitHub Action. Document restore procedure in README.

#### DEVOP-M3 — No Dependabot or automated dependency updates (Phase 4: CI/CD)
- **Source:** `04-best-practices.md` -- Finding DEVOP-M3
- **Files:** No `.github/dependabot.yml`
- **Description:** Dependencies use caret ranges with no automated PRs for updates. No automated security vulnerability alerts. No lock file means no `npm audit` in CI.
- **Fix:** Create `.github/dependabot.yml` with weekly npm updates and monthly GitHub Actions updates.

#### DEVOP-M4 — No pre-commit or pre-push hooks (Phase 4: CI/CD)
- **Source:** `04-best-practices.md` -- Finding DEVOP-M4
- **Files:** No `.husky/`, no `lint-staged` config
- **Description:** No automated checks run before commits or pushes. Type errors, lint violations, and formatting issues caught only at build time.
- **Fix:** Add Husky + lint-staged with ESLint and Prettier on staged files. Add `tsc --noEmit` pre-push hook.

#### B14 — `target: "ES2020"` in tsconfig.json is conservative (Phase 4: Best Practices)
- **Source:** `04-best-practices.md` -- Finding B14
- **Files:** `tsconfig.json` (line 3)
- **Description:** ES2020 target is 5 years old. Next.js 15.5+ targets Node.js 18+ which supports ES2023. Modernizing enables `Array.prototype.at()`, `Object.hasOwn()`, `Error.cause`.
- **Fix:** Set `"target": "ES2022"` in `tsconfig.json`.

#### B15 — No CSS Modules, Tailwind, or component-scoped styling (Phase 4: Best Practices)
- **Source:** `04-best-practices.md` -- Finding B15
- **Files:** `app/globals.css` (single 361-line file), `app/blog/[slug]/page.tsx` (inline styles)
- **Description:** All styles in a single flat file with inline style exceptions. No style isolation between components. Blog post duplicates color/spacing tokens.
- **Fix:** Move blog inline styles to `globals.css` as dedicated classes. Consider CSS Modules or Tailwind if the project grows beyond ~10 components. This is the same fix as M1.

#### B16 — `<img>` tags missing `width`/`height` attributes (CLS risk) (Phase 4: Best Practices)
- **Source:** `04-best-practices.md` -- Finding B16
- **Files:** `components/nav.tsx` (line 7), `components/about.tsx` (line 31)
- **Description:** Both `<img>` elements lack explicit dimensions, preventing the browser from reserving space before image load and causing Cumulative Layout Shift.
- **Fix:** Either use `next/image` with explicit dimensions, or add `width`/`height` attributes. This is the same fix as P7.

#### B17 — No `.env.local.example` file despite README referencing it (Phase 4: Best Practices)
- **Source:** `04-best-practices.md` -- Finding B17
- **Files:** Project root (absent)
- **Description:** Environment variable template missing. New developer cannot know required variables. This is the same finding as D1 and DEVOP-C3.
- **Fix:** Create `.env.local.example` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_SITE_URL` templates.

#### B18 — Middleware analytics fire-and-forget has no `waitUntil` for edge runtime (Phase 4: Best Practices)
- **Source:** `04-best-practices.md` -- Finding B18
- **Files:** `middleware.ts` (lines 12-16)
- **Description:** `fetch().catch(() => {})` pattern works on Node.js but may silently drop page views on edge runtimes where promises are cancelled when the response is sent.
- **Fix:** Use `waitUntil` from `@vercel/functions` or add a comment documenting the edge runtime caveat. This is the same fix as H3.

#### B19 — `next.config.mjs` could be `next.config.ts` for type safety (Phase 4: Best Practices)
- **Source:** `04-best-practices.md` -- Finding B19
- **Files:** `next.config.mjs`
- **Description:** Next.js 15.5+ supports `next.config.ts` for full TypeScript type checking. Current `.mjs` file uses JSDoc annotation which provides IDE support but no compile-time checking.
- **Fix:** Rename to `next.config.ts`, import `NextConfig` from `next`, and use explicit type annotation.

#### B20 — No ESLint configuration beyond Next.js defaults (Phase 4: Best Practices)
- **Source:** `04-best-practices.md` -- Finding B20
- **Files:** No `eslint.config.mjs`, `.eslintrc.json`, or `.eslintrc.js`
- **Description:** Only Next.js built-in ESLint via `next lint`. Missing rules for `@typescript-eslint/no-unused-vars`, `no-console` in production, and import ordering.
- **Fix:** Create `eslint.config.mjs` extending `next/core-web-vitals` and `next/typescript` with additional strict rules. This is the same fix as T6.

#### BC1 — Missing `poweredByHeader: false` and other production flags (Phase 4: Build Configuration)
- **Source:** `04-best-practices.md` -- Finding BC1
- **Files:** `next.config.mjs`
- **Description:** Config lacks `poweredByHeader: false` (leaks `X-Powered-By: Next.js` header), `productionBrowserSourceMaps: false`, and `reactStrictMode: true`.
- **Fix:** Add these production hardening flags to `next.config.mjs`. This is the same fix as S14.

### Low Priority (P3 — Track in Backlog)

#### L1 — Hardcoded color values instead of CSS custom properties (Phase 1: Code Quality)
- **Source:** `01-quality-architecture.md` -- Finding L1
- **Files:** `app/globals.css` (lines 345-346)
- **Description:** `.form-err` uses hardcoded hex values (`#F5D5C8`, `#8B2A1A`) — the only hardcoded colors in the entire stylesheet. Should use CSS custom properties for dark-mode readiness.
- **Fix:** Add `--feedback-err-bg` and `--feedback-err-text` custom properties to `:root` and reference them.

#### L2 — No dark mode support (Phase 1: Code Quality)
- **Source:** `01-quality-architecture.md` -- Finding L2
- **Files:** `app/globals.css` (lines 1-361)
- **Description:** Site is light-mode-only with no `prefers-color-scheme` media query or theme toggle. The existing semantic token system makes dark mode relatively easy to add.
- **Fix:** Add `@media (prefers-color-scheme: dark)` block with dark color values for all `--bg`, `--ink`, `--accent`, and `--rule` tokens.

#### L3 — Missing `sitemap.ts` and `robots.ts` (Phase 1: Code Quality)
- **Source:** `01-quality-architecture.md` -- Finding L3
- **Files:** None present
- **Description:** No sitemap or robots.txt generation limits search engine discoverability. This is the same finding as B6.
- **Fix:** Create `app/sitemap.ts` and `app/robots.ts` using Next.js Metadata Route API. This is the same fix as B6.

#### L4 — Server action error messages leak Supabase internals (Phase 1: Code Quality)
- **Source:** `01-quality-architecture.md` -- Finding L4
- **Files:** `app/actions.ts` (lines 13, 33)
- **Description:** `return { error: error.message }` returns raw Supabase error messages to the client, potentially leaking schema details via constraint violations or RLS policy rejection messages.
- **Fix:** Log full error server-side, return sanitized message: `'Something went wrong. Please try again.'`. This is the same fix as S5.

#### ARCH-L1 — No `metadataBase` in root layout breaks relative OpenGraph URLs (Phase 1: Architecture)
- **Source:** `01-quality-architecture.md` -- Finding ARCH-L1
- **Files:** `app/layout.tsx` (lines 4-12)
- **Description:** Root layout exports `metadata` with `openGraph` but does not set `metadataBase`. Without it, Next.js cannot resolve relative URLs in OpenGraph tags.
- **Fix:** Add `metadataBase: new URL('https://molamaker.com')` to the metadata export.

#### ARCH-L2 — Blog post content rendering uses `white-space: pre-wrap` with no markdown processing (Phase 1: Architecture)
- **Source:** `01-quality-architecture.md` -- Finding ARCH-L2
- **Files:** `app/blog/[slug]/page.tsx` (lines 47-52)
- **Description:** Blog post content rendered as plain text with no markdown-to-HTML conversion, no code syntax highlighting, no image rendering. Acceptable for early-stage journal but limits content authoring.
- **Fix:** When ready, integrate `react-markdown` or `next-mdx-remote`. Document the current constraint.

#### ARCH-L3 — Static year in footer relies on `new Date()` runtime call (Phase 1: Architecture)
- **Source:** `01-quality-architecture.md` -- Finding ARCH-L3
- **Files:** `components/footer.tsx` (line 4)
- **Description:** Footer uses `new Date().getFullYear()` at render time. While functionally correct, it's a dynamic expression in an otherwise static component.
- **Fix:** Acceptable as-is for a personal site. Not worth changing unless optimizing for edge-cache hit rate.

#### S14 — No Production Security Configuration in next.config.mjs (Phase 2: Security)
- **Source:** `02-security-performance.md` -- Finding S14
- **Files:** `next.config.mjs` (lines 1-9)
- **Description:** Missing `poweredByHeader: false` (reveals Next.js version), `productionBrowserSourceMaps: false`. CVSS 2.6, CWE-16.
- **Fix:** Add production hardening flags. This is the same fix as BC1.

#### S15 — Worker Limits and DoS via Large Payloads (Phase 2: Security)
- **Source:** `02-security-performance.md` -- Finding S15
- **Files:** `app/actions.ts`, `app/api/views/route.ts`
- **Description:** Server actions and API routes accept payloads up to Next.js's default 1MB body limit, far exceeding expected sizes (~300 bytes for guestbook, ~500 bytes for contact, ~50 bytes for views). CVSS 3.7, CWE-770.
- **Fix:** Add content-length checks or ensure `.slice()` limits on all fields in server actions.

#### S16 — No Environment Variable Validation at Startup (Phase 2: Security)
- **Source:** `02-security-performance.md` -- Finding S16
- **Files:** `lib/supabase/server.ts`, `lib/supabase/middleware.ts`
- **Description:** Missing env vars cause opaque crashes with full stack traces in development mode. CVSS 2.3, CWE-1295. This is the same finding as ARCH-M4 and S6.
- **Fix:** Create validated environment module as described in S6.

#### P14 — Interval Re-render Every 4s in Hero Component (Phase 2: Performance)
- **Source:** `02-security-performance.md` -- Finding P14
- **Files:** `components/hero.tsx` (lines 8-12)
- **Description:** Fake "live readers" counter re-renders every 4 seconds. Minimal performance impact at current scale but prevents static optimization. This is the same finding as H7.
- **Fix:** Remove or replace with a static statistic as recommended in H7.

#### P15 — Three Font Families Add Load Weight (Phase 2: Performance)
- **Source:** `02-security-performance.md` -- Finding P15
- **Files:** `app/layout.tsx`
- **Description:** After migrating to `next/font/google`, three font families = ~120-180KB of font data. Acceptable for design-focused portfolio but a deliberate trade-off.
- **Fix:** No action required. Document as a conscious trade-off.

#### P16 — No Explicit CDN Cache Headers (Phase 2: Performance)
- **Source:** `02-security-performance.md` -- Finding P16
- **Files:** `next.config.mjs`
- **Description:** No `headers()` function for static asset cache-control. Static assets served without long-lived cache headers.
- **Fix:** Add cache headers for `/_next/static/(.*)` with `Cache-Control: public, max-age=31536000, immutable`.

#### T7 — No pre-commit hooks for formatting or type-checking (Phase 3: Testing)
- **Source:** `03-testing-documentation.md` -- Finding T7
- **Files:** No `.husky/`, no `lint-staged` config
- **Description:** No automated checks run on commit. Acceptable for solo project but recommended as project grows. This is the same finding as DEVOP-M4.
- **Fix:** Add Husky + lint-staged. This is the same fix as DEVOP-M4.

#### D12 — No CHANGELOG or versioning strategy (Phase 3: Documentation)
- **Source:** `03-testing-documentation.md` -- Finding D12
- **Files:** `CHANGELOG.md` (absent), `package.json` (v0.1.0)
- **Description:** Acceptable for v0.1.0 personal site. Adopt Keep a Changelog format when reaching v1.0.0.
- **Fix:** Create `CHANGELOG.md` when the project reaches v1.0.0.

#### D13 — No JSDoc on shared type definitions (Phase 3: Documentation)
- **Source:** `03-testing-documentation.md` -- Finding D13
- **Files:** `components/writing.tsx`, `components/guestbook.tsx`, `components/work.tsx`
- **Description:** Inline type definitions (`Post`, `Entry`, `Project`) lack JSDoc. Field names are descriptive but provenance (database vs. computed) and nullability are undocumented.
- **Fix:** Add JSDoc comments to type definitions documenting field provenance and nullability.

#### D14 — next.config.mjs lacks descriptive comments (Phase 3: Documentation)
- **Source:** `03-testing-documentation.md` -- Finding D14
- **Files:** `next.config.mjs`
- **Description:** Has JSDoc type annotation for IDE support but no comments explaining why `avatars.githubusercontent.com` is in `remotePatterns` or that the config is currently unused.
- **Fix:** Add comments explaining remotePatterns purpose and noting it's unused until `<img>` is migrated to `<next/image>`.

#### DEVOP-L1 — No rollback procedure for Vercel deployments (Phase 4: CI/CD)
- **Source:** `04-best-practices.md` -- Finding DEVOP-L1
- **Files:** None
- **Description:** Vercel supports instant rollbacks but there is no documented procedure. Database schema changes are not included in rollbacks since they're applied manually.
- **Fix:** Document rollback procedure in `docs/operations.md` covering both frontend (`vercel rollback`) and database (reverse migration) scenarios.

#### DEVOP-L2 — No Vercel analytics or RUM configured (Phase 4: CI/CD)
- **Source:** `04-best-practices.md` -- Finding DEVOP-L2
- **Files:** None (no `@vercel/analytics` dependency)
- **Description:** Custom page-view tracker gives a simple hit count, but Vercel Analytics and Speed Insights would provide Core Web Vitals, visitor geography, referrers, and performance metrics with zero additional infrastructure.
- **Fix:** Install `@vercel/analytics` and `@vercel/speed-insights`. Add `<Analytics />` and `<SpeedInsights />` to root layout.

#### DEVOP-L3 — No `engines` field in package.json (Phase 4: CI/CD)
- **Source:** `04-best-practices.md` -- Finding DEVOP-L3
- **Files:** `package.json`
- **Description:** No required Node.js version specified. Vercel defaults to Node.js 20.x, but without explicit declaration, the runtime version is implicit.
- **Fix:** Add `"engines": { "node": ">=20.0.0", "npm": ">=10.0.0" }` to `package.json`.

#### B21 — `Date.now()` called during render in `timeAgo` function (Phase 4: Best Practices)
- **Source:** `04-best-practices.md` -- Finding B21
- **Files:** `components/guestbook.tsx` (line 13)
- **Description:** `Date.now()` in render phase causes component to render differently on every frame, preventing React memoization. This is the same finding as P10.
- **Fix:** Use `useMemo` with a dependency or `useEffect`/`setInterval` for live clock. This is the same fix as P10.

#### B22 — `Footer` calls `new Date().getFullYear()` on every server render (Phase 4: Best Practices)
- **Source:** `04-best-practices.md` -- Finding B22
- **Files:** `components/footer.tsx` (line 4)
- **Description:** Server component runs `new Date().getFullYear()` on every ISR revalidation. Functionally correct but year only changes annually. This is the same finding as ARCH-L3.
- **Fix:** Acceptable as-is. Optionally set a static year to avoid the unnecessary call.

#### B23 — `next.config.mjs` has `images.remotePatterns` but `<next/image>` is never used (Phase 4: Best Practices)
- **Source:** `04-best-practices.md` -- Finding B23
- **Files:** `next.config.mjs` (lines 3-6)
- **Description:** Project configures `images.remotePatterns` for GitHub avatars but uses raw `<img>` tags everywhere. The config is dead code unless migrated to `next/image`.
- **Fix:** Remove or leave in place — it becomes active when `<img>` is migrated to `<next/image>` as recommended in P7 and B16.

#### B24 — Server actions lack explicit return type annotations (Phase 4: Best Practices)
- **Source:** `04-best-practices.md` -- Finding B24
- **Files:** `app/actions.ts` (lines 6, 19)
- **Description:** Exported public API functions rely on TypeScript inference for return types. An explicit `ActionResult` type would document the contract.
- **Fix:** Define `type ActionResult = { ok?: boolean; error?: string }` and annotate functions with `Promise<ActionResult>`.

#### B25 — `react` and `react-dom` at ^19.2.1 have newer patch releases available (Phase 4: Best Practices)
- **Source:** `04-best-practices.md` -- Finding B25
- **Files:** `package.json` (lines 15-16)
- **Description:** React has newer patch releases available. `typescript` at ^5.6.3 is a minor version behind 5.8.x.
- **Fix:** Run `npm install react@latest react-dom@latest typescript@latest @types/react@latest @types/react-dom@latest`.

#### BC2 — `overrides.postcss` may be unnecessary (Phase 4: Build Configuration)
- **Source:** `04-best-practices.md` -- Finding BC2
- **Files:** `package.json` (lines 24-26)
- **Description:** `"overrides": { "postcss": "^8.5.10" }` forces PostCSS across all dependencies. If for a specific vulnerability fix, document it. Otherwise, remove.
- **Fix:** Add a comment explaining the override reason, or remove if no longer needed.

#### BC3 — No `prettier` or code formatter in devDependencies (Phase 4: Build Configuration)
- **Source:** `04-best-practices.md` -- Finding BC3
- **Files:** `package.json`
- **Description:** No formatter configured. The web hooks ruleset recommends Prettier for automatic formatting.
- **Fix:** Install `prettier` as devDependency and add format scripts.

## Findings by Category

### Code Quality
| Severity | Count |
|----------|-------|
| CRITICAL | 5 |
| HIGH | 8 |
| MEDIUM | 7 |
| LOW | 4 |
| **Total** | **24** |

### Architecture
| Severity | Count |
|----------|-------|
| CRITICAL | 2 |
| HIGH | 4 |
| MEDIUM | 5 |
| LOW | 3 |
| **Total** | **14** |

### Security
| Severity | Count |
|----------|-------|
| CRITICAL | 3 |
| HIGH | 6 |
| MEDIUM | 4 |
| LOW | 3 |
| **Total** | **16** |

### Performance
| Severity | Count |
|----------|-------|
| CRITICAL | 3 |
| HIGH | 5 |
| MEDIUM | 5 |
| LOW | 3 |
| **Total** | **16** |

### Testing
| Severity | Count |
|----------|-------|
| CRITICAL | 1 |
| HIGH | 3 |
| MEDIUM | 2 |
| LOW | 1 |
| **Total** | **7** |

### Documentation
| Severity | Count |
|----------|-------|
| CRITICAL | 4 |
| HIGH | 3 |
| MEDIUM | 4 |
| LOW | 3 |
| **Total** | **14** |

### CI/CD & DevOps
| Severity | Count |
|----------|-------|
| CRITICAL | 4 |
| HIGH | 5 |
| MEDIUM | 4 |
| LOW | 3 |
| **Total** | **16** |

### Framework Best Practices
| Severity | Count |
|----------|-------|
| CRITICAL | 7 |
| HIGH | 6 |
| MEDIUM | 7 |
| LOW | 5 |
| **Total** | **25** |

### Build Configuration
| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 2 |
| **Total** | **3** |

### Grand Total (All Findings, All Phases)
| Severity | Count |
|----------|-------|
| CRITICAL | 29 |
| HIGH | 40 |
| MEDIUM | 39 |
| LOW | 27 |
| **Total** | **135** |

## Recommended Action Plan

### Phase 1: Security Foundation (Estimated effort: Medium — 2-4 hours)
1. **Convert forms to `<form action={serverAction}>` with `useActionState`** — Restores CSRF protection, enables progressive enhancement. Addresses C2, S1, ARCH-H2, B7.
2. **Create `lib/rate-limit.ts` with in-memory token bucket** — Protects all mutation endpoints. Addresses C3, S2.
3. **Create `lib/validation.ts` with `validateName`, `validateMessage`, `validateEmail`** — Hardens input validation. Addresses H6, S3, B10.
4. **Add security headers via `next.config.mjs` `headers()` function** — Defense-in-depth. Addresses S4, B13.
5. **Add `poweredByHeader: false` and production hardening flags** — Addresses S14, BC1.

### Phase 2: Error Resilience (Estimated effort: Small — 1-2 hours)
6. **Create `app/error.tsx` with styled fallback and reset button** — Addresses C5.
7. **Create `app/loading.tsx` and `app/blog/[slug]/loading.tsx`** — Addresses M6, P2, P12.
8. **Create `app/not-found.tsx`** — Addresses B5, ARCH-H1.
9. **Add `console.error` to all catch blocks** — Addresses H2, S8.
10. **Sanitize error messages returned to client** — Addresses S5, L4.
11. **Check `.error` on all Supabase query results** — Addresses C1, P8.

### Phase 3: Framework Alignment (Estimated effort: Small — 1-2 hours)
12. **Migrate to `next/font/google`** — Addresses B1, M3, P1, S10.
13. **Add `viewport` and `metadataBase` exports to layout** — Addresses H8, B2, ARCH-L1.
14. **Add `generateMetadata` and `generateStaticParams` to blog route** — Addresses H4, B3, B4, ARCH-H3, P6.
15. **Create `app/sitemap.ts` and `app/robots.ts`** — Addresses L3, B6.

### Phase 4: Architecture Structural Improvements (Estimated effort: Medium — 2-4 hours)
16. **Create `lib/types.ts` with shared `Post`, `GuestbookEntry`, `CookieToSet` types** — Addresses H1, B11, B12.
17. **Generate Supabase types: `npx supabase gen types`** — Addresses H1.
18. **Create data access layer under `lib/data/`** — Addresses ARCH-C1.
19. **Move `<Nav />` and `<Footer />` into `app/layout.tsx`** — Addresses ARCH-M1.
20. **Create `lib/constants.ts` with `SITE_CONFIG` and `SECTION_IDS`** — Addresses H5, M5.
21. **Create `lib/supabase/env.ts` with `requireEnv()`** — Addresses ARCH-M4, S6, S16.

### Phase 5: DevOps Foundation (Estimated effort: Medium — 2-3 hours)
22. **Create `.env.local.example`** — Addresses D1, DEVOP-C3, B17.
23. **Run `npm install` and commit `package-lock.json`** — Addresses DEVOP-C2.
24. **Create `.github/workflows/ci.yml`** — Addresses DEVOP-C1, T5.
25. **Add `engines` field to `package.json`** — Addresses DEVOP-L3.
26. **Create `vercel.json` with security headers and cache rules** — Addresses DEVOP-M1.

### Phase 6: Observability (Estimated effort: Medium — 1-2 hours)
27. **Create `lib/logger.ts` with structured JSON logging** — Addresses DEVOP-H2.
28. **Create `app/api/health/route.ts`** — Addresses DEVOP-H3.
29. **Integrate `@vercel/analytics` and `@vercel/speed-insights`** — Addresses DEVOP-L2.
30. **Add Sentry or structured console.error fallback** — Addresses DEVOP-H1.

### Phase 7: Testing Foundation (Estimated effort: Large — 4-8 hours)
31. **Install Vitest + @testing-library/react + Playwright** — Addresses C4, T1, T2.
32. **Create `vitest.config.ts` with jsdom environment** — Addresses T2.
33. **Write tests for server actions (highest risk code)** — Addresses T1.
34. **Write E2E tests for critical user flows** — Addresses T3.
35. **Set up local Supabase with `npx supabase init && npx supabase start`** — Addresses T4, DEVOP-C4.

### Phase 8: Documentation & Polish (Estimated effort: Medium — 2-3 hours)
36. **Add JSDoc to all exported functions** — Addresses D2.
37. **Create `docs/api.md` and `docs/architecture.md`** — Addresses D3, D4.
38. **Fix README content editing instructions** — Addresses D5.
39. **Document `supabase/schema.sql` with column-level and RLS comments** — Addresses D6.
40. **Add LICENSE file** — Addresses D11.
41. **Create `CONTRIBUTING.md`** — Addresses D9.

### Phase 9: Long-term Improvements (Estimated effort: Large — ongoing)
42. **Add dark mode via `prefers-color-scheme` media query** — Addresses L2.
43. **Migrate `<img>` to `next/image`** — Addresses P7, B16.
44. **Add Suspense streaming to home page** — Addresses ARCH-C2.
45. **Add database indexes** — Addresses P5.
46. **Upgrade `@supabase/ssr` to latest** — Addresses B8.
47. **Upgrade `typescript` and `react` to latest** — Addresses B25.
48. **Consider CSS Modules or Tailwind** — Addresses B15, M1.

### Quick Wins (Highest ROI, Lowest Effort — 30 minutes total)
- **Add `app/error.tsx`** — 10 lines, prevents full-page crashes
- **Add `app/loading.tsx`** — 8 lines, improves perceived performance
- **Create `lib/types.ts`** — eliminates 3 duplicated type definitions
- **Add `export const viewport` in layout** — 5 lines, fixes mobile rendering
- **Create `.env.local.example`** — 4 lines, unblocks onboarding
- **Commit `package-lock.json`** — `npm install && git add package-lock.json`
- **Add `engines` field to `package.json`** — 3 lines

### Defense-in-Depth Maturity Assessment

| Layer | Current Status | Gap |
|-------|---------------|-----|
| CSRF Protection | MISSING | Server actions via onClick bypass Next.js CSRF |
| Rate Limiting | MISSING | No throttling on any endpoint |
| Input Validation | MINIMAL | String length only; no email/format/content validation |
| Output Encoding | PRESENT | React JSX auto-escapes (but no input sanitization) |
| Security Headers | MISSING | No CSP, HSTS, X-Frame-Options, etc. |
| Error Handling | WEAK | Raw errors returned to client; silent catch blocks |
| Logging/Monitoring | MISSING | No structured logging; no alerting |
| AuthN/AuthZ | MINIMAL | RLS with public anon key; no authenticated routes |
| Dependency Scanning | CLEAN | 0 known CVEs in npm audit |
| Configuration | MINIMAL | No production hardening; missing env var validation |

### Operational Maturity Scorecard

| Capability | Score | Max | Notes |
|-----------|-------|-----|-------|
| CI/CD Pipeline | 0 | 20 | No pipeline exists |
| Automated Testing Gates | 0 | 15 | No tests |
| IaC (Infrastructure as Code) | 1 | 15 | Only `supabase/schema.sql` (one-shot, not versioned) |
| Deployment Strategy | 4 | 10 | Vercel auto-deploy works but no staged rollout, no rollback script |
| Monitoring & Observability | 0 | 10 | No logging, metrics, alerting, or error tracking |
| Incident Response | 0 | 10 | No runbooks, no on-call, no documented recovery procedures |
| Environment Management | 2 | 10 | `.env.local` exists locally; no separation, no .env.example |
| Secret Management | 3 | 5 | Env vars used correctly; no validation, no rotation docs |
| Dependency Management | 2 | 5 | No lock file, no Dependabot |
| **TOTAL** | **12** | **100** | |

## Architectural Commendations

The following patterns demonstrate good practices that should be preserved:

1. **Server/Client Component boundary is well-chosen.** Data-fetching runs server-side; interactive components (`Hero`, `Guestbook`, `Contact`) run client-side with `'use client'` directives.
2. **Parallel data fetching with `Promise.all`.** Home page fetches three independent Supabase queries concurrently, avoiding the common request-waterfall anti-pattern.
3. **ISR with appropriate revalidation windows.** `revalidate = 30` (home) and `revalidate = 60` (blog posts) are reasonable values with intentional differentiation.
4. **Supabase `@supabase/ssr` cookie-handling pattern.** Correct use of `cookies()` API with `getAll`/`setAll` and `request.cookies`/`response.cookies` across server/middleware boundaries.
5. **Optimistic UI updates with rollback.** Guestbook component inserts an optimistic entry then removes it on server error, providing instant feedback with consistency.
6. **Clean directory structure.** One component per file, descriptive naming, proper separation of server infrastructure from UI.
7. **TypeScript strict mode enabled.** Demonstrates good architectural discipline for an early-stage project.
8. **Minimal dependency footprint.** Only 4 production dependencies — aligns with YAGNI principle.

## Review Metadata
- Review date: 2026-05-20
- Phases completed: 5/5
- Flags applied: none
- Files reviewed: 19 source files across app router, components, lib, middleware, and config
- npm audit: 0 known vulnerabilities across 68 packages
