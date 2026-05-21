# Review Scope

## Target

Full codebase review of molamaker-site — a Next.js 15 (App Router) personal portfolio/journal with Supabase backend, `[locale]` i18n routing (next-intl v4), AstrBot chat integration, and admin functionality.

## Files (157 total — 111 tracked + 46 untracked)

### Core App Router (22 files)
- `app/layout.tsx` — root layout (delegates to [locale])
- `app/page.tsx` — redirect to default locale
- `app/error.tsx`, `app/loading.tsx`, `app/not-found.tsx`
- `app/globals.css` — design system (CSS custom properties, typography, layout, components)
- `app/[locale]/layout.tsx` — locale layout (fonts, metadata, providers)
- `app/[locale]/page.tsx` — home page
- `app/[locale]/about/page.tsx` — about page
- `app/[locale]/blog/page.tsx`, `app/[locale]/blog/[slug]/page.tsx` — blog
- `app/[locale]/work/page.tsx`, `app/[locale]/projects/page.tsx` — portfolio
- `app/[locale]/contact/page.tsx`, `app/[locale]/guestbook/page.tsx` — interaction
- `app/[locale]/chat/page.tsx` — AstrBot chat page (new)
- `app/[locale]/now/page.tsx`, `app/[locale]/uses/page.tsx`
- `app/[locale]/login/page.tsx`, `app/[locale]/support/page.tsx`, `app/[locale]/resources/page.tsx`

### Admin (5 files)
- `app/[locale]/admin/page.tsx`, `app/[locale]/admin/layout.tsx`
- `app/[locale]/admin/actions.ts`, `app/[locale]/admin/sign-out.tsx`
- `app/[locale]/admin/new/page.tsx`, `app/[locale]/admin/edit/[slug]/page.tsx`

### API Routes (4 files)
- `app/api/bot/status/route.ts` — AstrBot health probe (new/rewritten)
- `app/api/chat/send/route.ts` — AstrBot message proxy (new/rewritten)
- `app/api/chat/history/route.ts` — AstrBot history proxy (new)
- `app/api/views/route.ts` — page view tracking
- `app/api/webhooks/bmc/route.ts` — Buy Me a Coffee webhook (untracked)
- `app/auth/callback/route.ts` — Supabase auth callback
- `app/og/route.tsx` — OG image generation
- `app/rss.xml/route.ts`, `app/robots.ts`, `app/sitemap.ts`

### Components (24+ files)
- Layout: `nav.tsx`, `nav-wrapper.tsx`, `footer.tsx`, `locale-switcher.tsx`
- Home: `hero.tsx`, `writing.tsx`, `work.tsx`
- Interactive: `guestbook.tsx`, `contact.tsx`, `comments.tsx`, `support-button.tsx`
- Chat (new): `bot-status-badge.tsx`, `chat.tsx` (re-export), `chat/chat-room.tsx`, `chat/message-bubble.tsx`, `chat/typing-indicator.tsx`
- Visual: `cursor-glow.tsx`, `scroll-reveal.tsx`, `portrait-tilt.tsx`, `konami.tsx`
- Admin: `post-form.tsx`, `delete-button.tsx`
- Misc: `about.tsx`, `annotation-sidebar.tsx`, `annotation-sidebar-wrapper.tsx`, `repo-card.tsx`, `language-bar.tsx`, `spotify-now-playing.tsx`, `skeletons.tsx`, `webring.tsx`

### Lib/Utilities (16 files)
- Validation: `validation.ts` (Zod schemas), `schemas.ts`
- Data: `data/guestbook.ts`, `data/contacts.ts`, `data/posts.ts`, `data/pages.ts`, `data/page-views.ts`
- Security: `rate-limit.ts`, `client-ip.ts`, `hmac-ip.ts` (new), `dedup.ts`, `lib/auth.ts`
- Supabase: `supabase/client.ts`, `supabase/server.ts`, `supabase/middleware.ts`, `supabase/static.ts`, `supabase/env.ts`, `supabase/service.ts`
- Infrastructure: `constants.ts`, `content.ts`, `github.ts`, `language-colors.ts`, `types.ts`

### Config
- `next.config.mjs`, `middleware.ts`, `package.json`, `tsconfig.json`, `vitest.config.ts`

### Database (Supabase)
- `supabase/schema.sql`, `supabase/seed.sql`
- `supabase/migrations/20260101000000_init.sql`, `...00001_rpc_increment.sql`, `...00002_seed_posts.sql`
- `supabase/migrations/20260520000000_auth_and_drafts.sql`, `...00001_indexes.sql`, `...00002_pages.sql`
- `supabase/migrations/20260521000000_supporters.sql`

### Tests (4 files)
- `test/actions.test.ts`, `test/rate-limit.test.ts`, `test/types.test.ts`, `test/setup.ts`

### i18n (4 files)
- `messages/en.json`, `messages/zh.json`, `i18n/request.ts`, `i18n/routing.ts`

### Deploy (3 untracked files)
- `deploy/astrbot/docker-compose.yml`, `deploy/astrbot/.env.template`, `deploy/astrbot/SETUP.md`

### Content (4 markdown files)
- `content/agent-orchestration.md`, `content/astrbot-plugin-design.md`, `content/kernel-rewrite.md`, `content/linux-phone-tinkering.md`, `content/rotational-dynamics.md`

## Flags

- Security Focus: yes (AstrBot chat proxy, auth, webhooks)
- Performance Critical: no (personal site, low traffic)
- Strict Mode: no
- Framework: Next.js 15 (App Router) + React 19 + TypeScript

## Review Phases

1. Code Quality & Architecture
2. Security & Performance
3. Testing & Documentation
4. Best Practices & Standards
5. Consolidated Report
