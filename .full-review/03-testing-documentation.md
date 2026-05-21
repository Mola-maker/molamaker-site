# Phase 3: Testing & Documentation Review

## Test Coverage Findings

**Overall Grade: D (Inadequate) — 3.9/10**

### Current State
- **27 tests** across **3 spec files** covering ~4% of the codebase
- **0 integration tests, 0 E2E tests** — test pyramid is inverted
- Tested: `guestbookSchema`, `contactSchema`, `checkRate` (rate limiter), compile-time type assertions
- All 27 tests pass — but this is because nothing risky is tested

### Critical Gaps (Untested)
1. **All API routes** — chat send, chat history, bot status, views, webhook, auth callback
2. **All server actions** — signGuestbook, sendContact, savePost, deletePost
3. **Auth guards** — requireAdmin, requireAuth, getCurrentUser
4. **Middleware** — i18n routing, analytics ping, matcher
5. **Data layer** — 5 files (guestbook, contacts, posts, page-views, pages)
6. **Content parsing** — getAllPosts, getPostBySlug, path traversal safety
7. **Client IP** — header parsing, fallback logic
8. **HMAC IP** — hash determinism, secret isolation
9. **5 untested Zod schemas** — pageView, chatMessage, chatHistoryQuery, astrbotReply, astrbotHistory
10. **Rate limiter concurrency** — test suite is fully synchronous, no concurrent access tests

### Test Quality
- **Strengths**: Behavior-focused asserts, proper boundary testing (240/241 chars), unique keys per rate-limit test
- **Weaknesses**: No Unicode testing for i18n paths, no concurrency testing, type tests have near-zero defect-finding power, no negative testing for rate limit edge cases

### Recommended Priority
| Priority | Tests | Effort |
|----------|-------|--------|
| P1 (Critical) | Chat history auth gate test, savePost validation test, rate-limiter concurrency test, content-length bypass test, BMAC Edge test | 9h |
| P2 (High) | Server action integration tests, remaining Zod schemas, clientIp, dedup, DB error logging | 9h |
| P3 (Medium) | E2E guestbook, contact, admin workflow, chat flow, auth guards, path traversal | 15h |
| P4 (Low) | Lighthouse CI, prebuild hook, remove dead type tests | 1.5h |

### Missing Tooling
- `@vitest/coverage-v8` — cannot measure actual coverage
- `msw` — no fetch() mocking for API route tests
- `@playwright/test` — no E2E framework

---

## Documentation Findings

### Critical
1. **README project structure obsolete** — shows flat routes, actual uses `[locale]` routing
2. **Blog content docs contradict implementation** — says "plain text, Markdown not supported" but `react-markdown` + `remark-gfm` are active
3. **`docs/api.md` missing 4 of 7 endpoints** — no docs for chat/send, chat/history, bot/status, webhooks/bmc
4. **API response format inconsistent and undocumented** — 3 different error conventions across 7 endpoints
5. **Zero ADRs** — no architectural decision records for locale migration, dual blog source, CSP unsafe-inline, rate limiter choice, schema duplication

### High
6. **`docs/architecture.md` stale** — flat routes, wrong component tree, 3 of 5 "Future Considerations" already implemented
7. **`supabase/README.md` bare** — no schema overview, no RLS docs, no table listing
8. **No CHANGELOG or migration guide** — breaking changes undocumented

### Medium
9. **`CLAUDE.md` too minimal** (22 lines) — missing build commands, env vars, DB setup, key architectural decisions
10. **Schema duplication undocumented** — `validation.ts` vs `schemas.ts` overlap
11. **AstrBot schemas have zero JSDoc** — unlike other schemas which are well-documented
12. **`lib/auth.ts` has no JSDoc** — 4 exported functions, zero comments
13. **`middleware.ts` has no inline docs** — analytics pattern, path filtering unexplained
14. **SSG vs ISR confusion** — README says ISR, actual uses `generateStaticParams` (SSG)
15. **CSP `'unsafe-inline'` rationale undocumented** — giscus.app requirement not explained
16. **CI/CD pipeline uncommented** — no explanation of Node 24 force flag
17. **Env vars scattered across docs** — no single reference for all required variables

### Low
18. **"Future Considerations" outdated** — implemented items still listed as future
19. **`schema.sql` vs migrations confusing** — no header explaining relationship
20. **Supabase client listing incomplete** — README lists 3 files, actual has 6
21. **`supabase db dump` may not work on free tier** — not verified
