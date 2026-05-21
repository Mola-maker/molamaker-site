# Phase 2: Security & Performance Review

## Security Findings

### Critical
- **S-C1.** HMAC key reuse — ASTRBOT_API_KEY as crypto secret (CWE-321, CVSS 7.5) — `lib/hmac-ip.ts:3`
- **S-C2.** Unauthenticated chat history access (CWE-306, CVSS 8.6) — `app/api/chat/history/route.ts:4`
- **S-C3.** In-memory rate limiter zero protection on serverless (CWE-307, CVSS 7.5) — `lib/rate-limit.ts:1`

### High
- **S-H1.** Silent error swallowing — no security observability (CWE-778) — 6+ API/data files
- **S-H2.** Admin savePost missing input validation — stored XSS risk (CWE-20) — `app/[locale]/admin/actions.ts:14`
- **S-H3.** Content-Length spoofing — DoS vector (CWE-770) — `app/api/chat/send/route.ts:19`
- **S-H4.** BMAC webhook Node.js Buffer incompatible with Edge (CWE-676) — `app/api/webhooks/bmc/route.ts:29`
- **S-H5.** Missing RLS write policy on `pages` table (CWE-862) — `supabase/migrations/...02_pages.sql:16`
- **S-H6.** Admin slug rename delete+insert without transaction (CWE-362) — `app/[locale]/admin/actions.ts:39`
- **S-H7.** IP-derived user_id sent to third-party AstrBot (CWE-359) — `app/api/chat/send/route.ts:50`

### Medium
- **S-M1.** Missing OWNER_EMAIL startup validation (CWE-209)
- **S-M2.** `check(true)` RLS on contacts/page_views (CWE-862)
- **S-M3.** deletePost no error handling (CWE-252)
- **S-M4.** Chat history HTTP 200 on all errors (CWE-209)
- **S-M5.** Overly restrictive safeText regex for chat

### Low
- **S-L1.** djb2 non-cryptographic hash in dedup
- **S-L2.** console.error DB error leaks
- **S-L3.** Missing Cache-Control: no-store on chat routes

---

## Performance Findings

### Critical
- **P-C1.** In-memory rate limiter provides zero protection on serverless/cluster — `lib/rate-limit.ts`
- **P-C2.** In-memory Map state prevents horizontal scaling — `lib/rate-limit.ts`, `lib/dedup.ts`

### High
- **P-H1.** `getPostBySlug` reads ALL markdown files for one slug — `lib/content.ts:36`
- **P-H2.** View counter forces dynamic rendering of static blog page — `app/[locale]/blog/[slug]/page.tsx:44`
- **P-H3.** Middleware fire-and-forget fetch doubles function invocation count — `middleware.ts:16`
- **P-H4.** Three font families loaded as render-blocking CSS — `app/[locale]/layout.tsx:50`

### Medium
- **P-M1.** Missing composite index on posts(published, published_at DESC) — `supabase/schema.sql:129`
- **P-M2.** Synchronous file I/O blocks event loop — `lib/content.ts:17`
- **P-M3.** Dedup Map never cleans up under low traffic — `lib/dedup.ts:19`
- **P-M4.** Missing Cache-Control on chat API routes
- **P-M5.** NavWrapper auth check runs on every page — `components/nav-wrapper.tsx:11`
- **P-M6.** Token bucket floating-point drift — `lib/rate-limit.ts:49`
- **P-M7.** No next/dynamic for Comments/Sidebar/ChatRoom
- **P-M8.** react-markdown loaded eagerly — `app/[locale]/blog/[slug]/page.tsx:5`
- **P-M9.** ChatRoom recreates `send` callback on every keystroke — `components/chat/chat-room.tsx:90`
- **P-M10.** page_views table unbounded growth — `supabase/schema.sql:29`

### Low
- **P-L1.** Count query scans full page_views table
- **P-L2.** Stale rate-limit bucket accumulation
- **P-L3.** Chat message array unbounded client-side
- **P-L4.** Blog page missing ISR revalidate
- **P-L5.** Cursor glow repaints on every mouse move
- **P-L6.** Background dot pattern paint cost

---

## Overlap Analysis

The in-memory rate limiter appears as **S-C3**, **P-C1**, **P-C2**, and was also flagged as **C3** in Phase 1. This is the single most impactful finding across all reviews:
- Zero DoS protection on Vercel serverless
- N× limit multiplication on PM2 cluster
- Blocks horizontal scaling entirely
- Affects all rate-limited endpoints (chat, guestbook, contact, views)

**Recommended unified fix:** Postgres-backed rate limiter using Supabase `rate_limits` table with atomic `SELECT ... FOR UPDATE`.

---

## Critical Issues for Phase 3 Context

1. **In-memory rate limiter (S-C3 / P-C1 / P-C2)** — must be tested under load. Verify correct behavior with concurrent requests.
2. **Unauthenticated chat history (S-C2)** — test that session IDs can't be enumerated
3. **Admin savePost validation (S-H2)** — test with malicious FormData payloads
4. **BMAC webhook Edge compatibility (S-H4)** — test on Edge runtime
5. **View counter dynamic rendering (P-H2)** — verify blog pages can be statically generated after fix
6. **Font loading (P-H4)** — test FCP/FOIT on throttled 3G
