# Phase 2: Security & Performance Review

**Project:** molamaker-site
**Stack:** Next.js 15.5 + React 19 + Supabase + TypeScript 5.6
**Review date:** 2026-05-20
**Dependencies audited:** npm audit -- 0 known vulnerabilities across 68 packages (26 prod, 6 dev, 37 optional)

---

## Security Findings

---

### CRITICAL

---

#### S1 -- No CSRF Protection on Mutation Endpoints (Server Actions via onClick Bypass Next.js CSRF)

**Files:**
- `components/guestbook.tsx` lines 28--53 (submit handler + `onClick={submit}` on line 79)
- `components/contact.tsx` lines 17--33 (submit handler + `onClick={submit}` on line 71)
- `app/actions.ts` lines 6--36 (server action implementations)

**Severity:** CRITICAL
**CVSS:** 8.1 (AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:H/A:H)
**CWE:** CWE-352 (Cross-Site Request Forgery)

**Description:**

Next.js App Router includes automatic CSRF protection for Server Actions, but **only when they are invoked through the native `<form action={serverAction}>` pattern**. The project's guestbook and contact forms call server actions imperatively via `onClick` handlers on `<button>` elements:

```typescript
// components/guestbook.tsx line 79
<button className="send" onClick={submit} disabled={pending || !message.trim()}>
```

This completely bypasses Next.js's built-in CSRF token verification. Any third-party website can craft a form that targets the site's server action endpoints and trigger guestbook signings or contact form submissions on behalf of a visiting user.

**Attack scenario:**

1. Attacker crafts a malicious page on `evil.example.com` that contains a hidden form targeting `https://molamaker.com`
2. The form auto-submits via JavaScript, constructing a `FormData`-equivalent POST to the server action endpoint
3. Because there is no CSRF token check for imperative action calls, the submission succeeds
4. Attacker can flood the guestbook with spam entries or abuse the contact form

**Remediation:**

Convert both forms to use the native `<form action={serverAction}>` pattern with `useActionState`:

```typescript
// components/guestbook.tsx -- refactored
'use client';
import { useActionState, useState } from 'react';
import { signGuestbook } from '@/app/actions';

type Entry = { id: string; name: string; message: string; created_at: string };

export default function Guestbook({ entries }: { entries: Entry[] }) {
  const [list, setList] = useState<Entry[]>(entries);
  const [state, formAction, pending] = useActionState(signGuestbook, null);

  // Handle optimistic updates and rollback
  // ... (use state.ok / state.error from the action return)

  return (
    <section id="guestbook">
      <form action={formAction} className="guestbook-form">
        <input name="name" placeholder="Your name" maxLength={40} />
        <textarea name="message" placeholder="Say something kind..." maxLength={240} rows={1} />
        <button className="send" type="submit" disabled={pending}>
          {pending ? 'Signing...' : 'Sign'}
        </button>
      </form>
      {state?.error && <div className="form-err">{state.error}</div>}
    </section>
  );
}
```

The server action already accepts `FormData` -- no changes needed there. `useActionState` is the React 19 API (renamed from `useFormState`).

---

#### S2 -- No Rate Limiting on Any Mutation Endpoint

**Files:**
- `app/actions.ts` (guestbook signing at lines 6--17, contact form at lines 19--36)
- `app/api/views/route.ts` (page view tracking at lines 4--16)

**Severity:** CRITICAL
**CVSS:** 7.5 (AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H)
**CWE:** CWE-770 (Allocation of Resources Without Limits or Throttling)

**Description:**

All three mutation endpoints have **zero rate limiting**. An attacker can:

1. **Guestbook spam flood**: POST thousands of entries per minute, filling the Supabase free tier (500MB limit)
2. **Contact form abuse**: Submit unlimited contact messages
3. **View count inflation**: POST unlimited fake page views via `curl` loop

**Proof of concept:**

```bash
# Inflate view count trivially
for i in $(seq 1 10000); do
  curl -s -X POST http://localhost:3000/api/views \
    -H 'content-type: application/json' \
    -d '{"path":"/"}'
done
```

**Remediation:**

Implement a lightweight in-memory rate limiter:

```typescript
// lib/rate-limit.ts
import { headers } from 'next/headers';

interface Bucket { tokens: number; lastRefill: number; }
const buckets = new Map<string, Bucket>();

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now - bucket.lastRefill > 300_000) buckets.delete(key);
  }
}, 300_000).unref();

export async function checkRateLimit(key: string, maxTokens = 5, windowMs = 60_000): Promise<boolean> {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: maxTokens - 1, lastRefill: now };
    buckets.set(key, bucket);
    return true;
  }
  const elapsed = now - bucket.lastRefill;
  bucket.tokens = Math.min(maxTokens, bucket.tokens + (elapsed / windowMs) * maxTokens);
  bucket.lastRefill = now;
  if (bucket.tokens < 1) return false;
  bucket.tokens -= 1;
  return true;
}

export async function getClientFingerprint(): Promise<string> {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown';
}
```

Apply in server actions:

```typescript
// app/actions.ts
import { checkRateLimit, getClientFingerprint } from '@/lib/rate-limit';

export async function signGuestbook(formData: FormData) {
  const ip = await getClientFingerprint();
  if (!(await checkRateLimit(`guestbook:${ip}`, 3, 60_000))) {
    return { error: 'Too many submissions. Please wait a moment.' };
  }
  // ... existing logic ...
}
```

---

#### S3 -- Missing Input Validation Beyond String Length Trimming

**Files:**
- `app/actions.ts` lines 7--8 (guestbook: name/message trimmed + sliced only)
- `app/actions.ts` lines 19--23 (contact: all fields trimmed only; no email format check)
- `components/guestbook.tsx` lines 65--70 (client-side maxLength only)
- `components/contact.tsx` lines 45--56 (no email validation whatsoever)

**Severity:** CRITICAL
**CVSS:** 6.5 (AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N)
**CWE:** CWE-20 (Improper Input Validation)

**Description:**

The server actions perform only the most minimal validation -- `.trim()` and `.slice()`:

```typescript
const name  = String(formData.get('name') || '').trim().slice(0, 40) || 'anon';
const email = String(formData.get('email') || '').trim().slice(0, 200);
```

There is:
- **No email format validation**: Any string passes as an "email" address, storing garbage data
- **No content sanitization**: HTML/script tags pass through unchecked (latent XSS risk)
- **No profanity/spam filtering**: Guestbook trivially exploitable for spam
- **No duplicate detection**: Identical submissions can be made repeatedly

**Remediation:**

Create a dedicated validation module:

```typescript
// lib/validation.ts
const SAFE_TEXT_RE = /^[\p{L}\p{N}\p{P}\p{Z}\p{Emoji_Presentation}]*$/u;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface ValidationResult {
  valid: boolean;
  value?: string;
  error?: string;
}

export function validateName(input: unknown, maxLen = 40): ValidationResult {
  const s = String(input ?? '').trim();
  if (!s) return { valid: false, error: 'Name is required.' };
  if (s.length > maxLen) return { valid: false, error: `Name must be under ${maxLen} characters.` };
  if (!SAFE_TEXT_RE.test(s)) return { valid: false, error: 'Name contains invalid characters.' };
  return { valid: true, value: s };
}

export function validateMessage(input: unknown, maxLen = 240): ValidationResult {
  const s = String(input ?? '').trim();
  if (!s) return { valid: false, error: 'Message is required.' };
  if (s.length > maxLen) return { valid: false, error: `Message must be under ${maxLen} characters.` };
  if (!SAFE_TEXT_RE.test(s)) return { valid: false, error: 'Message contains invalid characters.' };
  return { valid: true, value: s };
}

export function validateEmail(input: unknown): ValidationResult {
  if (input === null || input === undefined || input === '') {
    return { valid: true, value: undefined }; // email is optional
  }
  const s = String(input).trim().toLowerCase();
  if (s.length > 200) return { valid: false, error: 'Email address is too long.' };
  if (!EMAIL_RE.test(s)) return { valid: false, error: 'Invalid email address.' };
  return { valid: true, value: s };
}
```

---

### HIGH

---

#### S4 -- Missing Security Headers (CSP, HSTS, X-Frame-Options, etc.)

**Files:**
- `next.config.mjs` lines 1--9 (no `headers()` configuration)
- `app/layout.tsx` lines 4--12 (no metadata security properties)

**Severity:** HIGH
**CVSS:** 6.1 (AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:N)
**CWE:** CWE-693 (Protection Mechanism Failure)

**Description:**

The application does not set any security-critical HTTP headers:

| Missing Header | Risk |
|---|---|
| `Content-Security-Policy` | XSS protection; script/style origin control |
| `Strict-Transport-Security` | Downgrade attack protection |
| `X-Content-Type-Options` | MIME type sniffing prevention |
| `X-Frame-Options` | Clickjacking prevention |
| `Referrer-Policy` | Referrer leakage control |
| `Permissions-Policy` | Browser feature restriction |

Without `X-Frame-Options: DENY`, an attacker can embed the site in an iframe and perform clickjacking. Without CSP, if an XSS vector is ever introduced, there is no defense-in-depth.

**Remediation:**

```javascript
// next.config.mjs
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' }
    ]
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: https: https://avatars.githubusercontent.com",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' https://*.supabase.co",
              "frame-src 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
        ],
      },
    ];
  },
};
```

Test in report-only mode first (`Content-Security-Policy-Report-Only`) to avoid breaking changes.

---

#### S5 -- Information Leakage via Raw Error Messages Returned to Client

**Files:**
- `app/actions.ts` line 13: `return { error: error.message };`
- `app/actions.ts` line 33: `return { error: error.message };`

**Severity:** HIGH
**CVSS:** 5.3 (AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N)
**CWE:** CWE-209 (Generation of Error Message Containing Sensitive Information)

**Description:**

Server actions return raw Supabase error messages to the client. These can include table/column names, constraint violation details, and RLS policy names -- useful for attacker reconnaissance.

**Remediation:**

Log the full error server-side, return a sanitized message:

```typescript
if (error) {
  console.error('[actions][signGuestbook] Database error:', {
    code: error.code, message: error.message, details: error.details,
  });
  return { error: 'Something went wrong. Please try again later.' };
}
```

---

#### S6 -- Uncaught Exception on Missing Environment Variables

**Files:**
- `lib/supabase/server.ts` lines 9--10 (non-null assertions on env vars)
- `lib/supabase/client.ts` lines 5--6 (non-null assertions)
- `lib/supabase/middleware.ts` lines 10--11 (non-null assertions)

**Severity:** HIGH
**CVSS:** 5.9 (AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H)
**CWE:** CWE-248 (Uncaught Exception)

**Description:**

All three Supabase client factories use `process.env.NEXT_PUBLIC_SUPABASE_URL!` with non-null assertions. If either env var is missing, the app crashes with a cryptic `TypeError` or passes `undefined` to the Supabase client, producing opaque internal errors.

**Remediation:**

Create a validated environment module:

```typescript
// lib/supabase/env.ts
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}.\n` +
      `Create a .env.local file with this variable set.\n` +
      `See the project README for details.`
    );
  }
  return value;
}

export const SUPABASE_URL = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
export const SUPABASE_ANON_KEY = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
```

Import these validated constants in all three client modules instead of reading `process.env` directly.

---

#### S7 -- RLS Policies Allow Unrestricted Anonymous Data Insertion

**Files:**
- `supabase/schema.sql` line 58: `create policy "write contacts" on contacts for insert with check (true);`
- `supabase/schema.sql` line 59: `create policy "write views" on page_views for insert with check (true);`
- `supabase/schema.sql` lines 55--57: guestbook insert policy allows any valid-length entry

**Severity:** HIGH
**CVSS:** 6.5 (AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:L)
**CWE:** CWE-284 (Improper Access Control)

**Description:**

The RLS `with check (true)` means **any** insert passes the policy check. Combined with the publicly exposed anon key, anyone can write directly to Supabase tables via the REST API, bypassing Next.js server actions entirely:

```bash
curl -X POST 'https://<project>.supabase.co/rest/v1/contacts' \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Spam Bot","email":"spam@evil.com","subject":"BUY","message":"Spam"}'
```

**Remediation:**

Option A -- Tighten RLS policies:

```sql
create policy "write contacts" on contacts for insert
  with check (
    char_length(message) >= 1
    and (email is null or email ~ '^[^@]+@[^@]+\.[^@]{2,}$')
    and char_length(name) <= 80
  );
```

Option B -- Use service_role key for server-side writes, revoke anon insert policies:

```sql
drop policy if exists "write guestbook" on guestbook;
drop policy if exists "write contacts" on contacts;
drop policy if exists "write views" on page_views;
```

Then use a service-role client in server actions. **Never expose the service_role key to the client.**

---

#### S8 -- Silent Failure in Analytics Pipeline Prevents Abuse Detection

**Files:**
- `middleware.ts` lines 12--16: `.catch(() => {})` silently discards all errors
- `app/api/views/route.ts` lines 13--15: empty `catch` block discards error object

**Severity:** HIGH
**CVSS:** 5.3 (AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:N/A:H)
**CWE:** CWE-778 (Insufficient Logging)

**Description:**

The analytics pipeline has three layers of silent failure: the middleware's `.catch(() => {})`, the API route's empty `catch`, and no monitoring/alerting. Failures can persist indefinitely.

**Remediation:**

```typescript
// middleware.ts -- add logging and timeout
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 3000);

fetch(new URL('/api/views', request.url), {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ path }),
  signal: controller.signal,
}).catch((err) => {
  console.error('[middleware] View tracking failed:', {
    path, error: err instanceof Error ? err.message : String(err),
  });
}).finally(() => clearTimeout(timeoutId));
```

---

#### S9 -- No Duplicate or Spam Detection for Form Submissions

**Files:**
- `app/actions.ts` lines 6--17 (guestbook: no duplicate check)
- `app/actions.ts` lines 19--36 (contact: no duplicate check)

**Severity:** HIGH
**CVSS:** 5.3 (AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:L)
**CWE:** CWE-799 (Improper Control of Interaction Frequency)

**Description:**

No mechanism prevents repeated identical submissions. An attacker can submit the same entry thousands of times.

**Remediation:**

```typescript
// lib/dedup.ts
const recentSubmissions = new Map<string, number>();

setInterval(() => {
  const cutoff = Date.now() - 300_000;
  for (const [key, ts] of recentSubmissions) { if (ts < cutoff) recentSubmissions.delete(key); }
}, 300_000).unref();

export function isDuplicate(key: string, windowMs = 300_000): boolean {
  const now = Date.now();
  const lastSeen = recentSubmissions.get(key);
  if (lastSeen && now - lastSeen < windowMs) return true;
  recentSubmissions.set(key, now);
  return false;
}
```

---

### MEDIUM

---

#### S10 -- Missing Content Security Policy for Third-Party Resources

**Files:**
- `app/layout.tsx` lines 21--27 (Google Fonts via external `<link>`)
- `next.config.mjs` lines 1--9 (no CSP)

**Severity:** MEDIUM
**CVSS:** 4.3 (AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:L/A:N)
**CWE:** CWE-829 (Inclusion of Functionality from Untrusted Control Sphere)

**Description:**

Google Fonts loaded via external `<link>` tags with no SRI hash and no CSP. If fonts.googleapis.com is compromised, malicious CSS could be injected. Migrating to `next/font/google` self-hosts fonts at build time and eliminates this risk.

**Remediation:** Migrate to `next/font/google` (see S4 for CSP, and Performance finding P1 for font migration).

---

#### S11 -- Latent Stored XSS Risk from Unsanitized Database Content

**Files:**
- `app/actions.ts` lines 7--8 (no HTML sanitization before storing data)
- `components/guestbook.tsx` line 91 (`{e.message}` -- currently safe due to React escaping)
- `app/blog/[slug]/page.tsx` line 53 (`{post.content}` -- currently safe due to React escaping)

**Severity:** MEDIUM
**CVSS:** 5.4 (AV:N/AC:L/PR:L/UI:R/S:C/C:L/I:L/A:N) -- latent, requires code change to activate
**CWE:** CWE-79 (Improper Neutralization of Input During Web Page Generation)

**Description:**

Guestbook messages and blog post content are stored in Supabase without HTML sanitization. React JSX's automatic escaping prevents XSS on render -- but this is a **latent risk**: if the site ever adds markdown rendering or switches to `dangerouslySetInnerHTML`, the stored content immediately becomes an active XSS vector.

**Remediation:**

Option A (input sanitization): Add `stripHtml()` in server actions.
Option B (output sanitization): Use DOMPurify if markdown rendering is added later.
Option C (documentation): Add a code comment noting the intentional reliance on React escaping.

For now, the current code is safe. Add a warning comment:

```typescript
// NOTE: Guestbook messages are rendered as JSX text.
// React's automatic escaping prevents XSS. DO NOT switch to
// dangerouslySetInnerHTML or a markdown renderer without
// first adding HTML sanitization.
```

---

#### S12 -- Public Anon Key Grants Direct Database Access to Anyone

**Files:**
- `lib/supabase/client.ts` lines 5--6 (anon key exposed to browser)
- `supabase/schema.sql` lines 47--59 (RLS policies allow anonymous access)

**Severity:** MEDIUM
**CVSS:** 5.3 (AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:N)
**CWE:** CWE-200 (Exposure of Sensitive Information to an Unauthorized Actor)

**Description:**

The Supabase anon key is public by design, but combined with permissive RLS policies, anyone can read all public tables and write to `contacts`, `guestbook`, and `page_views` directly via the REST API, bypassing server-side validation.

**Remediation:** Use service_role key for server-side writes; tighten anon RLS policies (see S7).

---

#### S13 -- View Count Inflation via Unauthenticated API Endpoint

**Files:**
- `app/api/views/route.ts` lines 4--16 (no auth, no dedup, no rate limit)
- `components/hero.tsx` line 27 (`visitorCount` displayed as credible metric)

**Severity:** MEDIUM
**CVSS:** 4.3 (AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:N)
**CWE:** CWE-837 (Improper Enforcement of a Single, Unique Action)

**Description:**

`/api/views` accepts any `path` string with no deduplication. The schema declares `session_id` but the API route never populates it. Trivial to inflate view counts arbitrarily.

**Remediation:** Add session-based deduplication via a `visitor_sid` cookie:

```typescript
const sessionId = req.cookies.get('visitor_sid')?.value ?? crypto.randomUUID();

// Check for duplicate within the last 5 minutes
const { data: recent } = await supabase
  .from('page_views')
  .select('id')
  .eq('session_id', sessionId)
  .eq('path', path)
  .gte('created_at', new Date(Date.now() - 300_000).toISOString())
  .limit(1);

if (recent?.length) return NextResponse.json({ ok: true, deduplicated: true });

const response = NextResponse.json({ ok: true });
response.cookies.set('visitor_sid', sessionId, {
  httpOnly: true, secure: true, sameSite: 'lax', maxAge: 86400, path: '/',
});
return response;
```

---

### LOW

---

#### S14 -- No Production Security Configuration in next.config.mjs

**Files:**
- `next.config.mjs` lines 1--9 (minimal config)

**Severity:** LOW
**CVSS:** 2.6 (AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:L/A:N)
**CWE:** CWE-16 (Configuration)

**Description:** Missing `poweredByHeader: false` (reveals Next.js version), `productionBrowserSourceMaps: false`.

**Remediation:**

```javascript
const nextConfig = {
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  reactStrictMode: true,
  // ...existing config...
};
```

---

#### S15 -- Worker Limits and DoS via Large Payloads

**Files:** `app/actions.ts`, `app/api/views/route.ts`

**Severity:** LOW
**CVSS:** 3.7 (AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:N/A:L)
**CWE:** CWE-770 (Allocation of Resources Without Limits)

**Description:** Server actions and API routes accept payloads up to Next.js's default 1MB body limit, far exceeding expected sizes (~300 bytes for guestbook, ~500 bytes for contact, ~50 bytes for views).

**Remediation:** Add content-length checks or ensure `.slice()` limits on all fields in server actions.

---

#### S16 -- No Environment Variable Validation at Startup

**Files:** `lib/supabase/server.ts`, `lib/supabase/middleware.ts`

**Severity:** LOW
**CVSS:** 2.3 (AV:L/AC:L/PR:H/UI:N/S:U/C:N/I:N/A:L)
**CWE:** CWE-1295 (Debug Messages Revealing Unnecessary Information)

**Description:** Missing env vars cause opaque crashes with full stack traces in development mode.

**Remediation:** See S6 for the validated environment module.

---

## Performance Findings

---

### CRITICAL

#### P1 -- Blocking Fonts Block First Paint -- Google Fonts via `<link>` Instead of `next/font/google`

**File:** `app/layout.tsx:22-27`

Three font families (Fraunces, DM Sans, JetBrains Mono) are loaded via external CSS `<link>` tags. This is render-blocking: the browser must fetch CSS from `fonts.googleapis.com`, parse `@font-face`, then fetch font files from `fonts.gstatic.com` before text renders.

**Impact:** LCP penalty of 500ms-2s on slow connections.

**Fix:** Use `next/font/google` which self-hosts font files at build time:

```tsx
import { Fraunces, DM_Sans, JetBrains_Mono } from 'next/font/google';

const fraunces = Fraunces({
  subsets: ['latin'], axes: ['opsz'], style: ['normal', 'italic'],
  display: 'swap', variable: '--font-fraunces',
});
const dmSans = DM_Sans({
  subsets: ['latin'], weight: ['300', '400', '500', '600'],
  display: 'swap', variable: '--font-dm-sans',
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'], weight: ['400', '500'],
  display: 'swap', variable: '--font-mono',
});
```

Then reference `var(--font-fraunces)` etc. in `globals.css` and remove the `<link>` tags.

---

#### P2 -- Entire Home Page Blocks on 3 Data Queries -- No Streaming / Suspense / loading.tsx

**File:** `app/page.tsx`

`Promise.all` with 3 Supabase queries before returning any JSX. Browser receives zero HTML until all queries complete. No `loading.tsx`, no `<Suspense>` boundaries, no streaming.

**Impact:** TTFB is the slowest of the 3 queries. ISR cache misses hit full latency.

**Fix:** Wrap data-dependent sections in `<Suspense>` with fallbacks. Add `app/loading.tsx`:

```tsx
// app/loading.tsx
export default function Loading() {
  return (
    <main>
      <div style={{ padding: '120px 32px', textAlign: 'center', color: 'var(--ink-soft)' }}>
        Loading...
      </div>
    </main>
  );
}
```

---

#### P3 -- Blog Page Uses `select('*')` -- Fetches Unnecessary Columns

**File:** `app/blog/[slug]/page.tsx:19-23`

`select('*')` fetches every column from `posts`. Future column additions silently increase payload.

**Fix:** Enumerate needed columns:

```typescript
.select('slug, title, published_at, read_time, view_count, excerpt, content')
```

---

### HIGH

#### P4 -- Middleware Fires Extra HTTP Round-Trip for Analytics on Every Navigation

**File:** `middleware.ts:4-17`

Fire-and-forget `fetch` to `/api/views` on every navigation, plus `updateSession(request)` which calls `supabase.auth.getUser()` even though the site has no authenticated features.

**Impact:** 50-150ms extra latency per navigation from Supabase round-trip.

**Fix:** Since there are no authenticated routes, remove `updateSession` from middleware. Call Supabase directly instead of via API route, or move analytics to a client-side component.

---

#### P5 -- Missing Database Indexes -- Risk of Sequential Scans

**Files:** Schema queries in `app/page.tsx`, `app/blog/[slug]/page.tsx`

No indexes are defined in `supabase/schema.sql` beyond primary keys. Queries sorting by `published_at DESC` and `created_at DESC` perform table scans as data grows.

**Fix:**

```sql
CREATE INDEX IF NOT EXISTS idx_posts_published_at ON posts (published_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_slug ON posts (slug);
CREATE INDEX IF NOT EXISTS idx_guestbook_created_at ON guestbook (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_path ON page_views (path);
```

---

#### P6 -- No `generateStaticParams` -- Every Blog Page Pays ISR Miss Penalty

**File:** `app/blog/[slug]/page.tsx`

No `generateStaticParams` export means zero blog posts are pre-rendered at build time. First visit to any post always hits an ISR cache miss.

**Fix:**

```typescript
export async function generateStaticParams() {
  const supabase = await createClient();
  const { data: posts } = await supabase.from('posts').select('slug');
  return (posts ?? []).map((p) => ({ slug: p.slug }));
}
```

---

#### P7 -- `<img>` Instead of `next/image` -- No Optimization or Lazy Loading

**Files:** `components/about.tsx:30-33`, `components/nav.tsx:6-9`

Unoptimized `<img>` tags bypass Next.js image optimization: no WebP/AVIF conversion, no responsive srcset, no lazy loading, no explicit dimensions (causes CLS).

**Fix:** Use `next/image` with proper dimensions:

```tsx
import Image from 'next/image';
<Image src="https://avatars.githubusercontent.com/u/229602071?v=4" alt="mola" width={28} height={28} />
```

---

#### P8 -- Supabase Query Errors Silently Ignored -- No Graceful Degradation

**File:** `app/page.tsx:17-30`

All queries use `?? []` / `?? 1247` fallbacks with zero error checking. When Supabase is down, the page renders as if there are zero posts/entries with no user-facing indication.

**Fix:** Check `.error` on each query result and log or render a fallback message.

---

### MEDIUM

#### P9 -- Blog View Count RPC + Post Fetch Are Sequential (Not Parallel)

**File:** `app/blog/[slug]/page.tsx:16-23`

```typescript
await supabase.rpc('increment_view', { post_slug: slug });  // 1st round-trip
const { data: post } = await supabase.from('posts').select('*').eq('slug', slug).single(); // 2nd
```

These are independent -- they can run in parallel with `Promise.all`.

**Fix:**

```typescript
const [, { data: post }] = await Promise.all([
  supabase.rpc('increment_view', { post_slug: slug }),
  supabase.from('posts').select('slug, title, published_at, read_time, view_count, excerpt, content').eq('slug', slug).single(),
]);
```

---

#### P10 -- `Date.now()` in Render -- Impure Component Causing Hydration Warnings

**File:** `components/guestbook.tsx:13-19`

`timeAgo()` calls `Date.now()` during render. Causes SSR/hydration mismatch since server-rendered time differs from client-rendered time.

**Fix:** Extract to a `TimeAgo` client component with `useState` + `useEffect` interval.

---

#### P11 -- Inline Styles Create New Objects on Every Render

**File:** `app/blog/[slug]/page.tsx:31-54`

Multiple `style={{}}` objects for layout-critical styles. Move to CSS classes in `globals.css`.

---

#### P12 -- Missing `loading.tsx` for Route-Level Suspense

**File:** `app/` (file absent)

No loading skeleton renders during SSR/ISR. See P2 fix.

---

#### P13 -- `select('*', { count: 'exact', head: true })` -- Inefficient Count Query

**File:** `app/page.tsx:27-29`

`select('*')` with `head: true` builds full column list unnecessarily.

**Fix:** Use `select('path', { count: 'exact', head: true })` or a lightweight RPC.

---

### LOW

#### P14 -- Interval Re-render Every 4s in Hero Component

**File:** `components/hero.tsx:8-12`

Fake "live readers" counter re-renders every 4 seconds. Minimal impact at current scale but prevents static optimization.

---

#### P15 -- Three Font Families Add Load Weight

After migrating to `next/font/google`, three families = ~120-180KB of font data. Acceptable for design-focused portfolio but a deliberate trade-off.

---

#### P16 -- No Explicit CDN Cache Headers

**File:** `next.config.mjs`

No `headers()` function for static asset cache-control.

**Fix:** Add cache headers for `/_next/static/(.*)` with `Cache-Control: public, max-age=31536000, immutable`.

---

## Summary

### Security Findings by Severity

| Severity | Count | Key Areas |
|----------|-------|-----------|
| CRITICAL | 3 | CSRF bypass (CWE-352), no rate limiting (CWE-770), missing input validation (CWE-20) |
| HIGH | 6 | Missing security headers (CWE-693), error message leakage (CWE-209), env var crashes (CWE-248), permissive RLS (CWE-284), silent failures (CWE-778), no spam detection (CWE-799) |
| MEDIUM | 4 | Third-party font risk (CWE-829), latent XSS (CWE-79), public anon key exposure (CWE-200), view count inflation (CWE-837) |
| LOW | 3 | Production config (CWE-16), payload limits (CWE-770), env startup validation (CWE-1295) |

### Performance Findings by Severity

| Severity | Count | Key Areas |
|----------|-------|-----------|
| CRITICAL | 3 | Blocking fonts, no streaming/Suspense, `select('*')` |
| HIGH | 5 | Middleware overhead, missing indexes, no `generateStaticParams`, `<img>` instead of `next/image`, silent query failures |
| MEDIUM | 5 | Sequential queries, impure render, inline styles, missing `loading.tsx`, inefficient count query |
| LOW | 3 | Interval re-renders, three font families, no CDN cache headers |

### Defense-in-Depth Maturity

| Layer | Status | Gap |
|-------|--------|-----|
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

### Dependency Audit

- **npm audit:** 0 known vulnerabilities (info: 0, low: 0, moderate: 0, high: 0, critical: 0)
- **Next.js:** 15.5.18 (check https://github.com/vercel/next.js/security/advisories)
- **@supabase/ssr:** 0.5.2
- **@supabase/supabase-js:** 2.45.4 (several minor versions behind latest 2.x)

### Remediation Priority Order

```
 1. [CRITICAL] Convert forms to <form action={serverAction}>          -- CSRF (S1)
 2. [CRITICAL] Add rate limiting to all mutation endpoints             -- DoS (S2)
 3. [CRITICAL] Add input validation (email, safe chars, sanitization)  -- Data integrity + XSS defense (S3)
 4. [CRITICAL] Migrate to next/font/google                             -- Performance (P1)
 5. [CRITICAL] Add Suspense boundaries + loading.tsx                   -- Performance (P2)
 6. [HIGH]     Add security headers via next.config.mjs                -- Defense-in-depth (S4)
 7. [HIGH]     Sanitize error messages returned to client              -- Info leakage (S5)
 8. [HIGH]     Validate environment variables at startup               -- Crash safety (S6)
 9. [HIGH]     Tighten RLS policies / use service_role for writes      -- Access control (S7)
10. [HIGH]     Add structured error logging                            -- Observability (S8)
11. [HIGH]     Add duplicate/spam detection                            -- Content integrity (S9)
12. [MEDIUM]   Add HTML sanitization layer                             -- Latent XSS defense (S11)
13. [MEDIUM]   Add view deduplication via session cookie               -- Data integrity (S13)
14. [LOW]      Add production config hardening                         -- Defense-in-depth (S14)
```
