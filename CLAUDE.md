# molamaker-site — Claude Code project guide

## Stack
Next.js 15 (App Router), React 19, Supabase, next-intl v4, TypeScript

## Routing
- All pages under `app/[locale]/...` (`en`, `zh`)
- `next-intl` middleware handles locale detection + redirect
- API routes at `app/api/` (not localized)
- Server actions at stable import paths (not under `[locale]`)

## Directory names with brackets
`[locale]` and `[slug]` are Next.js dynamic route segments. When using
PowerShell `Copy-Item`, `Remove-Item`, or `Get-ChildItem` with these paths,
always use `-LiteralPath` — PowerShell interprets `[...]` as wildcard
character classes by default.

## Multi-model workflow
The multi-execute workflow (`/multi-execute`, `/ecc:multi-execute`) requires
`~/.claude/bin/codeagent-wrapper` and `~/.claude/.ccg/prompts/` — not present
on this machine. Do not attempt external model calls; implement directly.
