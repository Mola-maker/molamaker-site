# Code Quality & Architecture Review

**Project:** molamaker-site  
**Stack:** Next.js 15.5 + React 19 + Supabase + TypeScript 5.6  
**Review date:** 2026-05-20  
**Files reviewed:** 19 source files across app router, components, lib, and config  

---

## Code Quality Findings

---

### CRITICAL

#### C1 -- Missing error handling for Supabase query failures

**Files:** `app/page.tsx` (lines 16--30), `app/blog/[slug]/page.tsx` (lines 14--23)  
**Severity:** CRITICAL

All three Supabase queries in the home page are destructured with `?? []` or `?? 1247` to handle null data, but **errors are completely ignored** (`postsRes.error`, `entriesRes.error`, `viewsRes.error` are never checked). If Supabase is unreachable, the page renders silently with zero posts and zero guestbook entries, giving the user no indication something went wrong.

Similarly, `app/blog/[slug]/page.tsx` runs `supabase.rpc('increment_view')` without checking its return value, and the post query (line 19) proceeds regardless of whether the RPC succeeded.

**Fix:**

```typescript
// In app/page.tsx -- add error detection:
const [postsRes, entriesRes, viewsRes] = await Promise.all([/* ... */]);

const errors = [postsRes.error, entriesRes.error, viewsRes.error]
  .filter(Boolean)
  .map((e) => e?.message);
```

Create a shared loading/error pattern, or use Next.js `error.tsx` boundaries with a fallback component. At minimum:

```typescript
if (postsRes.error) {
  console.error('[Home] Failed to load posts:', postsRes.error);
}
```

---

#### C2 -- No CSRF protection on server actions

**File:** `app/actions.ts` (lines 6--36)  
**Severity:** CRITICAL

The `signGuestbook` and `sendContact` server actions accept arbitrary POST-equivalent submissions from any origin. Next.js Server Actions include a built-in CSRF check only when called via `action` prop on a `<form>` -- but the guestbook and contact components invoke these imperatively (via `onClick` handler calling the action function directly), which **bypasses Next.js's automatic CSRF protection**.

**Fix:** Either:
1. Convert to traditional `<form action={...}>` + `useActionState` pattern, which Next.js protects automatically.
2. Manually inject and verify a CSRF token via `next/headers` + `cookies()`.

```typescript
// Option 1 -- preferred approach:
'use client';
import { useActionState } from 'react';
import { signGuestbook } from '@/app/actions';

// In the form:
<form action={signGuestbook}>
  <input name="name" />
  <textarea name="message" />
  <button type="submit">Sign</button>
</form>
```

---

#### C3 -- No rate limiting on form submission endpoints

**Files:** `app/actions.ts` (lines 6--36), `app/api/views/route.ts` (lines 4--16)  
**Severity:** CRITICAL

None of the mutation endpoints (guestbook sign, contact form, page view tracking) have **any rate limiting**. This makes the site trivially vulnerable to:
- Guestbook spam floods
- Contact form abuse
- Artificially inflated page view counts
- Supabase quota exhaustion (free tier has row limits)

**Fix:** Implement a lightweight rate limiter. For a personal site without Redis, a simple in-memory token-bucket or Supabase table-based approach:

```typescript
// lib/rate-limit.ts
const buckets = new Map<string, { tokens: number; lastRefill: number }>();

export function checkRateLimit(
  key: string,
  maxTokens = 5,
  refillMs = 60000
): boolean {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: maxTokens - 1, lastRefill: now };
    buckets.set(key, bucket);
    return true;
  }
  const elapsed = now - bucket.lastRefill;
  bucket.tokens = Math.min(maxTokens, bucket.tokens + elapsed / refillMs * maxTokens);
  bucket.lastRefill = now;
  if (bucket.tokens < 1) return false;
  bucket.tokens--;
  return true;
}
```

At minimum, extract the client IP from `next/headers` and gate form actions. For production, use Upstash Redis + `@upstash/ratelimit`.

---

#### C4 -- Zero test coverage

**Files:** Entire project (no `*.test.ts`, `*.spec.ts`, `__tests__/` directory)  
**Severity:** CRITICAL

The project has **no tests of any kind** -- no unit tests, no integration tests, no E2E tests. This violates the project's own 80% coverage requirement from the global testing rules. Every server action, data-fetching path, and client component is untested.

**Fix:** Add a testing framework. For this stack, the recommended setup:

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom playwright
```

Start with:
1. Unit tests for `lib/supabase/*.ts` client factories
2. Integration tests for `app/actions.ts` server actions
3. Component smoke tests for `Guestbook`, `Contact`, `Hero`
4. E2E with Playwright for the home page + blog post page

---

#### C5 -- No error boundary wrapping the app tree

**Files:** `app/layout.tsx` (line 14)  
**Severity:** CRITICAL

If any client component throws during render (e.g., `Hero`, `Guestbook`, `Contact`), the entire page crashes to Next.js's default unhandled-error page. There is no `error.tsx` at the root level or at any route segment level.

**Fix:** Add `app/error.tsx` for a graceful fallback:

```typescript
// app/error.tsx
'use client';
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ padding: '120px 32px', textAlign: 'center' }}>
      <h2>Something went wrong</h2>
      <p style={{ color: 'var(--ink-soft)' }}>{error.message}</p>
      <button onClick={reset} className="send">Try again</button>
    </div>
  );
}
```

---

### HIGH

---

#### H1 -- Duplicate type definitions across files

**Files:**
- `CookieToSet` duplicated in `lib/supabase/server.ts` (line 4) and `lib/supabase/middleware.ts` (line 4)
- `Post` type defined in `components/writing.tsx` (lines 1--7) without sharing with `app/blog/[slug]/page.tsx`
- `Entry` type defined in `components/guestbook.tsx` (lines 5--10) without sharing with `app/page.tsx`

**Severity:** HIGH

Duplicate type definitions drift over time and create maintenance burden. If the Supabase schema changes, you have to update the type in multiple places.

**Fix:** Create a shared types module:

```typescript
// lib/types.ts
export interface Post {
  slug: string;
  title: string;
  published_at: string;
  read_time: number;
  view_count: number;
  excerpt?: string | null;
  content?: string | null;
}

export interface GuestbookEntry {
  id: string;
  name: string;
  message: string;
  created_at: string;
}

export interface CookieToSet {
  name: string;
  value: string;
  options: import('@supabase/ssr').CookieOptions;
}
```

Better yet, generate types from the Supabase database schema:

```bash
npx supabase gen types typescript --linked > lib/database.types.ts
```

---

#### H2 -- Empty catch block swallows all errors in API route

**File:** `app/api/views/route.ts` (line 13)  
**Severity:** HIGH

```typescript
} catch {
  return NextResponse.json({ ok: false }, { status: 500 });
}
```

This catch completely discards the error object. There is no logging, no Sentry/crash reporting integration, and no visibility into why the view tracking failed. Failures will be invisible indefinitely.

**Fix:**

```typescript
} catch (error: unknown) {
  console.error('[views] Failed to record page view:', error);
  return NextResponse.json(
    { ok: false, error: 'Internal server error' },
    { status: 500 }
  );
}
```

Add structured logging or a lightweight observability hook.

---

#### H3 -- Middleware analytics fetch reliability on Edge Runtime

**File:** `middleware.ts` (lines 4--18)  
**Severity:** HIGH

The middleware issues a fire-and-forget `fetch` to `/api/views` on every page navigation. Two concerns:

1. **Edge Runtime compatibility**: Next.js Middleware runs on the Edge Runtime by default. Edge `fetch` has different semantics for keep-alive connections. The floating promise with `.catch(() => {})` may behave unexpectedly in Edge.

2. **Self-referential endpoint call**: The middleware calls `/api/views` which the middleware itself will intercept on the next pass (though filtered by the `/api` check). Still, this creates an extra internal hop for every page view.

3. **No timeout**: If the `/api/views` endpoint hangs, the floating promise may keep the middleware alive past its intended lifetime.

**Fix:** Use `waitUntil` if available (Next.js 15+ on Vercel), or consider using `fetch` with an `AbortSignal` timeout:

```typescript
const controller = new AbortController();
setTimeout(() => controller.abort(), 3000);
fetch(new URL('/api/views', request.url), {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ path }),
  signal: controller.signal,
}).catch(() => {});
```

Alternatively, consider tracking views via a lightweight edge function or a dedicated analytics backend rather than a self-referential API route.

---

#### H4 -- Missing per-page SEO metadata

**File:** `app/blog/[slug]/page.tsx` (lines 8--65)  
**Severity:** HIGH

Blog post pages have **no metadata export**, meaning every post gets the generic site title/description from the root layout. Search engines see duplicate titles across all posts, and social sharing cards show no post-specific content.

**Fix:** Add dynamic metadata generation:

```typescript
// app/blog/[slug]/page.tsx
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: post } = await supabase
    .from('posts')
    .select('title, excerpt')
    .eq('slug', slug)
    .single();

  if (!post) return { title: 'Not Found' };

  return {
    title: post.title,
    description: post.excerpt ?? undefined,
    openGraph: {
      title: post.title,
      description: post.excerpt ?? undefined,
      type: 'article',
    },
  };
}
```

Also add `metadataBase` to the root layout to resolve relative URLs in OG images.

---

#### H5 -- Hardcoded external image URLs

**Files:** `components/nav.tsx` (line 8), `components/about.tsx` (line 30)  
**Severity:** HIGH

The GitHub avatar URL `https://avatars.githubusercontent.com/u/229602071?v=4` is hardcoded in two places. If the avatar changes, both must be updated. More critically, this creates a runtime dependency on GitHub's CDN -- if GitHub is blocked or the account changes, the site loses its image with no fallback.

**Fix:** Extract to a shared constant or environment variable:

```typescript
// lib/constants.ts
export const SITE_CONFIG = {
  avatarUrl: process.env.NEXT_PUBLIC_AVATAR_URL
    ?? 'https://avatars.githubusercontent.com/u/229602071?v=4',
  githubUsername: 'Mola-maker',
} as const;
```

Also add an `alt` text fallback and consider self-hosting the avatar via `next/image` with the existing `remotePatterns` config.

---

#### H6 -- Input validation relies solely on string length trimming

**Files:** `app/actions.ts` (lines 6--36), `components/contact.tsx` (lines 17--33)  
**Severity:** HIGH

Server actions validate only by trimming and slicing strings. There is:
- No email format validation (the `email` field in `sendContact` accepts any string)
- No content sanitization against XSS
- No profanity/spam filtering
- No duplicate-detection logic for guestbook entries

**Fix:** Add a lightweight validation layer. For a small project, a simple helper suffices:

```typescript
// lib/validation.ts
const SAFE_TEXT_RE = /^[\w\s.,!?'"@#&()\-\u{1F300}-\u{1F9FF}]*$/u;

export function validateMessage(input: unknown, maxLen: number): string | null {
  const s = String(input ?? '').trim();
  if (!s) return null;
  if (s.length > maxLen) return null;
  if (!SAFE_TEXT_RE.test(s)) return null;
  return s;
}

export function validateEmail(input: unknown): string | null {
  const s = String(input ?? '').trim().toLowerCase();
  if (!s || s.length > 200) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return null;
  return s;
}
```

---

#### H7 -- Simulated live-reader counter is misleading

**File:** `components/hero.tsx` (lines 7--12)  
**Severity:** HIGH (UX concern -- trustworthiness)

```typescript
const [live, setLive] = useState(3);
useEffect(() => {
  const id = setInterval(() => {
    setLive((n) => Math.max(1, n + (Math.random() > 0.5 ? 1 : -1)));
  }, 4000);
  return () => clearInterval(id);
}, []);
```

This is labeled "reading now" to users but is a pure random walk with no connection to actual readership. On a portfolio site where credibility matters, a simulated metric undermines trust. It also violates the principle of truthful UX.

**Fix:** Either:
1. Remove the counter entirely -- replace with a static statistic that is verifiable.
2. Wire it to a real data source (e.g., a Supabase realtime subscription on active sessions).
3. If keeping a decorative element, label it honestly (e.g., "approx activity" with a tooltip).

---

#### H8 -- Missing viewport metadata export

**File:** `app/layout.tsx` (lines 1--31)  
**Severity:** HIGH

Next.js 15 requires the `viewport` object to be exported separately from `metadata`. The layout only exports `metadata` without `viewport`, which may cause the default viewport settings to apply, potentially breaking responsive behavior on mobile devices.

**Fix:**

```typescript
import type { Metadata, Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#F5F1EB',
};
```

---

### MEDIUM

---

#### M1 -- Inline styles mixed with CSS classes on blog post page

**File:** `app/blog/[slug]/page.tsx` (lines 31, 41, 43, 47--52, 55)  
**Severity:** MEDIUM

The blog post page uses inline `style={{}}` objects for layout-critical styles (padding, max-width, font-size, line-height) while the rest of the project uses the global CSS file. This mixing makes the blog post harder to restyle consistently and bypasses the CSS cascade.

**Fix:** Extract blog-specific styles into `app/globals.css` under a `.prose` or `.post-body` class:

```css
/* globals.css */
article.post-body {
  padding: 80px 0;
  max-width: 68ch;
  margin: 0 auto;
}
.post-body h1.display { max-width: none; }
.post-body .content {
  color: var(--ink-2);
  font-size: 17px;
  line-height: 1.7;
  white-space: pre-wrap;
}
```

Then use `<article className="post-body">` in the component.

---

#### M2 -- setTimeout without cleanup in contact form

**File:** `components/contact.tsx` (line 31)  
**Severity:** MEDIUM

```typescript
setTimeout(() => setOk(false), 5000);
```

If the user navigates away from the page within 5 seconds of a successful submission, this `setTimeout` callback will attempt to call `setOk(false)` on an unmounted component. React 18+ does not warn about this, but in React 19 with strict mode it could surface.

**Fix:**

```typescript
const [showSuccess, setShowSuccess] = useState(false);

useEffect(() => {
  if (!showSuccess) return;
  const id = setTimeout(() => setShowSuccess(false), 5000);
  return () => clearTimeout(id);
}, [showSuccess]);
```

---

#### M3 -- Google Fonts loaded via `<link>` instead of `next/font/google`

**File:** `app/layout.tsx` (lines 21--27)  
**Severity:** MEDIUM

The layout uses raw `<link>` tags inside a manual `<head>` element to load Google Fonts. Next.js provides `next/font/google` which:
- Self-hosts fonts at build time (no runtime Google dependency)
- Eliminates layout shift from font swap
- Automatically optimizes with `font-display: swap`
- Deduplicates and subsets the font payload

**Fix:**

```typescript
import { Fraunces, DM_Sans, JetBrains_Mono } from 'next/font/google';

const fraunces = Fraunces({
  subsets: ['latin'],
  axes: ['opsz'],
  style: ['italic', 'normal'],
  display: 'swap',
  variable: '--font-fraunces',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  display: 'swap',
  variable: '--font-dm-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-mono',
});
```

Then reference the CSS variables in `globals.css` and remove the manual `<head>` block (Next.js manages `<head>` automatically).

---

#### M4 -- Redundant middleware path filtering

**File:** `middleware.ts` (lines 7--11)  
**Severity:** MEDIUM

The middleware manually checks `path.startsWith('/_next')`, `path.startsWith('/api')`, and `path.includes('.')` **in addition to** the `config.matcher` (line 21--23) which already excludes `_next/static`, `_next/image`, and `favicon.ico`. The manual filter and the config matcher serve overlapping purposes.

The manual filter also explicitly excludes `/api` -- this prevents the view-tracking from being double-counted since the middleware itself calls `/api/views`. However, this means **other** API routes also skip tracking, which may or may not be intended.

**Fix:** Clarify intent. Either rely on the config matcher exclusively, or add the explicit exclusions to the matcher itself:

```typescript
export const config = {
  matcher: [
    '/((?!_next|api|favicon.ico|.*\\.).*)',
  ],
};
```

This eliminates the need for the runtime checks in the middleware body.

---

#### M5 -- Section IDs hardcoded in both nav and section components

**Files:** `components/nav.tsx` (lines 14--18), multiple section components  
**Severity:** MEDIUM

The navigation links reference `#about`, `#work`, `#writing`, `#guestbook`, `#contact` and each section component independently sets its `id` attribute. If a section ID is renamed in one place but not the other, the nav link silently breaks with no compile-time error.

**Fix:** Centralize section identifiers:

```typescript
// lib/constants.ts
export const SECTION_IDS = {
  top: 'top',
  about: 'about',
  work: 'work',
  writing: 'writing',
  guestbook: 'guestbook',
  contact: 'contact',
} as const;
```

Import `SECTION_IDS` in both `nav.tsx` and each section component. This gives compile-time safety.

---

#### M6 -- No loading states or Suspense boundaries

**Files:** `app/page.tsx`, `app/blog/[slug]/page.tsx`  
**Severity:** MEDIUM

Neither the home page nor the blog post page has a `loading.tsx` file. On slow connections or during ISR cache misses, the user sees a blank page until the server response completes. Next.js automatically wraps pages in Suspense when `loading.tsx` is present.

**Fix:** Create simple loading skeletons:

```typescript
// app/loading.tsx
export default function Loading() {
  return (
    <main style={{ padding: '120px 32px', textAlign: 'center' }}>
      <p style={{ color: 'var(--ink-soft)' }}>Loading...</p>
    </main>
  );
}
```

---

#### M7 -- `select('*')` on blog post query fetches unnecessary columns

**File:** `app/blog/[slug]/page.tsx` (line 21)  
**Severity:** MEDIUM

```typescript
const { data: post } = await supabase
  .from('posts')
  .select('*')
  .eq('slug', slug)
  .single();
```

`select('*')` fetches every column from the `posts` table, including potentially large `content` fields even for cases where only metadata is needed. While the blog page does need `content`, specifying explicit columns is safer against future schema additions and reduces payload size.

**Fix:** Explicitly list the needed columns (consistent with `app/page.tsx` line 18 which already uses selective columns):

```typescript
.select('slug, title, published_at, read_time, view_count, excerpt, content')
```

---

### LOW

---

#### L1 -- Hardcoded color values instead of CSS custom properties

**File:** `app/globals.css` (lines 345--346)  
**Severity:** LOW

```css
.form-err {
  background: #F5D5C8; color: #8B2A1A;
}
```

These two colors are the only hardcoded hex values in the entire stylesheet (everything else uses `var(--*)`). They should be promoted to custom properties for consistency and future dark-mode support.

**Fix:**

```css
:root {
  --feedback-err-bg: #F5D5C8;
  --feedback-err-text: #8B2A1A;
}
.form-err {
  background: var(--feedback-err-bg);
  color: var(--feedback-err-text);
}
```

---

#### L2 -- No dark mode support

**File:** `app/globals.css` (lines 1--361)  
**Severity:** LOW

The site is light-mode-only with no `prefers-color-scheme` media query or theme toggle. For a text-heavy journal/portfolio site, dark mode is increasingly expected by users.

**Fix:** Add a `prefers-color-scheme: dark` block. The existing color system uses semantic tokens (`--bg`, `--ink`, etc.), which makes dark mode easy to add:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #1A1817;
    --bg-elev: #242220;
    --bg-deep: #141210;
    --ink: #ECE6DC;
    --ink-2: #C4B9A9;
    --ink-soft: #8B8175;
    --rule: #3A3530;
    --accent: #D2806B;
    --accent-soft: #6B4A3C;
    --accent-deep: #E5B79E;
  }
}
```

---

#### L3 -- Missing `sitemap.ts` and `robots.ts`

**Files:** None present  
**Severity:** LOW

No sitemap or robots.txt generation, which limits search engine discoverability.

**Fix:** Add Next.js built-in support:

```typescript
// app/sitemap.ts
import type { MetadataRoute } from 'next';
import { createClient } from '@/lib/supabase/server';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();
  const { data: posts } = await supabase
    .from('posts')
    .select('slug, published_at');

  const postEntries = (posts ?? []).map((p) => ({
    url: `https://molamaker.com/blog/${p.slug}`,
    lastModified: p.published_at,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  return [
    {
      url: 'https://molamaker.com',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    ...postEntries,
  ];
}
```

---

#### L4 -- Server action error messages leak Supabase internals

**File:** `app/actions.ts` (lines 13, 33)  
**Severity:** LOW

```typescript
if (error) return { error: error.message };
```

Returns the raw Supabase error message to the client. While Supabase errors are generally safe, any database-level error (constraint violation, RLS policy rejection, etc.) could leak schema details.

**Fix:** Log the full error server-side and return a sanitized message:

```typescript
if (error) {
  console.error('[actions] Supabase error:', error);
  return { error: 'Something went wrong. Please try again.' };
}
```

---

## Summary

| Severity | Count | Key Areas |
|----------|-------|-----------|
| CRITICAL | 5 | Error handling, CSRF, rate limiting, tests, error boundary |
| HIGH | 8 | Type duplication, error swallowing, middleware reliability, SEO metadata, hardcoded URLs, validation, misleading UX, viewport |
| MEDIUM | 7 | Inline styles, setTimeout cleanup, font loading, middleware filters, section IDs, loading states, query efficiency |
| LOW | 4 | Color tokens, dark mode, sitemap/robots, error message sanitization |

### Quick Wins (highest ROI, lowest effort)

1. **Add `app/error.tsx`** - 10 lines, prevents full-page crashes (C5)
2. **Add `app/loading.tsx`** - 8 lines, improves perceived performance (M6)
3. **Create `lib/types.ts`** - eliminates 3 duplicated type definitions (H1)
4. **Add `export const viewport`** in layout - 5 lines, fixes mobile rendering (H8)
5. **Switch to `next/font/google`** - 30 lines, replaces manual `<link>` tags (M3)
6. **Add `app/sitemap.ts`** - 30 lines, improves SEO (L3)

### Structural Recommendations

1. **Extract a shared types module** (`lib/types.ts`) and generate Supabase types from the database schema.
2. **Create `lib/validation.ts`** with reusable input validation helpers.
3. **Add Vitest + Playwright** for test coverage (target: 80%).
4. **Implement a rate limiter** for all mutation endpoints -- at minimum a naive in-memory token bucket; for production, Upstash Redis + `@upstash/ratelimit`.
5. **Adopt `<form action={serverAction}>`** pattern with `useActionState` instead of imperative action calls to restore Next.js's built-in CSRF protection.
6. **Add structured logging** -- even a simple `console.error` in catch blocks is better than silent error swallowing.


---

## Architecture Findings

---

### Architecture Overview

This is a Next.js 15.5 App Router personal portfolio/journal site backed by Supabase. The site consists of a single-page portfolio (`/`) with 7 inline section components (Hero, About, Work, Writing, Guestbook, Contact, Footer) navigated via anchor links, plus one dynamic route for blog posts (`/blog/[slug]`). A middleware layer handles both Supabase session refresh and page-view analytics. Server Actions handle form mutations (guestbook sign, contact form), and ISR (`revalidate = 30`) provides data freshness on the home page.

The architecture follows a primarily flat composition model: the root page fetches all data in parallel and distributes it to presentational section components. Server Components handle data fetching; Client Components (`Hero`, `Guestbook`, `Contact`) handle interactivity and state. There is no route layout nesting beyond the root `app/layout.tsx`.

---

### CRITICAL

---

#### ARCH-C1 -- No data access layer: inline Supabase queries violate Repository Pattern

**Files:** `app/page.tsx` (lines 16--30), `app/actions.ts` (lines 11--13, 26--32), `app/blog/[slug]/page.tsx` (lines 17--23), `app/api/views/route.ts` (lines 10--11)  
**Architectural impact:** HIGH -- Prevents data source swap, makes testing impossible, scatters query logic across 4 files

Every Supabase query is written inline at the call site -- in page components, server actions, and API routes. There is no repository layer, no data-access abstraction, and no query encapsulation. This means:

1. **Zero testability**: You cannot mock the data layer to test page rendering or business logic independently from Supabase.
2. **Schema coupling**: If a table name or column changes, you must find and update every inline query across the codebase.
3. **No shared query logic**: The `posts` query shape is duplicated between `app/page.tsx` (selective columns) and `app/blog/[slug]/page.tsx` (`select('*')`). The `guestbook` query in `app/page.tsx` and the insertion in `app/actions.ts` share no common type or validation.
4. **Violates the Repository Pattern** documented in the project's own `patterns.md` rules file.

**Recommendation:** Introduce a data-access layer under `lib/data/`:

```
lib/data/
  posts.ts          -- getAll(options), getBySlug(slug), incrementView(slug)
  guestbook.ts      -- getAll(), insert(entry)
  contacts.ts       -- insert(contact)
  pageViews.ts      -- record(path)
```

Each module encapsulates Supabase client creation, query construction, and error handling. Pages and actions import from `lib/data/*` instead of calling `supabase.from(...)` directly. This also creates natural seams for unit testing and enables future data-source swaps.

---

#### ARCH-C2 -- Single monolithic page composition prevents streaming and progressive rendering

**Files:** `app/page.tsx` (lines 13--46)  
**Architectural impact:** HIGH -- Blocks all rendering until slowest query completes; no streaming

The home page fetches three independent data sources (`posts`, `guestbook`, `page_views`) in a single `Promise.all` and then renders all 7 section components synchronously. While `Promise.all` avoids a sequential waterfall, it still means:

1. **All-or-nothing rendering**: The entire page (header, hero, about, work, writing, guestbook, contact, footer) waits for the slowest Supabase query before any HTML reaches the browser. TTFB is gated on `max(posts_query_time, guestbook_query_time, views_query_time)`.
2. **No streaming**: Next.js App Router supports React Suspense boundaries for streaming HTML chunks. None are used here. A slow `guestbook` query delays the `Hero` section, even though `Hero` depends only on `viewsRes.count`.
3. **No partial shell**: There is no `loading.tsx` at the root or any nested route, so the user sees a blank page until the full server response is ready.

**Recommendation:** Adopt the Suspense streaming pattern:

```typescript
// app/page.tsx
import { Suspense } from 'react';

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Suspense fallback={<HeroSkeleton />}>
          <HeroAsync />
        </Suspense>
        <About />           {/* static -- renders immediately */}
        <Work />            {/* static */}
        <Suspense fallback={<SectionSkeleton />}>
          <WritingAsync />
        </Suspense>
        <Suspense fallback={<SectionSkeleton />}>
          <GuestbookAsync />
        </Suspense>
        <Contact />         {/* static */}
      </main>
      <Footer />
    </>
  );
}
```

Each `*Async` component does its own data fetching with `createClient()`. React streams the static shell instantly, then fills in each Suspense boundary as data arrives. This dramatically improves perceived performance and TTFB.

---

### HIGH

---

#### ARCH-H1 -- Missing Next.js App Router conventions: loading.tsx, error.tsx, not-found.tsx

**Files:** `app/loading.tsx` (absent), `app/error.tsx` (absent), `app/not-found.tsx` (absent)  
**Architectural impact:** HIGH -- Degraded user experience on errors and slow connections

The App Router provides three built-in file conventions that are entirely absent from this project:

1. **`app/loading.tsx`**: No loading skeleton renders during SSR/ISR. On a cold lambda start or slow Supabase response, users stare at a blank page.
2. **`app/error.tsx`**: No error boundary wraps the app tree. An unhandled React render error crashes the entire page to Next.js's default error overlay (or a white screen in production).
3. **`app/not-found.tsx`**: While `blog/[slug]/page.tsx` calls `notFound()`, there is no custom 404 page. Next.js shows its default "404 | This page could not be found."

Adding these three files (under 30 lines total) is the highest-ROI architectural improvement available -- it addresses code quality finding C5 and M6 while aligning with Next.js conventions.

---

#### ARCH-H2 -- Server Actions invoked imperatively via onClick, bypassing progressive enhancement

**Files:** `components/guestbook.tsx` (lines 28--53), `components/contact.tsx` (lines 17--33)  
**Architectural impact:** HIGH -- No JavaScript-less fallback; bypasses built-in CSRF protection

Both the guestbook and contact forms use controlled inputs with an `onClick` handler on a `<button>` that calls the server action function directly. This pattern:

1. **Bypasses progressive enhancement**: If JavaScript fails to load or execute, the forms are completely non-functional with zero fallback behavior.
2. **Bypasses Next.js CSRF**: The App Router's automatic CSRF check applies only to `<form action={serverAction}>` submissions. Imperative action calls via `startTransition(() => signGuestbook(fd))` skip this check entirely.
3. **Ignores HTML form semantics**: No `<form>` element exists in either component, breaking screen reader form navigation and browser autofill behavior.
4. **Duplicates infrastructure code**: Both components independently construct `FormData`, manage optimistic state, and handle rollback -- none of this logic is shared.

**Recommendation:** Convert both to native `<form>` elements with `action={serverAction}`:

```typescript
// components/guestbook.tsx
import { useActionState } from 'react';

export default function Guestbook({ entries }: { entries: Entry[] }) {
  const [state, formAction] = useActionState(signGuestbook, null);
  // state contains { ok: true } or { error: string }
  // ...
  return (
    <form action={formAction}>
      <input name="name" placeholder="Your name" maxLength={40} />
      <textarea name="message" placeholder="Say something kind..." maxLength={240} />
      <button type="submit">Sign</button>
      {state?.error && <div className="form-err">{state.error}</div>}
    </form>
  );
}
```

This restores Next.js CSRF protection, enables no-JS form submission, uses semantic HTML, and reduces client-side state management. The `useActionState` hook provides pending state and server response natively.

---

#### ARCH-H3 -- No `generateMetadata` or `generateStaticParams` on dynamic blog route

**Files:** `app/blog/[slug]/page.tsx` (lines 1--65)  
**Architectural impact:** HIGH -- SEO penalty for all blog posts; no ISR pre-generation

The blog post page has `revalidate = 60` but lacks two critical Next.js exports:

1. **`generateStaticParams`**: Without this, Next.js does not know which slugs to pre-render at build time or during ISR. Every blog post slug incurs a full server-side render on first request -- no data caching at the CDN level for post content.

2. **`generateMetadata`**: Without dynamic metadata, every blog post shares the root layout's generic `<title>` and `<meta>` tags. Search engines see duplicate titles across all posts. Social sharing (OG, Twitter cards) shows generic site info instead of post-specific content.

**Recommendation:**

```typescript
// app/blog/[slug]/page.tsx
export async function generateStaticParams() {
  const supabase = await createClient();
  const { data: posts } = await supabase
    .from('posts')
    .select('slug')
    .order('published_at', { ascending: false });
  return (posts ?? []).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: post } = await supabase
    .from('posts')
    .select('title, excerpt')
    .eq('slug', slug)
    .single();

  if (!post) return { title: 'Not Found' };

  return {
    title: post.title,
    description: post.excerpt ?? undefined,
    openGraph: {
      title: post.title,
      description: post.excerpt ?? undefined,
      type: 'article',
    },
  };
}
```

---

#### ARCH-H4 -- Middleware conflates infrastructure (session refresh) with observability (analytics)

**Files:** `middleware.ts` (lines 4--23)  
**Architectural impact:** HIGH -- Hot-path bloat; `updateSession` called on every request unnecessarily

The middleware does two things on every matched page request:
1. Fires a fire-and-forget `fetch` to `/api/views` for analytics
2. Runs `updateSession(request)` for Supabase auth session refresh

The issue is that **this site has no authenticated features**. There is no login, no protected route, no user-specific content. Calling `updateSession` (which creates a Supabase server client and calls `getUser()`) on every page navigation adds a network round-trip to Supabase for no benefit. The `@supabase/ssr` middleware pattern is designed for apps that need to maintain auth sessions across protected routes -- in a fully public site, it is pure overhead.

Additionally, the analytics ping happens on the middleware hot path. Even though it is fire-and-forget, it still constructs a `new URL()`, serializes JSON, and initiates a `fetch` on every navigation. This adds measurable latency to every request.

**Recommendation:** 
1. Remove `updateSession` from the middleware since there are no authenticated routes to protect. 
2. Move analytics tracking out of middleware entirely -- use a client-side `useEffect` in a layout or a dedicated `<Analytics />` component that fires on mount, or keep the API route but call it from the browser, not the server middleware.
3. If `updateSession` is retained for future auth plans, gate it behind a path check so it only runs on routes that actually need it.

---

### MEDIUM

---

#### ARCH-M1 -- Shared UI chrome (Nav + Footer) duplicated instead of extracted into a layout

**Files:** `app/page.tsx` (lines 33, 44), `app/blog/[slug]/page.tsx` (lines 29, 63)  
**Architectural impact:** MEDIUM -- Maintenance burden; diverging chrome over time

Both the home page and the blog post page manually render `<Nav />` and `<Footer />` in their return statements. This duplicates the import statements and JSX structure. If a new shared component is added (e.g., a cookie banner, analytics provider), it must be added to every page individually.

Next.js App Router's `layout.tsx` is designed for exactly this pattern. Since both pages share the same root layout, `Nav` and `Footer` should be moved into `app/layout.tsx`:

```typescript
// app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>...</head>
      <body>
        <Nav />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
```

This eliminates duplication and makes chrome changes automatically apply to all routes.

---

#### ARCH-M2 -- Site sections use anchor-based navigation instead of App Router route segmentation

**Files:** `components/nav.tsx` (lines 14--18), `app/page.tsx` (lines 32--45)  
**Architectural impact:** MEDIUM -- Limits future extensibility; bundles all data into one request

The site uses traditional anchor links (`#about`, `#work`, `#writing`, etc.) within a single monolithic page. This is reasonable for a compact portfolio, but has architectural implications:

1. **No code splitting per section**: All 7 section components are bundled into the initial JS payload. If the `Work` section grows to include interactive demos or heavy visualizations, they load regardless of whether the user scrolls to them.
2. **All data fetched upfront**: Three Supabase queries execute on every home page load. If `guestbook` grows to hundreds of entries or `posts` to dozens, the payload grows linearly.
3. **No independent revalidation**: ISR `revalidate = 30` applies to the entire page. There is no way to revalidate just the `Guestbook` section more frequently and the `Writing` section less frequently.

**Recommendation (for when the site outgrows the single-page model):** 
- Consider route groups: `app/(home)/about/page.tsx`, `app/(home)/work/page.tsx`, etc., each with their own `revalidate` and Suspense boundary.
- For now, the single-page approach is architecturally valid for a personal site of this scale, but the data-prefetching strategy should be documented as a known trade-off.

---

#### ARCH-M3 -- Client-side Supabase browser client defined but never used

**Files:** `lib/supabase/client.ts` (lines 1--8)  
**Architectural impact:** MEDIUM -- Dead code; unclear architectural intent

The project defines a browser Supabase client (`createBrowserClient`) in `lib/supabase/client.ts`, but **no component imports or uses it**. All data fetching happens server-side via the server client. The file sits as dead infrastructure, suggesting either:

1. The project was scaffolded from a template that included it speculatively.
2. There was a plan to add real-time subscriptions (e.g., live guestbook updates via Supabase Realtime) that was never implemented.
3. It is cargo-culted infrastructure from Supabase documentation examples.

**Recommendation:** Either remove the file as dead code, or document the intended future use. If real-time subscriptions are planned, add a comment in the file explaining when and how it will be used. Dead infrastructure code is a maintenance burden and source of confusion for future contributors.

---

#### ARCH-M4 -- No environment variable validation at application startup

**Files:** `lib/supabase/server.ts` (lines 9--10), `lib/supabase/client.ts` (lines 5--6), `lib/supabase/middleware.ts` (lines 10--11)  
**Architectural impact:** MEDIUM -- Cryptic runtime crashes if env vars are missing

All three Supabase client factories use non-null assertions (`!`) on environment variables:

```typescript
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
```

If either variable is missing (e.g., after a fresh clone without `.env.local`), the application crashes at runtime with a cryptic `TypeError` or passes `undefined` to `createServerClient`, producing opaque Supabase errors. There is zero validation, zero early failure, and zero helpful error messaging.

**Recommendation:** Add a validation guard:

```typescript
// lib/supabase/env.ts
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
      `Add it to .env.local. See .env.example for reference.`
    );
  }
  return value;
}

export const SUPABASE_URL = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
export const SUPABASE_ANON_KEY = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
```

Import these validated constants in all three client modules. The app will fail fast at import time with a clear message rather than crashing mid-request.

---

#### ARCH-M5 -- View tracking via self-referential middleware creates circular dependency

**Files:** `middleware.ts` (lines 12--16), `app/api/views/route.ts` (lines 4--16)  
**Architectural impact:** MEDIUM -- Architectural smell; tight coupling between middleware and API route

The middleware calls `fetch(new URL('/api/views', request.url), ...)` to track page views. This means every page request triggers:

```
Browser -> Next.js Middleware -> fetch /api/views -> Next.js Middleware -> API Route -> Supabase INSERT
```

The middleware filters out `/api` paths to prevent infinite recursion, but the architecture is still self-referential: the middleware depends on a route that it itself intercepts. This creates:

1. **Temporal coupling**: The `/api/views` route must exist and be functional for the middleware to work, but there is no compile-time guarantee of this dependency.
2. **Observability opacity**: Failures in the analytics pipeline are invisible to the middleware (the `.catch(() => {})` discards all errors).
3. **Testing complexity**: Testing the view-tracking behavior requires mocking the middleware + the API route + Supabase simultaneously.

**Recommendation:** Decouple view tracking from the middleware entirely. Move it to a client-side component that POSTs to `/api/views` on mount, or use a server-side analytics SDK. For the simplest fix, replace the middleware-based approach with a `<ViewTracker path={pathname} />` client component rendered in `app/layout.tsx`.

---

### LOW

---

#### ARCH-L1 -- No `metadataBase` in root layout breaks relative OpenGraph URLs

**Files:** `app/layout.tsx` (lines 4--12)  
**Architectural impact:** LOW -- Social sharing cards show incomplete metadata

The root layout exports `metadata` with `openGraph` but does not set `metadataBase`. Without it, Next.js cannot resolve relative URLs in OpenGraph tags. If you later add `openGraph.images`, the image URLs will be malformed. This is a common Next.js gotcha.

**Recommendation:**

```typescript
export const metadata: Metadata = {
  metadataBase: new URL('https://molamaker.com'),
  // ... existing metadata
};
```

---

#### ARCH-L2 -- Blog post content rendering uses `white-space: pre-wrap` with no markdown processing

**Files:** `app/blog/[slug]/page.tsx` (lines 47--52)  
**Architectural impact:** LOW -- Future limitation for content authoring

Blog post content is rendered as plain text with `white-space: pre-wrap`, preserving only newlines and spaces. There is no markdown-to-HTML conversion, no code syntax highlighting, no image rendering, and no rich content support. This is acceptable for an early-stage personal journal but will become a limitation the moment you want to include links, code blocks, images, or formatted text in a post.

**Recommendation:** When ready, integrate a markdown renderer like `react-markdown` or `next-mdx-remote` for more expressive post content. For now, document the constraint.

---

#### ARCH-L3 -- Static year in footer relies on `new Date()` runtime call

**Files:** `components/footer.tsx` (line 4)  
**Architectural impact:** LOW -- Trivial but architecturally impure for a static value

The footer uses `new Date().getFullYear()` at render time. Since `Footer` is a Server Component, this runs on every request (or once per ISR window at revalidate=30). While functionally correct, it is a dynamic expression in an otherwise static component -- meaning the server cannot fully memoize the footer's rendered output across revalidation windows.

**Recommendation:** Acceptable as-is for a personal site. Not worth changing unless optimizing for edge-cache hit rate.

---

### Architectural Commendations

The following architectural decisions demonstrate good practices that should be preserved and extended:

1. **Server/Client Component boundary is well-chosen.** Data-fetching components run on the server; interactive components (`Hero`, `Guestbook`, `Contact`) run on the client with `'use client'` directives. This is the canonical Next.js App Router pattern.

2. **Parallel data fetching with `Promise.all`.** The home page fetches three independent Supabase queries concurrently rather than sequentially. This avoids the common "request waterfall" anti-pattern where each query waits for the previous one.

3. **ISR with appropriate revalidation windows.** `revalidate = 30` on the home page and `revalidate = 60` on blog posts are reasonable values for a personal site with low update frequency. The distinction between the two (home page fresher than posts) shows intentional architectural reasoning.

4. **Supabase `@supabase/ssr` cookie-handling pattern.** The server client correctly uses the `cookies()` API with `getAll`/`setAll`, and the middleware client correctly uses `request.cookies` / `response.cookies`. This follows the official Supabase documentation pattern precisely and handles cookie propagation correctly across server/middleware boundaries.

5. **Optimistic UI updates with rollback.** The `Guestbook` component inserts an optimistic entry into state, then removes it if the server action returns an error. This is a sophisticated UI pattern that provides instant feedback while maintaining consistency with the server. The `useTransition` hook correctly gates the button disabled state.

6. **Clean directory structure.** Components are one-per-file, named descriptively, and organized under a `components/` directory. Server infrastructure (`lib/supabase/`) is separated from UI, and API routes are nested under `app/api/`. No cross-cutting concerns leak between directories.

7. **TypeScript strict mode enabled.** The `tsconfig.json` has `"strict": true`, which enables all strict type-checking options. This is not universal in early-stage projects and demonstrates good architectural discipline.

8. **Minimal dependency footprint.** The project has only 4 production dependencies (`next`, `react`, `react-dom`, `@supabase/ssr`, `@supabase/supabase-js`). No state management library, no CSS framework, no utility library -- just the essentials. This aligns with the YAGNI principle from the project's coding style rules.

---

## Architecture Summary

| Severity | Count | Key Areas |
|----------|-------|-----------|
| CRITICAL | 2 | Missing data access layer, monolithic page without streaming |
| HIGH | 4 | Missing App Router conventions, onClick server actions, missing dynamic metadata, middleware overreach |
| MEDIUM | 5 | Duplicated chrome, anchor-based navigation, dead browser client, no env validation, self-referential view tracking |
| LOW | 3 | Missing metadataBase, plain-text blog content, dynamic footer expression |

### Architecture Quick Wins (highest architectural ROI)

1. **Move `<Nav />` and `<Footer />` into `app/layout.tsx`** -- Eliminates duplication, establishes proper layout hierarchy (ARCH-M1). 5-line change.
2. **Create `app/loading.tsx` and `app/error.tsx`** -- Completes the App Router contract, prevents white-screen crashes (ARCH-H1). 20 lines total.
3. **Extract `lib/data/posts.ts` and `lib/data/guestbook.ts`** -- First step toward a data access layer, enables testing (ARCH-C1). 40 lines each.
4. **Add `generateMetadata` and `generateStaticParams` to blog route** -- Fixes SEO for all blog posts (ARCH-H3). 30 lines.
5. **Add `metadataBase` to root layout** -- Fixes OpenGraph URL resolution (ARCH-L1). 1 line.
