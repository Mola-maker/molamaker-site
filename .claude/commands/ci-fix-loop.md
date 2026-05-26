# CI Fix Loop

Run the full CI pipeline locally and fix every failure until all checks are green.

## Usage
```
/ci-fix-loop
```
Optionally: `/ci-fix-loop fix only lint` to scope the loop.

## What This Loop Does

Mirrors exactly what `.github/workflows/ci.yml` runs:
1. `npm run lint` — ESLint, zero warnings
2. `npx tsc --noEmit` — TypeScript strict check
3. `npm run build` — Next.js production build
4. `npm test` — Vitest unit tests
5. `npm audit` — Dependency audit (continue-on-error, surface but don't block)

Iterates until all 4 required steps pass.

## Instructions

### Step 1: Run the full pipeline
Execute each command and capture full output:
```bash
npm run lint 2>&1
npx tsc --noEmit 2>&1
npm run build 2>&1
npm test 2>&1
npm audit --audit-level=moderate 2>&1
```

Report: which steps passed, which failed, exact error messages.

### Step 2: Triage failures
For each failure, classify as:
- **A: Quick fix** — missing import, wrong type, lint rule violation
- **B: Logic fix** — test assertion wrong, component behavior broken
- **C: Blocker** — build error that requires architectural decision

Fix A and B immediately. For C, stop and surface to user.

### Step 3: Fix in priority order
1. TypeScript errors first (they often cause lint errors too)
2. Lint errors (zero tolerance — `--max-warnings 0`)
3. Build failures
4. Test failures

Rules:
- Do NOT suppress errors with `// @ts-ignore` or `eslint-disable` unless absolutely unavoidable and the reason is documented
- Do NOT change tests to make them pass — fix the code under test
- Match the existing code style in each file touched

### Step 4: Re-run failing checks
After each fix batch, re-run only the checks that were failing to verify. Don't re-run everything until all individual checks pass.

### Step 5: Final full run
When all individual checks pass, run the full pipeline once more to confirm nothing regressed.

### Step 6: Signal completion
When all 4 required checks are green, output:
```
CI_FIX_LOOP_COMPLETE
```
With a summary of: what was broken, what was fixed, files changed.

## Error Reference for This Project

| Error Pattern | Likely Cause | Fix |
|---------------|--------------|-----|
| `'X' is defined but never used` | Unused import/var | Remove it |
| `Type 'X' is not assignable to 'Y'` | Missing type cast or wrong shape | Fix the type, not the cast |
| `Module not found: Can't resolve 'X'` | Missing dependency or wrong path | Check actual path, check package.json |
| `useTranslations` in Server Component | next-intl misuse | Use `getTranslations` (async) in server, `useTranslations` in client |
| `cookies()` must be awaited | Next.js 15 API change | `await cookies()` |
| Supabase type mismatch | DB types stale | Run `npm run db:types` |

## CI Pipeline (for reference)
```yaml
- npm run lint          # ESLint --max-warnings 0
- npx tsc --noEmit      # TypeScript strict
- npm run build         # Next.js production build
- npm test              # Vitest
- npm audit             # Advisory only (continue-on-error)
```
