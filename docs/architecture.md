# Architecture

## System Overview

molamaker-site is a personal portfolio and journal built on **Next.js 15** (App Router), **Supabase** (PostgreSQL + Auth), and deployed to **Vercel**.

```
                   Vercel Edge (Middleware)
                           │
                   ┌───────┴───────┐
                   │  middleware.ts │
                   │  - analytics   │
                   │  - session     │
                   └───────┬───────┘
                           │
              ┌────────────┴────────────┐
              │    Next.js App Router   │
              │  ┌───────────────────┐  │
              │  │  Server Component │  │
              │  │  (RSC, ISR)       │  │
              │  └────────┬──────────┘  │
              │           │             │
              │  ┌────────┴──────────┐  │
              │  │  Server Actions   │  │
              │  │  (mutations)      │  │
              │  └────────┬──────────┘  │
              │           │             │
              │  ┌────────┴──────────┐  │
              │  │  Route Handlers   │  │
              │  │  (REST API)       │  │
              │  └────────┬──────────┘  │
              └───────────┼────────────┘
                          │
                   ┌──────┴──────┐
                   │  Supabase   │
                   │  - PG DB    │
                   │  - Auth     │
                   └─────────────┘
```

---

## Data Flow

### Read path (Server Components)

```
User request → Vercel → Next.js Server → createClient(server) → Supabase → RSC payload → Browser
                                                              ↓
                                                         ISR cache (30s/60s)
```

### Write path (Server Actions)

```
Client Component → Server Action → Zod validation → Rate limit check → Supabase insert → revalidatePath
```

### Analytics path (Middleware)

```
User request → middleware.ts → fire-and-forget POST /api/views → Zod validation → Rate limit → Supabase(page_views)
```

### Auth path (Middleware)

```
User request → middleware.ts → updateSession → Supabase auth cookie refresh → Response + set-cookie
```

---

## Component Tree

```
RootLayout (app/layout.tsx)
└── HomePage (app/page.tsx) [ISR: 30s]
    ├── Nav (components/nav.tsx)
    ├── Hero — visitor count from page_views table
    ├── About — static bio section
    ├── Work — project cards (hardcoded)
    ├── Writing — latest 5 posts from Supabase
    ├── Guestbook — latest 30 entries from Supabase + sign form
    ├── Contact — contact form
    └── Footer

PostPage (app/blog/[slug]/page.tsx) [ISR: 60s, static params]
├── Nav
├── Article — title, meta, excerpt, content
└── Footer
```

---

## ISR Strategy

| Page               | `revalidate` | Rationale                                           |
| ------------------ | ------------ | --------------------------------------------------- |
| Home (`/`)         | 30 seconds   | Guestbook entries update frequently                 |
| Blog (`/blog/[slug]`) | 60 seconds | View counts update; content changes less often      |
| Static params      | N/A          | `generateStaticParams` populates all known slugs at build time |

---

## Security Layers

### 1. Input Validation (Zod)

All user input passes through Zod schemas (`lib/validation.ts`) before touching the database. Schemas enforce length limits and a safe-text regex that blocks control characters, script tags, and path traversal.

### 2. HTML Sanitization

A `sanitize` helper escapes `&`, `<`, `>`, `"`, `'` to HTML entities. Combined with React's default escaping, this prevents stored XSS in guestbook entries and contact messages.

### 3. Rate Limiting

In-memory token-bucket rate limiter (`lib/rate-limit.ts`) per IP:

- Guestbook: 5/60s
- Contact: 3/60s
- Page views: 60/60s

### 4. CSRF Protection

Server Actions are protected by Next.js' built-in CSRF mechanism (encrypted action IDs). The REST endpoint (`POST /api/views`) does not require CSRF protection as it is called only by middleware (same-origin).

### 5. Security Headers

The middleware response propagates Next.js defaults. For production hardening, add custom headers in `middleware.ts`:

```
Strict-Transport-Security
X-Content-Type-Options
X-Frame-Options
Referrer-Policy
```

### 6. Environment Variables

Supabase URL and anon key are exposed as `NEXT_PUBLIC_*` -- they are safe for client-side use (anon key is read-only by default with RLS). Service-role keys are never exposed to the client.

---

## Directory Structure

```
molamaker-site/
├── app/
│   ├── layout.tsx           # Root layout (fonts, metadata, viewport)
│   ├── page.tsx             # Home page (ISR 30s)
│   ├── globals.css          # Global styles + CSS custom properties
│   ├── actions.ts           # Server Actions (signGuestbook, sendContact)
│   ├── error.tsx            # Error boundary
│   ├── loading.tsx          # Suspense fallback
│   ├── not-found.tsx        # 404 page
│   ├── blog/
│   │   └── [slug]/
│   │       └── page.tsx     # Blog post (ISR 60s, SSG params)
│   └── api/
│       └── views/
│           └── route.ts     # POST /api/views
├── components/
│   ├── nav.tsx              # Navigation bar
│   ├── hero.tsx             # Hero section with visitor count
│   ├── about.tsx            # Bio/about section
│   ├── work.tsx             # Project cards
│   ├── writing.tsx          # Blog post list
│   ├── guestbook.tsx        # Guestbook entries + form
│   ├── contact.tsx          # Contact form
│   └── footer.tsx           # Site footer
├── lib/
│   ├── types.ts             # Shared TypeScript types
│   ├── validation.ts        # Zod schemas + sanitize helper
│   ├── rate-limit.ts        # Token-bucket rate limiter
│   └── supabase/
│       ├── server.ts        # Supabase client for Server Components / Actions
│       ├── client.ts        # Supabase client for Browser / Client Components
│       ├── middleware.ts     # Supabase session refresh for middleware
│       └── static.ts        # Supabase client for build-time data fetching
├── middleware.ts             # Next.js Edge Middleware
├── public/                   # Static assets
├── supabase/                 # Supabase local config / migrations
└── docs/                     # Documentation (this directory)
```

### Rationale

- **`app/` by route, not by type** -- Next.js App Router enforces file-system routing; co-locate route-specific logic
- **`components/` flat** -- the component count is small (~8); no need for nested grouping yet
- **`lib/` for shared logic** -- types, validation, rate limiting, and Supabase client factory functions
- **`supabase/` at root** -- standard Supabase CLI convention for migrations and config
- **No `features/` or `modules/`** -- the app is single-page + blog; complexity doesn't warrant domain-grouping yet

---

## Future Considerations

### Markdown Rendering

Blog content is currently stored as plain text in `posts.content`. Adding a markdown renderer (e.g. `unified` + `remark` + `rehype`) would enable rich formatting, code blocks with syntax highlighting, and embedded media.

### Authentication

Supabase Auth is configured but not surfaced in the UI. Potential use cases:
- Admin dashboard for editing blog posts and viewing contact messages
- Authenticated guestbook (link entries to user profiles)

### Dark Mode

CSS custom properties are defined in `globals.css` under `:root`. Adding a `[data-theme="dark"]` selector with a toggle in the nav would enable dark mode support with minimal CSS changes.

### Shared Rate Limiting

The current token bucket is in-memory (per-process). For consistent limits across Vercel serverless instances, migrate to an external store like Upstash Redis with the `@upstash/ratelimit` package.

### Monitoring and Observability

Add structured logging (e.g. Pino) and error tracking (e.g. Sentry) to replace `console.error` calls. Add Vercel Analytics or a custom dashboard for page view trends.
