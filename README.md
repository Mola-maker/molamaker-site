# molamaker — personal site

A Claude-style portfolio + journal, powered by **Next.js 15 (App Router)** and
**Supabase**. Deployed on **Vercel**.

## What's inside

- **Portfolio** — pinned repos from GitHub as work cards
- **Journal** — Supabase-backed blog posts with view counters
- **Guestbook** — public wall with optimistic updates (Server Actions)
- **Contact** — form that writes to a private `contacts` table
- **Analytics** — middleware logs every page view to `page_views`

## Quickstart

```bash
# 1. install
npm install

# 2. configure
cp .env.local.example .env.local
# paste your Supabase URL + anon key

# 3. set up the database
# open Supabase → SQL Editor, paste supabase/schema.sql, run

# 4. dev
npm run dev
```

Open http://localhost:3000.

## Project structure

```
app/
  page.tsx             # homepage (server component, fetches all data)
  actions.ts           # server actions: guestbook + contact
  layout.tsx           # root layout, fonts, metadata
  globals.css          # full Claude-style stylesheet
  api/views/route.ts   # POST endpoint for analytics
  blog/[slug]/page.tsx # individual blog post with view increment
components/
  nav.tsx              # sticky nav with avatar
  hero.tsx             # client component: live "reading now" counter
  about.tsx            # portrait card + Now sidecard
  work.tsx             # 4 GitHub repo cards (edit the array to add more)
  writing.tsx          # post list (from posts table)
  guestbook.tsx        # client: optimistic-update form + entries
  contact.tsx          # client: form with toast feedback
  footer.tsx
lib/supabase/
  server.ts            # RSC + server-action client
  client.ts            # browser client
  middleware.ts        # session helper for middleware
middleware.ts          # logs page views, refreshes session cookie
supabase/schema.sql    # tables + RLS + RPC + seed
```

## Deploy to Vercel

1. Push to GitHub:
   ```bash
   git init && git add . && git commit -m "init"
   gh repo create molamaker-site --public --source=. --push
   ```
2. Import the repo on [vercel.com](https://vercel.com/new).
3. Add the 3 env vars from `.env.local`.
4. Deploy.

## Editing content

- **Blog posts** → Supabase Dashboard → Table Editor → `posts` (add rows; the
  `content` column is plain text — Markdown rendering is not yet supported).
- **Projects** → `components/work.tsx`, edit the `projects` array.
- **Bio / portrait** → `components/about.tsx` and `components/nav.tsx`
  (the avatar is pulled from your GitHub by URL).
- **Now sidecard** → `components/about.tsx`.

## Notes

- The home page revalidates every 30s (ISR); blog posts every 60s.
- Server actions write through `anon` key with RLS policies enforcing limits
  (240 char messages, 40 char names).
- View counts are atomic via the `increment_view` Postgres function.
- The middleware pings `/api/views` for every non-asset request — no
  third-party analytics needed.
