# Phase 4: Best Practices & Standards

**Project:** molamaker-site
**Stack:** Next.js 15.5 + React 19 + Supabase + TypeScript 5.6
**Review date:** 2026-05-20
**Files reviewed:** All 19 source files, `package.json`, `tsconfig.json`, `next.config.mjs`, `.gitignore`, `middleware.ts`, `lib/supabase/*`, `app/api/views/route.ts`

---

## CI/CD & DevOps Findings

---

### CRITICAL

---

#### DEVOP-C1 -- No CI/CD pipeline of any kind

**Files:** None (no `.github/workflows/`, no CI config, no build pipeline)
**Severity:** CRITICAL

The project has **zero continuous integration infrastructure**. There are no GitHub Actions workflows, no build pipeline configuration, no automated checks of any sort. Every merge to `main` triggers a Vercel deploy with no pre-deployment validation gate.

**What's missing:**

| CI Component | Status |
|-------------|--------|
| GitHub Actions workflow | Absent |
| Automated type-check gate | Absent (`tsc --noEmit` never runs automatically) |
| Automated lint gate | Absent (`npm run lint` only runs manually) |
| Automated build gate | Absent (Vercel handles build, but no pre-merge check) |
| Test execution gate | Absent (no tests to run, no infrastructure to run them) |
| Security scanning (SAST) | Absent (no CodeQL, no Snyk, no npm audit in CI) |
| Dependency scanning | Absent (no Dependabot, no Renovate) |
| Bundle analysis | Absent |
| Preview deployments | Implicit (Vercel auto-deploys branches, but not explicitly configured) |

The single `npm run build` invocation on Vercel is the only automated check, and it only verifies compilation success -- it does not run lint, type-check, tests, or security scans.

**Impact:**
- No gate preventing broken code from reaching production
- No visibility into build failures before merge
- No security scanning on dependency updates
- No automated verification that the site functions correctly after changes
- Vulnerabilities in dependencies can persist indefinitely without detection

**Recommendation:** Create a minimal `.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npm run lint
      - run: npm run build
```

When tests are added, append a `test` job. When Supabase is set up locally, add a Supabase CLI step for schema validation.

**Verification:** `ls .github/workflows/` should return at least one YAML file. `git push` to a PR should trigger the workflow and show passing checks.

---

#### DEVOP-C2 -- No lock file committed to version control

**Files:** No `package-lock.json`, `yarn.lock`, or `pnpm-lock.yaml` found
**Severity:** CRITICAL

The `.gitignore` does not explicitly exclude lock files, but none is present in the repository. Dependency resolution is non-deterministic -- every `npm install` can produce different dependency trees.

**Impact:**
- Non-reproducible builds: Vercel may install different versions than local development
- No dependency integrity verification: no way to `npm ci` (requires lock file)
- Security: without a lock file, `npm audit` cannot produce stable, reviewable results
- Debugging: "works on my machine" failures when dependency versions drift

**Recommendation:** Run `npm install` locally to generate `package-lock.json`, commit it, and use `npm ci` in CI pipelines instead of `npm install`.

**Verification:** `ls package-lock.json` should return the file. `npm ci` should complete successfully in a fresh clone.

---

#### DEVOP-C3 -- No environment variable template file (.env.local.example) despite README referencing it

**Files:** `README.md` (line 21), project root (`.env.local.example` absent)
**Severity:** CRITICAL

The README instructs developers to run `cp .env.local.example .env.local`, but `.env.local.example` does **not exist** in the repository. A new developer (or automated deployment) cannot know which environment variables are required to run the application.

The project requires exactly two environment variables, both with `NEXT_PUBLIC_` prefix:
1. `NEXT_PUBLIC_SUPABASE_URL`
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Without these, all three Supabase client factories fail at runtime with opaque errors (non-null assertions on `undefined`).

**Recommendation:** Create `.env.local.example`:

```bash
# Supabase project URL (from Supabase dashboard > Settings > API)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co

# Supabase anon/public key (from Supabase dashboard > Settings > API)
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

The `.gitignore` already has `*.local` which will exclude `.env.local` from version control.

**Verification:** After `cp .env.local.example .env.local && npm run dev`, the site should start without errors.

---

#### DEVOP-C4 -- No infrastructure as code for Supabase resources

**Files:** No `supabase/config.toml`, no `docker-compose.yml`, no migration tooling
**Severity:** CRITICAL

The project depends on Supabase for its entire backend (posts, guestbook, contacts, page_views tables + increment_view RPC function), but:

1. **No `supabase/config.toml`**: The Supabase project configuration is not version-controlled. Settings, auth providers, and API configuration exist only in the Supabase dashboard web UI.
2. **No migration tooling**: `supabase/schema.sql` exists as a one-shot deployment script, but there is no migration versioning (no up/down migrations, no migration history table). Schema changes must be applied manually via the Supabase SQL editor.
3. **No local Supabase**: Developers cannot run a local Supabase instance (`npx supabase start`). All development hits the production database.
4. **No automated schema validation**: Schema changes are applied directly to production with no CI validation, no review gate, and no rollback mechanism.

**Impact:**
- Production database is the development database -- a bad migration can take down the site
- Schema changes cannot be tested before applying to production
- No record of what schema was applied when, or by whom
- Onboarding a new developer requires access to the production Supabase project
- Disaster recovery requires manual reconstruction from `schema.sql` (no backup automation)

**Recommendation:**

```bash
# 1. Initialize Supabase local development
npx supabase init

# 2. Link to the existing Supabase project
npx supabase link --project-ref <project-ref>

# 3. Pull the current schema into a migration
npx supabase db pull

# 4. Generate types from the database
npx supabase gen types typescript --linked > lib/database.types.ts
```

Then use `npx supabase db diff` to create versioned migrations going forward. Add `supabase/config.toml` to version control (it contains no secrets). Add a GitHub Actions step to validate migrations:

```yaml
- name: Validate Supabase migrations
  uses: supabase/setup-cli@v1
  with:
    version: latest
- run: supabase db lint
```

For the local development loop, developers run `npx supabase start` (requires Docker) to get a local Postgres instance with the full schema.

**Verification:** `npx supabase start` should create a local Supabase instance. `npx supabase db reset` should recreate the full schema from migrations.

---

### HIGH

---

#### DEVOP-H1 -- No error tracking or crash reporting service

**Files:** All 19 source files (no Sentry, LogRocket, or equivalent)
**Severity:** HIGH

The application has **no error tracking, crash reporting, or monitoring integration**. If a production error occurs:

1. **Server errors are swallowed**: The API route catch block discards errors (`return NextResponse.json({ ok: false }, { status: 500 })` with no logging). Server actions return `{ error: error.message }` to the client but log nothing server-side.
2. **Client errors are invisible**: There is no `app/error.tsx` boundary, meaning unhandled client errors show Next.js's default error page with no telemetry.
3. **No alerting**: Site downtime, Supabase connection failures, and 500 errors generate zero notifications.
4. **No error grouping or deduplication**: If the same error occurs 1,000 times, there is no aggregation or trending visibility.

**Impact:**
- Production errors can persist for weeks without detection
- No data to prioritize bug fixes (no frequency/count data)
- No user-impact analysis for errors
- Debugging production issues requires reproduction from scratch

**Recommendation:** Integrate Sentry for error tracking (free tier covers personal projects):

```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

For a lighter-weight alternative without a third-party service, add structured `console.error` logging with correlation IDs:

```typescript
// lib/logger.ts
export function logError(context: string, error: unknown, extra?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const correlationId = crypto.randomUUID().slice(0, 8);
  console.error(JSON.stringify({
    level: 'error',
    context,
    correlationId,
    timestamp,
    error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
    ...extra,
  }));
}
```

At minimum, add `console.error` to every catch block that currently swallows errors silently (`app/api/views/route.ts` line 13, `lib/supabase/server.ts` line 19).

---

#### DEVOP-H2 -- No logging strategy or structured logging

**Files:** All source files (zero logging dependencies; only 1 implicit `console.error` path)
**Severity:** HIGH

The codebase has no logging infrastructure:

| Component | Logs errors? | Logs info? | Structured? |
|-----------|-------------|-----------|-------------|
| `app/page.tsx` | No (errors from 3 Supabase queries silently ignored) | No | No |
| `app/actions.ts` | No | No | No |
| `app/api/views/route.ts` | No (catch block swallows error) | No | No |
| `middleware.ts` | No (`.catch(() => {})` discards all) | No | No |
| `app/blog/[slug]/page.tsx` | No | No | No |
| `lib/supabase/server.ts` | No (catch block swallows error) | No | No |

The only error path that could surface information is the try/catch in `app/api/views/route.ts`, but it discards the caught error entirely. There is no request logging, no performance timing, and no audit trail for mutations.

**Impact:**
- Impossible to debug production issues without reproducing locally
- No visibility into request volume, latency, or error rates
- Cannot answer basic operational questions: "how many guestbook signs today?", "average page load time?", "Supabase query failure rate?"
- Security incidents (e.g., spam floods) produce no logs for investigation

**Recommendation:** Add a lightweight structured logging wrapper:

```typescript
// lib/logger.ts
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

function log(level: LogLevel, message: string, extra?: Record<string, unknown>) {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...extra,
  };
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  fn(JSON.stringify(entry));
}

export const logger = {
  debug: (msg: string, extra?: Record<string, unknown>) => log('debug', msg, extra),
  info: (msg: string, extra?: Record<string, unknown>) => log('info', msg, extra),
  warn: (msg: string, extra?: Record<string, unknown>) => log('warn', msg, extra),
  error: (msg: string, error?: unknown, extra?: Record<string, unknown>) =>
    log('error', msg, {
      errorMessage: error instanceof Error ? error.message : String(error ?? ''),
      errorStack: error instanceof Error ? error.stack : undefined,
      ...extra,
    }),
};
```

Wire into every catch block and key operational paths (Supabase query errors, server action outcomes, middleware analytics pings).

---

#### DEVOP-H3 -- No monitoring, metrics, or dashboards

**Files:** None (no monitoring configuration, no health check endpoint)
**Severity:** HIGH

The application has zero observability beyond Vercel's built-in deployment logs. Missing:

1. **Health check endpoint**: No `/api/health` route that verifies Supabase connectivity. Load balancers and monitoring tools cannot check if the application is healthy.
2. **Core Web Vitals monitoring**: No RUM (Real User Monitoring) for LCP, INP, CLS. Vercel Analytics is not configured.
3. **Supabase query performance**: No tracking of slow queries, query volume, or error rates.
4. **Uptime monitoring**: No external ping service (no UptimeRobot, Better Uptime, or equivalent configured).
5. **Business metrics**: No tracking of page views over time, guestbook sign rate, blog post read counts (aggregated).

**Impact:**
- Cannot detect if the site is down without manual checking
- Cannot measure or improve Core Web Vitals
- No visibility into slow database queries
- Cannot answer "how many people read my blog post?" reliably

**Recommendation:** 

1. Add a health check endpoint:

```typescript
// app/api/health/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const checks: Record<string, string> = {};
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('posts').select('slug', { count: 'exact', head: true });
    checks.database = error ? `error: ${error.message}` : 'ok';
  } catch (e) {
    checks.database = `error: ${String(e)}`;
  }
  const healthy = Object.values(checks).every((v) => v === 'ok');
  return NextResponse.json({ healthy, checks }, { status: healthy ? 200 : 503 });
}
```

2. Enable Vercel Web Analytics (one-click in Vercel dashboard) or add a lightweight analytics script.
3. Set up a free uptime monitor (e.g., Better Uptime free tier) pinging `https://molamaker.com/api/health` every 60 seconds.
4. Create a Supabase dashboard for query performance (use Supabase's built-in Query Performance view).

---

#### DEVOP-H4 -- No secret management or rotation strategy

**Files:** `lib/supabase/server.ts` (lines 9-10), `lib/supabase/client.ts` (lines 5-6), `lib/supabase/middleware.ts` (lines 10-11)
**Severity:** HIGH

Environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) are accessed via `process.env` with non-null assertions (`!`) and no validation. The anon key, while technically safe to expose in client bundles (it's designed for public use), is treated as a secret with no documentation of where it lives or how to rotate it.

Issues:
1. **No env var validation at startup**: If either variable is missing, the app crashes mid-request with an opaque error instead of failing fast with a clear message.
2. **No secret rotation documentation**: Supabase anon keys can be rotated from the dashboard. There is no documented procedure for doing so or verifying the rotation was successful.
3. **No separation of concerns**: The `NEXT_PUBLIC_` prefix means these values are inlined into the client bundle. While the anon key is designed to be public, the pattern should be conscious and documented.
4. **Vercel environment variables not documented in IaC**: Vercel env vars are configured via dashboard UI, not via `vercel.json` or a documented script. If the Vercel project is deleted and recreated, the env var config is lost.

**Recommendation:**

1. Add env var validation (as recommended in ARCH-M4 from Phase 1):

```typescript
// lib/supabase/env.ts
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
      `Copy .env.local.example to .env.local and fill in the values.`
    );
  }
  return value;
}

export const SUPABASE_URL = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
export const SUPABASE_ANON_KEY = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
```

2. Document secret rotation in `README.md` or `docs/operations.md`.
3. Configure Vercel env vars via `vercel.json` or `vercel env` CLI commands and document the command.
4. Consider using Vercel's Environment Variables UI to mark variables as Production/Preview/Development for environment-specific values.

---

#### DEVOP-H5 -- No preview or staging environment

**Files:** None (single Vercel project, single environment)
**Severity:** HIGH

The project has a single environment: production. Vercel's Git integration auto-deploys the `main` branch to production. There is no:

1. **Preview deployments**: Vercel typically auto-deploys branches to preview URLs, but this is not explicitly configured or documented.
2. **Staging environment**: No staging branch or separate Vercel project for pre-production testing.
3. **Environment parity**: No guarantee that production matches local development (different Supabase projects, no documented difference between environments).

**Impact:**
- All changes are tested only locally before reaching production
- No way to share a live preview of a feature branch with stakeholders
- Accidentally pushing to `main` deploys immediately to production with no approval gate

**Recommendation:**

1. Configure Vercel preview deployments explicitly (if not already auto-configured). Add a `vercel.json`:

```json
{
  "git": {
    "deploymentEnabled": {
      "main": true
    }
  }
}
```

2. Set up a separate Vercel project or a preview environment that uses a different Supabase project (or at minimum, verify that Vercel Preview Deployments work with the existing Supabase project).

3. Enable Vercel's Deployment Protection (password-protect preview deployments) for non-`main` branches.

4. Consider adding a `staging` branch that deploys to a staging URL before merging to `main`.

---

### MEDIUM

---

#### DEVOP-M1 -- No `vercel.json` for deployment configuration

**Files:** `vercel.json` (absent)
**Severity:** MEDIUM

The project relies entirely on Vercel's auto-detection of Next.js. While this works, it means:

1. **No explicit build configuration**: Build settings (node version, install command, build command, output directory) are implicit.
2. **No routing rules**: Custom headers, redirects, rewrites, and clean URLs must be configured via `next.config.mjs` alone, but `vercel.json` provides deployment-level overrides (e.g., security headers that Next.js cannot set).
3. **No cron jobs**: If ISR revalidation needs supplementing with scheduled rebuilds, `vercel.json` cron triggers are needed.
4. **No environment-specific overrides**: Different behavior for production vs. preview deployments cannot be declared in IaC.

**Recommendation:** Create a minimal `vercel.json`:

```json
{
  "buildCommand": "npm run build",
  "installCommand": "npm ci",
  "framework": "nextjs",
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
      ]
    },
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ],
  "redirects": [
    {
      "source": "/blog",
      "destination": "/#writing",
      "permanent": true
    }
  ]
}
```

The security headers here address Phase 2 finding S3 (no security headers configured).

**Note:** HSTS is managed by Vercel automatically (all deployments use HTTPS with Vercel's edge SSL). An explicit `Strict-Transport-Security` header can be added to `vercel.json` headers or `next.config.mjs`.

---

#### DEVOP-M2 -- No backup or disaster recovery strategy for Supabase

**Files:** None (no backup configuration, no documented recovery procedure)
**Severity:** MEDIUM

The project's entire data layer (blog posts, guestbook entries, contact messages, page view counts) lives in Supabase. There is:

1. **No automated backup**: Supabase Pro includes automatic daily backups, but the project is on Supabase Free tier (inferred from anon key usage -- no service key for admin operations). Free tier backup behavior is not documented.
2. **No point-in-time recovery**: If a bad migration drops a table or corrupts data, there is no rollback mechanism.
3. **No documented restore procedure**: If the Supabase project is accidentally deleted, restoring from `schema.sql` recovers the schema but not the data.
4. **`supabase/schema.sql` is not a backup**: It defines the schema but does not include data. Recovery from this file alone loses all user-generated content.

**Impact:**
- Accidental data loss is permanent
- No way to recover from a misapplied schema change
- No off-site copy of user-generated content

**Recommendation:**

1. At minimum, add a documented manual backup step:

```bash
# Backup schema + data
npx supabase db dump --data-only > supabase/seed.sql
```

2. For automated backups (requires Supabase Pro), enable Point-in-Time Recovery in Supabase dashboard.

3. Add a GitHub Actions scheduled workflow to run weekly schema dumps:

```yaml
name: Weekly Schema Backup
on:
  schedule:
    - cron: '0 6 * * 0' # Sunday 6 AM UTC
jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - run: supabase db dump --schema-only > supabase/schema.sql
      - uses: actions/upload-artifact@v4
        with:
          name: schema-backup
          path: supabase/schema.sql
```

4. Document the restore procedure in `docs/disaster-recovery.md` (or `README.md`):

```markdown
## Disaster Recovery

### Database is corrupted
1. Open Supabase Dashboard > SQL Editor
2. Run the latest `supabase/schema.sql` to recreate schema
3. Re-enter data via the application or Supabase dashboard

### Full project is deleted
1. Create a new Supabase project
2. Link it: `npx supabase link --project-ref <new-ref>`
3. Apply schema: run `supabase/schema.sql` in SQL Editor
4. Update `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel
```

---

#### DEVOP-M3 -- No Dependabot or automated dependency updates

**Files:** No `.github/dependabot.yml`
**Severity:** MEDIUM

Dependencies (`next@^15.5.7`, `react@^19.2.1`, `@supabase/ssr@^0.5.2`, `@supabase/supabase-js@^2.45.4`, `typescript@^5.6.3`) use caret ranges (`^`), meaning minor and patch updates are accepted automatically. However:

1. No automated PRs for dependency updates
2. No automated security vulnerability alerts (Dependabot alerts are free on GitHub but not configured)
3. No lock file means no `npm audit` integration in CI

The latest commits (fixing TypeScript strict mode issues) suggest the project is sensitive to dependency behavior changes. Automated updates with CI validation would catch regressions early.

**Recommendation:** Create `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 5
    versioning-strategy: increase
    labels:
      - "dependencies"
      - "automerge-candidate"

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "monthly"
    labels:
      - "dependencies"
```

Enable Dependabot security alerts in the GitHub repository Settings.

---

#### DEVOP-M4 -- No pre-commit or pre-push hooks

**Files:** No `.husky/`, no `lint-staged` config, no Git hooks
**Severity:** MEDIUM

No automated checks run before commits or pushes. Type errors, lint violations, and formatting issues are caught only at build time (or, currently, only when manually running `npm run lint` or `tsc --noEmit`).

**Recommendation:** Add a lightweight pre-commit hook using `lint-staged`:

```bash
npm install -D husky lint-staged
npx husky init
```

```bash
# .husky/pre-commit
npx lint-staged
```

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{css,json,md}": ["prettier --write"]
  }
}
```

For the TypeScript check, add a pre-push hook:

```bash
# .husky/pre-push
npx tsc --noEmit
```

---

### LOW

---

#### DEVOP-L1 -- No rollback procedure for Vercel deployments

**Files:** None
**Severity:** LOW

Vercel supports instant rollbacks to any previous deployment via its dashboard and CLI (`vercel rollback`). However, there is no documented rollback procedure, and since the Supabase schema is applied manually, a rollback only reverts the frontend -- database schema changes are not included in rollbacks.

**Recommendation:** Document the rollback procedure in `docs/operations.md`:

```markdown
## Rollback

### Frontend only (Vercel)
```bash
npx vercel rollback
# Or: use Vercel Dashboard > Deployments > select deployment > "Promote to Production"
```

### Database (manual)
Database changes are NOT included in Vercel rollbacks. If a schema migration caused the issue:
1. Write a reverse migration
2. Apply it via Supabase SQL Editor
3. Commit the reverse migration to `supabase/migrations/`
```

---

#### DEVOP-L2 -- No Vercel analytics or RUM configured

**Files:** None (no `@vercel/analytics` dependency)
**Severity:** LOW

The project has a custom page-view tracking system (middleware -> /api/views -> Supabase) but no real user monitoring for Core Web Vitals or performance metrics. Vercel offers:

1. **Vercel Analytics** (free tier): Web Vitals, page views, visitor geography, referrers, OS/browser breakdown
2. **Vercel Speed Insights** (free tier): Real-user Core Web Vitals data with drill-downs

The custom page-view tracker gives a simple hit count, but Vercel Analytics would provide operational visibility (performance, geography, referrers) with zero additional infrastructure.

**Recommendation:** Add Vercel Analytics and Speed Insights:

```bash
npm install @vercel/analytics @vercel/speed-insights
```

```tsx
// app/layout.tsx -- add to body
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
```

This provides Core Web Vitals monitoring at zero cost (Vercel free tier covers up to 10K events/day).

---

#### DEVOP-L3 -- No `engines` field in package.json

**Files:** `package.json`
**Severity:** LOW

The `package.json` does not specify a required Node.js version via the `engines` field. Vercel defaults to Node.js 20.x, but without an explicit declaration, the runtime version is implicit. If a team member runs a different Node.js version locally, they may encounter compatibility issues.

**Recommendation:**

```json
// package.json
{
  "engines": {
    "node": ">=20.0.0",
    "npm": ">=10.0.0"
  }
}
```

This ensures Vercel and local development use the same Node.js major version.

---

## Operational Maturity Scorecard

| Capability | Score | Max | Notes |
|-----------|-------|-----|-------|
| CI/CD Pipeline | 0 | 20 | No pipeline exists |
| Automated Testing Gates | 0 | 15 | No tests |
| IaC (Infrastructure as Code) | 1 | 15 | Only `supabase/schema.sql` (one-shot, not versioned migration) |
| Deployment Strategy | 4 | 10 | Vercel auto-deploy works but no staged rollout, no rollback script |
| Monitoring & Observability | 0 | 10 | No logging, metrics, alerting, or error tracking |
| Incident Response | 0 | 10 | No runbooks, no on-call, no documented recovery procedures |
| Environment Management | 2 | 10 | `.env.local` exists locally; no separation of environments, no .env.example |
| Secret Management | 3 | 5 | Env vars used correctly; no validation, no rotation docs |
| Dependency Management | 2 | 5 | No lock file, no Dependabot |
| **TOTAL** | **12** | **100** | |

---

## Summary

### CI/CD & DevOps Findings by Severity

| Severity | Count | Key Areas |
|----------|-------|-----------|
| CRITICAL | 4 | No CI pipeline, no lock file, missing .env.example, no IaC for Supabase |
| HIGH | 5 | No error tracking, no logging, no monitoring/dashboards, no secret management, no staging environment |
| MEDIUM | 4 | No vercel.json, no backup strategy, no Dependabot, no pre-commit hooks |
| LOW | 3 | No documented rollback, no Vercel Analytics, no engines field |

### Priority Remediation Order

```
1.  [CRITICAL] Create .env.local.example file                                    -- DEVOP-C3
2.  [CRITICAL] Commit package-lock.json                                          -- DEVOP-C2
3.  [CRITICAL] Create .github/workflows/ci.yml (type-check + lint + build)       -- DEVOP-C1
4.  [CRITICAL] Initialize Supabase local dev + create supabase/config.toml        -- DEVOP-C4
5.  [HIGH]     Add env var validation (lib/supabase/env.ts)                       -- DEVOP-H4
6.  [HIGH]     Add structured logger and wire to all catch blocks                 -- DEVOP-H2
7.  [HIGH]     Add health check endpoint (/api/health)                            -- DEVOP-H3
8.  [HIGH]     Integrate error tracking (Sentry or console.error fallback)       -- DEVOP-H1
9.  [HIGH]     Configure Vercel preview deployments + staging env                 -- DEVOP-H5
10. [MEDIUM]   Create vercel.json with security headers + build config            -- DEVOP-M1
11. [MEDIUM]   Create .github/dependabot.yml                                      -- DEVOP-M3
12. [MEDIUM]   Add backup strategy for Supabase data                              -- DEVOP-M2
13. [MEDIUM]   Add Husky + lint-staged pre-commit hooks                           -- DEVOP-M4
14. [LOW]      Document rollback procedure                                        -- DEVOP-L1
15. [LOW]      Add @vercel/analytics + @vercel/speed-insights                     -- DEVOP-L2
16. [LOW]      Add engines field to package.json                                  -- DEVOP-L3
```

### Quick Wins (highest ROI, lowest effort)

1. **Create `.env.local.example`** -- 4 lines, unblocks onboarding. Tier 1 critical.
2. **Commit `package-lock.json`** -- Run `npm install` and commit. Enables reproducible builds.
3. **Add `engines` field to `package.json`** -- 3 lines, sets Node.js version explicitly.
4. **Create `.github/workflows/ci.yml`** -- 20 lines, gates all merges with type-check + lint + build.
5. **Create `lib/logger.ts`** -- 30 lines, plug into all catch blocks for immediate visibility into errors.

---

## Framework & Language Findings

---

### CRITICAL

---

#### B1 -- Google Fonts via `<link>` instead of `next/font/google`

**File:** `app/layout.tsx` lines 22-27
**Severity:** CRITICAL

Three font families (Fraunces, DM Sans, JetBrains Mono) are loaded via `<link>` tags in `<head>`, which:

- Causes render-blocking external network requests to `fonts.googleapis.com` and `fonts.gstatic.com`
- Produces layout shift (FOUT/FOIT) because the browser discovers fonts late
- Forgoes Next.js automatic font optimization (self-hosting, subsetting, `size-adjust` fallback metrics)
- Leaks user IP to Google on every page load (GDPR concern)

**Current pattern:**
```tsx
// app/layout.tsx
<head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
  <link
    href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..700&family=DM+Sans:opsz,wght@9..40,300..600&family=JetBrains+Mono:wght@400;500&display=swap"
    rel="stylesheet"
  />
</head>
```

**Recommended pattern:**
```tsx
// app/layout.tsx
import { Fraunces, DM_Sans, JetBrains_Mono } from 'next/font/google';

const fraunces = Fraunces({
  subsets: ['latin'],
  axes: ['opsz', 'wght', 'SOFT', 'WONK'],
  style: ['normal', 'italic'],
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

Then update `globals.css` font-family declarations to use the CSS variables (e.g., `var(--font-dm-sans)`, `var(--font-fraunces)`, `var(--font-mono)`).

This eliminates all external font requests, provides automatic `size-adjust` fallbacks, and removes the need for the `<head>` section entirely.

---

#### B2 -- Missing `viewport` export in layout.tsx

**File:** `app/layout.tsx`
**Severity:** CRITICAL

Next.js 15 requires the `viewport` configuration to be exported separately from `metadata`. The layout has `metadata` but no `viewport` export, which means no `themeColor` for browser chrome coloring, no explicit `viewport` width/scale for mobile, and no programmatic control over the viewport meta tag.

**Recommended pattern:**
```tsx
import type { Metadata, Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F5F1EB' },
  ],
};

export const metadata: Metadata = {
  title: 'molamaker -- portfolio & journal',
  description: '...',
};
```

Reference: https://nextjs.org/docs/app/api-reference/functions/generate-viewport

---

#### B3 -- Missing `generateMetadata` on blog route (no dynamic SEO)

**File:** `app/blog/[slug]/page.tsx`
**Severity:** CRITICAL

The blog post page has no `generateMetadata` export. Every blog post renders with the root layout's generic title/description. Social sharing cards (Open Graph) show the generic site description, not the post title and excerpt. Search engines index every blog post with the same title.

**Recommended pattern:**
```tsx
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
    .select('title, excerpt, published_at')
    .eq('slug', slug)
    .single();

  if (!post) return { title: 'Post not found' };

  return {
    title: post.title,
    description: post.excerpt ?? undefined,
    openGraph: {
      title: post.title,
      description: post.excerpt ?? undefined,
      type: 'article',
      publishedTime: post.published_at,
    },
  };
}
```

---

#### B4 -- Missing `generateStaticParams` on blog route

**File:** `app/blog/[slug]/page.tsx`
**Severity:** CRITICAL

No `generateStaticParams` means all blog posts are fully dynamic (SSR on every request), despite having ISR with `revalidate = 60`. Pre-rendering at build time eliminates cold-start latency for all existing posts.

**Recommended pattern:**
```tsx
export async function generateStaticParams() {
  const supabase = await createClient();
  const { data: posts } = await supabase
    .from('posts')
    .select('slug');

  return (posts ?? []).map((post) => ({ slug: post.slug }));
}
```

New slugs fall through to dynamic SSR; existing slugs get static + ISR treatment.

---

#### B5 -- Missing `loading.tsx`, `error.tsx`, `not-found.tsx`

**Files:** `app/loading.tsx` (absent), `app/error.tsx` (absent), `app/not-found.tsx` (absent)
**Files:** `app/blog/[slug]/loading.tsx` (absent), `app/blog/[slug]/error.tsx` (absent)
**Severity:** CRITICAL

Next.js App Router conventions for loading, error, and not-found boundaries are entirely absent. No loading UI during SSR, no error boundary for Supabase query failures, and no custom 404 despite `notFound()` being called in the blog route.

**Recommended:** Create `app/loading.tsx`, `app/error.tsx`, `app/not-found.tsx`, and `app/blog/[slug]/loading.tsx` with styled fallback UIs matching the site's visual language.

---

#### B6 -- Missing `sitemap.ts` and `robots.ts`

**Files:** `app/sitemap.ts` (absent), `app/robots.ts` (absent)
**Severity:** CRITICAL

No sitemap or robots.txt means search engines have no structured way to discover pages. For a public portfolio with blog posts, this directly harms SEO.

**Recommended pattern:**

`app/sitemap.ts`:
```tsx
import type { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://molamaker.com';
  const supabase = (await import('@/lib/supabase/server')).createClient;
  const client = await supabase();
  const { data: posts } = await client.from('posts').select('slug, published_at');

  const postEntries: MetadataRoute.Sitemap = (posts ?? []).map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: post.published_at,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  return [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 1 },
    ...postEntries,
  ];
}
```

`app/robots.ts`:
```tsx
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: 'https://molamaker.com/sitemap.xml',
  };
}
```

---

#### B7 -- Server actions called imperatively via `onClick` instead of `<form action>`

**Files:** `components/guestbook.tsx` lines 28-53 (onClick on line 79), `components/contact.tsx` lines 17-33 (onClick on line 71)
**Severity:** CRITICAL

This is a framework pattern violation in addition to the security issue (bypassed CSRF) documented in C2/S1. Next.js App Router's canonical approach for mutations is `<form action={serverAction}>` combined with React 19's `useActionState`. The current imperative pattern:

1. Bypasses Next.js CSRF protection (documented in C2/S1)
2. Prevents progressive enhancement -- if JS fails, both forms are completely dead
3. Ignores React 19's `useActionState` hook -- the purpose-built hook for form mutations
4. Manually implements optimistic updates instead of using `useOptimistic`

**Recommended pattern (guestbook with `useActionState` + `useOptimistic`):**
```tsx
'use client';
import { useActionState, useOptimistic, startTransition } from 'react';
import { signGuestbook } from '@/app/actions';

type Entry = { id: string; name: string; message: string; created_at: string };
type ActionState = { ok?: boolean; error?: string } | null;

export default function Guestbook({ entries }: { entries: Entry[] }) {
  const [optimisticEntries, addOptimistic] = useOptimistic<Entry[], Entry>(
    entries,
    (state, newEntry) => [newEntry, ...state],
  );

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_prev, formData) => {
      const name = String(formData.get('name') || '').trim() || 'anon';
      const message = String(formData.get('message') || '').trim();
      if (!message) return { error: 'Message is required.' };

      const optimistic: Entry = {
        id: 'tmp-' + Date.now(),
        name: name || 'anon',
        message,
        created_at: new Date().toISOString(),
      };
      startTransition(() => addOptimistic(optimistic));
      return await signGuestbook(formData);
    },
    null,
  );

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
      {optimisticEntries.map((e) => (
        <div key={e.id} className="entry">
          <div className="entry-head">
            <span className="entry-name">{e.name}</span>
            <span className="entry-time">{timeAgo(e.created_at)}</span>
          </div>
          <div className="entry-msg">{e.message}</div>
        </div>
      ))}
    </section>
  );
}
```

This provides: built-in CSRF protection, progressive enhancement (works without JS), canonical React 19 form handling, and proper optimistic semantics via `useOptimistic`.

---

### HIGH

---

#### B8 -- `@supabase/ssr` at ^0.5.2 is significantly outdated

**File:** `package.json` line 12
**Severity:** HIGH

The `@supabase/ssr` package is pinned to `^0.5.2`. The current release is `0.7.x` (as of May 2026), which includes `createBrowserClient` API changes, `createServerClient` API refinements, better TypeScript types for cookie options, and breaking changes from 0.5.x to 0.6.x+.

Additionally, `@supabase/supabase-js` at `^2.45.4` may be behind (current is 2.49.x+).

**Recommended:**
```bash
npm install @supabase/ssr@latest @supabase/supabase-js@latest
```

Then verify the cookie handlers in `lib/supabase/server.ts` and `lib/supabase/middleware.ts` match the latest API.

---

#### B9 -- `select('*', { count: 'exact', head: true })` should use explicit column

**File:** `app/page.tsx` line 29
**Severity:** HIGH

```typescript
supabase.from('page_views').select('*', { count: 'exact', head: true })
```

While `head: true` prevents row data from being returned, using `'*'` signals wrong intent and forces column resolution. Use `select('id', { count: 'exact', head: true })` to explicitly communicate "we only need the count."

---

#### B10 -- No Zod or other schema-based input validation

**Files:** `app/actions.ts` (lines 6-36)
**Severity:** HIGH

Server actions use manual string coercion and trimming for validation. This does not validate email format, provide structured errors, infer TypeScript types from the schema, or scale to more complex forms. The TypeScript ruleset recommends Zod.

**Recommended:** Install `zod`, create `lib/validations.ts` with `guestbookSchema` and `contactSchema` using `z.object({...})`, then use `schema.safeParse(formData)` in server actions for structured validation with typed results.

---

#### B11 -- No shared types directory; types duplicated across components

**Files:** `components/writing.tsx` (Post type), `components/guestbook.tsx` (Entry type), `components/work.tsx` (Project type)
**Severity:** HIGH

Domain types are defined inline in each component file. The `Post` type exists in both `writing.tsx` and implicitly in `blog/[slug]/page.tsx`. The `Entry` type in guestbook has no shared definition with the server action.

**Recommended:** Create `lib/types.ts` with `Post`, `GuestbookEntry`, and `Project` interfaces exported for import across all components and pages.

---

#### B12 -- `CookieToSet` type duplicated across two files

**Files:** `lib/supabase/server.ts` line 4, `lib/supabase/middleware.ts` line 4
**Severity:** HIGH

The exact same type alias is defined twice:
```typescript
type CookieToSet = { name: string; value: string; options: CookieOptions };
```

**Recommended:** Move to `lib/types.ts` and import in both files.

---

#### B13 -- Missing security headers

**Files:** `next.config.mjs`, `middleware.ts`
**Severity:** HIGH

No security headers are configured: no CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, or Permissions-Policy. This also addresses Phase 2 finding S3.

**Recommended:** Add `async headers()` to `next.config.mjs` returning `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy: camera=(), microphone=(), geolocation=()`. Add CSP via middleware response headers. Set `poweredByHeader: false`.

---

### MEDIUM

---

#### B14 -- `target: "ES2020"` in tsconfig.json is conservative

**File:** `tsconfig.json` line 3
**Severity:** MEDIUM

`ES2020` was released 5 years ago. Next.js 15.5+ targets Node.js 18+ (supports ES2023). Modernizing to `ES2022` enables `Array.prototype.at()`, `Object.hasOwn()`, `Error.cause`, and class static initialization blocks.

**Recommended:** Set `"target": "ES2022"` in tsconfig.json.

---

#### B15 -- No CSS Modules, Tailwind, or component-scoped styling

**Files:** `app/globals.css` (single 361-line file), `app/blog/[slug]/page.tsx` (inline styles)
**Severity:** MEDIUM

All styles reside in a single flat `globals.css`. The blog post page uses inline `style={{}}` objects extensively (lines 31, 41, 43, 47-51, 55-59), duplicating color/spacing tokens instead of referencing CSS variables. No style isolation between components.

**Recommended:** Move blog inline styles to `globals.css` as dedicated `.article-header`, `.article-excerpt`, `.article-body`, `.article-back` classes. Consider CSS Modules or Tailwind if the project grows beyond ~10 components.

---

#### B16 -- `<img>` tags missing `width`/`height` attributes (CLS risk)

**Files:** `components/nav.tsx` line 7, `components/about.tsx` line 31
**Severity:** MEDIUM

Both `<img>` elements lack explicit dimensions. Without `width`/`height`, the browser cannot reserve space before the image loads, causing Cumulative Layout Shift.

**Recommended:** Either use `next/image` with `width={28} height={28}`, or add explicit `width` and `height` attributes to the `<img>` tags.

---

#### B17 -- No `.env.local.example` file despite README referencing it

**Files:** Project root (absent)
**Severity:** MEDIUM

The project has no environment variable template. A new developer cannot know which environment variables are required. (Also documented in D1 and DEVOP-C3.)

**Recommended:** Create `.env.local.example` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_SITE_URL` templates.

---

#### B18 -- Middleware analytics fire-and-forget has no `waitUntil` for edge runtime

**File:** `middleware.ts` lines 12-16
**Severity:** MEDIUM

The `fetch().catch(() => {})` pattern works on Node.js runtime but may silently drop page views on edge runtimes (Vercel Edge, Cloudflare Workers) where promises are cancelled when the response is sent.

**Recommended:** Either use `import { waitUntil } from '@vercel/functions'` and wrap the fetch call, or leave as-is for Node.js deployments with a comment documenting the edge runtime caveat.

---

#### B19 -- `next.config.mjs` could be `next.config.ts` for type safety

**File:** `next.config.mjs`
**Severity:** MEDIUM

Next.js 15.5+ supports `next.config.ts` for full TypeScript type checking. The current `.mjs` file uses a JSDoc annotation (`@type {import('next').NextConfig}`) which provides IDE support but no compile-time checking.

**Recommended:** Rename to `next.config.ts`, import `NextConfig` from `next`, and use explicit type annotation on the config object.

---

#### B20 -- No ESLint configuration beyond Next.js defaults

**Files:** No `eslint.config.mjs`, `.eslintrc.json`, or `.eslintrc.js`
**Severity:** MEDIUM

Only Next.js built-in ESLint via `next lint`. Missing rules for `@typescript-eslint/no-unused-vars`, `no-console` in production, and import ordering.

**Recommended:** Create `eslint.config.mjs` extending `next/core-web-vitals` and `next/typescript` with additional strict rules.

---

### LOW

---

#### B21 -- `Date.now()` called during render in `timeAgo` function

**File:** `components/guestbook.tsx` line 13
**Severity:** LOW

`Date.now()` in the render phase causes the component to render differently on every frame, preventing React memoization. Not a bug for client components, but consider using `useMemo` with a dependency or a `useEffect`/`setInterval` for a live clock.

---

#### B22 -- `Footer` calls `new Date().getFullYear()` on every server render

**File:** `components/footer.tsx` line 4
**Severity:** LOW

Server component runs `new Date().getFullYear()` on every ISR revalidation. Functionally correct but the year only changes annually. Setting a static year would avoid the unnecessary call.

---

#### B23 -- `next.config.mjs` has `images.remotePatterns` but `<next/image>` is never used

**File:** `next.config.mjs` lines 3-6
**Severity:** LOW

The project configures `images.remotePatterns` for `avatars.githubusercontent.com` but uses raw `<img>` tags everywhere. The config is dead code unless migrated to `next/image`.

---

#### B24 -- Server actions lack explicit return type annotations

**File:** `app/actions.ts` lines 6, 19
**Severity:** LOW

Exported public API functions (`signGuestbook`, `sendContact`) rely on TypeScript inference for return types. An explicit `type ActionResult = { ok?: boolean; error?: string }` and `Promise<ActionResult>` annotation would document the contract.

---

#### B25 -- `react` and `react-dom` at ^19.2.1 have newer patch releases available

**File:** `package.json` lines 15-16
**Severity:** LOW

Run `npm install react@latest react-dom@latest @types/react@latest @types/react-dom@latest` for latest patches.

---

## Dependency Health Check

| Package | Current | Latest (May 2026) | Status |
|---------|---------|-------------------|--------|
| `next` | ^15.5.7 | ~15.6.x | Minor behind |
| `react` | ^19.2.1 | ~19.2.x | Patch behind |
| `react-dom` | ^19.2.1 | ~19.2.x | Patch behind |
| `@supabase/ssr` | ^0.5.2 | ~0.7.x | **Major version behind** |
| `@supabase/supabase-js` | ^2.45.4 | ~2.49.x | Minor behind |
| `typescript` | ^5.6.3 | ~5.8.x | Minor behind |
| `@types/node` | ^22 | ^22 | Current |
| `@types/react` | ^19 | ^19 | Current |
| `@types/react-dom` | ^19 | ^19 | Current |

**Recommended additions:** `zod` (input validation), `vitest` + `@testing-library/react` (testing), `prettier` (formatting).

---

## Build Configuration Review

### MEDIUM

#### BC1 -- Missing `poweredByHeader: false` and other production flags

**File:** `next.config.mjs`
**Severity:** MEDIUM

The config lacks `poweredByHeader: false` (leaks `X-Powered-By: Next.js` header). Consider adding explicit `output` and `productionBrowserSourceMaps` settings.

### LOW

#### BC2 -- `overrides.postcss` may be unnecessary

**File:** `package.json` lines 24-26
**Severity:** LOW

The `"overrides": { "postcss": "^8.5.10" }` forces PostCSS across all dependencies. If for a specific vulnerability fix, document it. Otherwise, remove.

#### BC3 -- No `prettier` or code formatter in devDependencies

**File:** `package.json`
**Severity:** LOW

No formatter configured. The web hooks ruleset recommends Prettier for automatic formatting.

---

## Summary

### Best Practices Findings by Severity

| Severity | Count | Key Areas |
|----------|-------|-----------|
| CRITICAL | 7 | Font loading, viewport export, generateMetadata/StaticParams, missing route segments (loading/error/not-found), sitemap/robots, imperative server actions |
| HIGH | 6 | Outdated @supabase/ssr, select('*'), no Zod validation, no shared types, duplicated CookieToSet, missing security headers |
| MEDIUM | 7 | ES2020 target, no scoped styling, missing img dimensions, no .env.example, middleware edge concern, config file format, missing ESLint config |
| LOW | 5 | Date.now() in render, Footer dynamic year, unused image config, missing return types, stale React patches |

### Combined Priority Order (Top 10 across all phases)

```
 1. [CRITICAL] B1  -- Migrate Google Fonts to next/font/google
 2. [CRITICAL] B2  -- Add viewport export to layout.tsx
 3. [CRITICAL] B3  -- Add generateMetadata to blog/[slug]/page.tsx
 4. [CRITICAL] B4  -- Add generateStaticParams to blog/[slug]/page.tsx
 5. [CRITICAL] B5  -- Create loading.tsx, error.tsx, not-found.tsx
 6. [CRITICAL] B6  -- Create sitemap.ts and robots.ts
 7. [CRITICAL] B7  -- Refactor forms to <form action> + useActionState + useOptimistic
 8. [HIGH]    B8  -- Upgrade @supabase/ssr to latest
 9. [HIGH]    B13 -- Add security headers via next.config.mjs headers()
10. [HIGH]    B10 -- Add Zod validation to server actions
```
