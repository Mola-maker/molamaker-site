# Review Scope

## Target

Full codebase review of **molamaker-site** — a Next.js 15 personal portfolio/journal site with Supabase backend.

## Architecture Overview

- **Framework:** Next.js 15.5+ (App Router) with React 19
- **Styling:** Global CSS with BEM-style class naming (361 lines, no CSS Modules)
- **Backend:** Supabase (PostgreSQL) via `@supabase/ssr` and `@supabase/supabase-js`
- **Fonts:** Fraunces (serif headings), DM Sans (body), JetBrains Mono (monospace labels)
- **Rendering:** Server Components + ISR (30-60s revalidate)

## Files

### Config (3)
| File | Purpose |
|------|---------|
| `package.json` | Dependencies and scripts |
| `tsconfig.json` | TypeScript configuration |
| `next.config.mjs` | Next.js configuration |

### App Router (5)
| File | Purpose |
|------|---------|
| `app/layout.tsx` | Root layout + metadata + Google Fonts loading |
| `app/page.tsx` | Home page (server component, ISR 30s) |
| `app/actions.ts` | Server actions: guestbook signing, contact form |
| `app/api/views/route.ts` | POST endpoint for page view tracking |
| `app/blog/[slug]/page.tsx` | Blog post detail page (ISR 60s) |

### Components (8)
| File | Purpose |
|------|---------|
| `components/nav.tsx` | Sticky navigation bar |
| `components/hero.tsx` | Hero section with simulated live-reader counter |
| `components/about.tsx` | About section with portrait image + "Now" sidebar card |
| `components/work.tsx` | Project showcase grid (hardcoded project data) |
| `components/writing.tsx` | Blog post list from Supabase |
| `components/guestbook.tsx` | Guestbook with optimistic insert + rollback |
| `components/contact.tsx` | Contact form with success feedback |
| `components/footer.tsx` | Site footer |

### Lib / Supabase (3)
| File | Purpose |
|------|---------|
| `lib/supabase/client.ts` | Browser Supabase client (public env vars) |
| `lib/supabase/server.ts` | Server Supabase client (exports `updateSession`) |
| `lib/supabase/middleware.ts` | Identical copy of server.ts |

### Middleware + Styles (2)
| File | Purpose |
|------|---------|
| `middleware.ts` | Analytics fire-and-forget ping + session refresh |
| `app/globals.css` | Global stylesheet (361 lines) |

### Total: 21 files

## Flags

- Security Focus: no
- Performance Critical: no
- Strict Mode: no
- Framework: nextjs

## Review Phases

1. Code Quality & Architecture
2. Security & Performance
3. Testing & Documentation
4. Best Practices & Standards
5. Consolidated Report
