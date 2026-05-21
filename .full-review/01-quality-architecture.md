# Phase 1: Code Quality & Architecture Review

## Code Quality Findings

### Critical

#### C1. AstrBot API Key Reused as HMAC Secret
**Files:** `lib/hmac-ip.ts:3-5`, `app/api/chat/send/route.ts:50`

The `hashIp` function uses the AstrBot API key as an HMAC secret. If the API key is rotated, all user-to-IP mappings break and chat histories become orphaned. The same key is sent to AstrBot on every request — if logged or breached, it can reverse the IP hashing.
**Recommendation:** Use a separate `HMAC_IP_SECRET` env var for IP hashing.

#### C2. Chat History Exposed With Only Session ID
**File:** `app/api/chat/history/route.ts`

`GET /api/chat/history?sessionId=...` returns full conversation history with no authentication, IP binding, or rate limiting. The endpoint returns HTTP 200 with `{ messages: [] }` on every error path, making abuse detection impossible.
**Recommendation:** Add IP-based rate limiting and session-to-IP binding.

#### C3. In-Memory Rate Limiter Zero Protection on Serverless
**File:** `lib/rate-limit.ts`

Token-bucket state in module-level `Map`. On Vercel serverless each cold start gets empty buckets (no effective limit). On PM2 cluster, N workers = N× limit. The chat endpoints rely on this limiter.
**Recommendation:** Replace with Postgres/Redis-backed limiter or pin PM2 to 1 worker.

### High

#### H1. Silent Error Swallowing Across All API Routes
**Files:** `app/api/chat/send/route.ts:87`, `app/api/chat/history/route.ts:45`, `app/api/bot/status/route.ts:37`, `app/api/views/route.ts`, all `lib/data/*.ts`

Every API route uses empty `catch {}` blocks. Network failure, DNS failure, timeout, JSON parse error, and AstrBot schema validation failure all produce identical response with zero server-side logging.
**Recommendation:** Add structured logging. Distinguish timeout from service error in API responses.

#### H2. BMAC Webhook Uses Node.js `Buffer` Instead of Web Crypto
**File:** `app/api/webhooks/bmc/route.ts:29`

Mix of `Buffer.from(signature, 'hex')` with Web Crypto API. Will break on Edge runtime.
**Recommendation:** Use pure Web Crypto approach for hex decoding.

#### H3. Content-Length Header Trivially Spoofable
**File:** `app/api/chat/send/route.ts:19-21`

`content-length` is client-set and can be arbitrarily small. An attacker sends 10MB with `content-length: 5` and bypasses the check.
**Recommendation:** Remove the check (rely on Next.js body limits) or validate after reading body.

#### H4. Missing OWNER_EMAIL Validation at Startup
**Files:** `lib/auth.ts:27`, `components/nav-wrapper.tsx:19`

No validation that `OWNER_EMAIL` is set. Empty string could match edge cases.
**Recommendation:** Add startup env var validation. Explicitly handle missing `OWNER_EMAIL`.

#### H5. Admin `savePost` Has No Form Validation
**File:** `app/[locale]/admin/actions.ts:9-66`

Raw `FormData` values used directly in DB operations without Zod validation. `PostSchema` exists in `lib/schemas.ts` but is never imported.
**Recommendation:** Validate with `PostSchema` before inserting into DB.

### Medium
- **M1.** `savePost` function 58 lines, 3 nesting levels — extract slug rename logic
- **M2.** Inconsistent API response format across routes
- **M3.** Duplicate error message construction in ChatRoom component (3 identical blocks)
- **M4.** Duplicate time formatting logic in `guestbook.tsx` and `repo-card.tsx`
- **M5.** ChatRoom and BotStatusBadge duplicate-poll `/api/bot/status` every 60s
- **M6.** `deletePost` has no error handling
- **M7.** Chat history returns HTTP 200 on all failures
- **M8.** Chat history has no rate limiting
- **M9.** CSP uses `'unsafe-inline'` for scripts
- **M10.** Mixed use of `auth.users` and duplicate users table lookup

### Low
- **L1.** `contactSchema` email Zod ordering produces confusing errors
- **L2.** Konami component uses mutable `let` instead of `useRef`
- **L3.** Widespread `as` type casts instead of runtime validation
- **L4.** `scroll-reveal.tsx` returns `null` component
- **L5.** Hardcoded `locale === 'zh'` string comparisons
- **L6.** `error.tsx` uses extensive inline styles
- **L7.** `clientIp` function `await headers()` may be unnecessary

---

## Architecture Findings

### Critical

#### A1. Admin Page Missing Auth Guard (Defense-in-Depth)
**File:** `app/[locale]/admin/page.tsx`

The admin listing page directly queries all posts without calling `requireAdmin()`. Only the layout guards access. If layout is accidentally removed or page accessed via parallel route, data leaks.
**Recommendation:** Add `await requireAdmin()` at top of all admin pages.

### High

#### A2. Dual Blog Data Source (Markdown + Supabase Disconnected)
**Files:** `lib/content.ts`, `lib/data/posts.ts`, `app/[locale]/blog/page.tsx`, `app/[locale]/admin/actions.ts`

Admin panel manages Supabase `posts` table, but public blog reads from `content/*.md` markdown files. Creating a post via admin will NOT appear on the blog. RSS feed and sitemap only include markdown posts.
**Recommendation:** Choose one authoritative source. Either feed blog from Supabase or drop admin CRUD for posts.

#### A3. ~70% of User-Facing Text Hardcoded English
**Files:** Nearly all components and pages

Despite `en` + `zh` locale support, most text is hardcoded in English. The `zh` route shows English content with only nav/footer/chat labels translated. The i18n infrastructure exists but is substantially underutilized.
**Recommendation:** Either extract all strings to `messages/*.json` and translate, or simplify by removing `zh` locale.

#### A4. Test Coverage ~10-15%
**Files:** `test/` directory (4 test files for 70+ source files)

Missing tests for: data layer, auth guards, content parsing, dedup, client-ip, hmac-ip, chat API routes, webhook handler, E2E flows.
**Recommendation:** Prioritize data layer → auth → API routes → server actions.

### Medium
- **A5.** Sitemap only covers blog posts (not about, work, projects, chat, etc.)
- **A6.** Inconsistent env var access — `static.ts` uses `process.env` directly, others use `env.ts`
- **A7.** Duplicate project data in `work/page.tsx` and `components/work.tsx`
- **A8.** Chat send 5s timeout may be too short for LLM-backed bot
- **A9.** Auth callback locale detection fragile (no `Accept-Language` fallback)
- **A10.** Missing RLS write policy on `pages` table (potential bug — `updatePage` calls `upsert` with anon key)
- **A11.** `contacts` and `page_views` RLS `check(true)` weak
- **A12.** Duplicate Zod schemas — `lib/validation.ts` vs `lib/schemas.ts`
- **A13.** CSP `'unsafe-inline'` for scripts (needed for giscus, but weakens XSS defense)
- **A14.** Inconsistent API response formats across routes

### Low
- **A15.** Footer could be Server Component
- **A16.** `annotation-sidebar-wrapper.tsx` thin boilerplate
- **A17.** `writing.tsx` uses `<a>` instead of i18n-aware `<Link>`
- **A18.** Schema duplication (`schema.sql` vs migrations)
- **A19.** `console.error` unconditional in data layer
- **A20.** Page layout pattern inconsistency across pages
- **A21.** No CSP entry for AstrBot origin (if future direct connection planned)

---

## Critical Issues for Phase 2 Context

These findings directly affect the security and performance review:

1. **HMAC key reuse (C1)** — authentication credential repurposed as crypto derivation secret
2. **Chat history without auth (C2)** — unauthenticated conversation access
3. **In-memory rate limiter (C3)** — zero DoS protection on serverless
4. **Silent error swallowing (H1)** — no observability for security events
5. **Content-Length spoofing (H3)** — DoS vector
6. **Admin auth guard missing (A1)** — defense-in-depth gap
7. **CSP `'unsafe-inline'` (M9)** — weakened XSS defense
8. **Missing RLS write policy on pages (A10)** — potential unauthorized data access
9. **Chat send 5s timeout (A8)** — performance concern for LLM-backed responses
