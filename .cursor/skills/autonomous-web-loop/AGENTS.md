# Parallel Subagent Orchestration

Reference for the `autonomous-web-loop` skill. Covers which subagent to pick
and how to fan out work without bloating the orchestrator's context.

## Core Principle

Subagents exist to **offload work and context**. Heavy exploration, bulk edits,
and focused reviews happen inside subagents; only a tight summary returns to the
orchestrator. Never delegate the whole user task to one subagent and relay its
output — keep ownership of synthesis and the verification gate.

## When to Parallelize

Fan out **only** independent slices, after the shared contract (types, API
shape, DB schema) is fixed. Send a single message with multiple `Task` calls so
they run concurrently.

| Situation | Action |
|-----------|--------|
| Independent UI + API + tests | One agent per slice, in parallel |
| Unfamiliar area to scope | One+ `explore` agents in parallel |
| Code just written | `code-reviewer` + `security-reviewer` in parallel |
| Build/type errors | Single `*-build-resolver` agent with error text |
| Shared, unsettled contract | Keep sequential — do NOT parallelize |

## Agent Catalog (this stack)

| Agent | Use for |
|-------|---------|
| `explore` | Read-only codebase search/scoping (quick / medium / very thorough) |
| `generalPurpose` | Multi-step research + edits when no specialist fits |
| `planner` | Implementation plan for a large feature/refactor |
| `react-reviewer` | Review `.tsx`/`.jsx` and React logic |
| `typescript-reviewer` | Review `.ts`/`.js` for type safety + correctness |
| `react-build-resolver` | Fix React/Next build failures |
| `build-error-resolver` | Fix general build/type errors (minimal diffs) |
| `database-reviewer` | Review SQL/migrations/schema (Supabase/Postgres) |
| `e2e-runner` | Playwright E2E for critical flows |
| `code-reviewer` | General quality review after writing code |
| `security-reviewer` | Inputs, auth, secrets, OWASP review pre-commit |
| `performance-optimizer` | Bundle size, render perf, bottlenecks |
| `refactor-cleaner` | Dead code / duplicate cleanup |
| `tdd-guide` | Tests-first for a new feature or bug fix |

If the user requests a specific model, only pass it via the `Task` `model`
field if it's one of the allowed slugs; otherwise tell them it's unavailable.

## Subagent Prompt Template

Each subagent starts fresh and cannot see this chat. Make every prompt
self-contained:

```
GOAL: <one sentence>
CONTEXT: <relevant files/paths, the shared contract: types, API shape, schema>
CONSTRAINTS: <stack conventions, do/don't, files to avoid>
DELIVERABLE: <exactly what to implement or analyze>
RETURN: a short structured summary — files changed, key decisions,
        follow-ups/risks. Do NOT paste full file contents.
```

## Background vs Blocking

- Run agents in the background when the user is multitasking or work is
  independent; keep making progress instead of polling.
- You're notified on completion. Only synthesize multiple background results, or
  surface a blocker, in your own message.

## Anti-Patterns

- Parallelizing work that shares an unsettled type/API contract → merge conflicts.
- Vague subagent prompts that force the agent to re-explore everything.
- Asking subagents to return whole files (defeats the context savings).
- Skipping the orchestrator-owned verification gate after agents finish.
