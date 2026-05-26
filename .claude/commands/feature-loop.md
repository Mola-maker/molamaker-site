# Feature Development Loop

Implement a feature end-to-end across multiple passes until all checks pass.

## Usage
```
/feature-loop <feature description>
```

## What This Loop Does

Each iteration:
1. **Implement** — Write code following the feature spec
2. **Verify** — Run lint + type-check + tests
3. **Fix** — Address any failures
4. **Update notes** — Record progress in SHARED_TASK_NOTES.md
5. **Signal done** — Output `FEATURE_LOOP_COMPLETE` when all checks pass and the feature is working

## Instructions

Read SHARED_TASK_NOTES.md at the start of every iteration (create it if it doesn't exist).

### Step 1: Understand the current state
- Read SHARED_TASK_NOTES.md to understand what was done in prior iterations
- Check `git status` and `git diff` to see current working tree state
- If first iteration: write an initial plan to SHARED_TASK_NOTES.md

### Step 2: Implement
- Follow Next.js 15 App Router conventions (app/[locale]/...)
- All pages go under `app/[locale]/` — API routes go under `app/api/` (not localized)
- Use next-intl v4 for any user-facing strings (add keys to messages/en.json AND messages/zh.json)
- Use Supabase for data — match existing RLS patterns in supabase/migrations/
- Use zod for validation at API boundaries
- Match existing TypeScript patterns (strict, no `any`)

### Step 3: Verify
Run these commands in order and capture output:
```
npm run lint 2>&1
npx tsc --noEmit 2>&1
npm test 2>&1
```

### Step 4: Fix failures
- Fix every lint error (zero warnings allowed — `--max-warnings 0` is enforced)
- Fix every TypeScript error
- Fix every failing test
- If same error repeats 3 times, stop and surface the blocker to the user

### Step 5: Update SHARED_TASK_NOTES.md
Add a section like:
```markdown
## Iteration N — YYYY-MM-DD
- [x] Completed: what was done
- [ ] Remaining: what still needs work
- Notes: any non-obvious decisions made
```

### Step 6: Signal completion
When lint, tsc, and tests all pass AND the feature is functionally complete, output:
```
FEATURE_LOOP_COMPLETE
```

## Stack Reference
- Next.js 15, React 19, TypeScript strict
- next-intl v4, locales: en/zh
- Supabase (supabase-js v2, @supabase/ssr)
- Zod v4 for validation
- Vitest + @testing-library/react for tests
- GSAP + Lenis for animations (existing patterns in components/redesign/)
