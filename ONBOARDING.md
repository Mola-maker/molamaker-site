# Welcome to molamaker-site

## How We Use Claude

Based on usage over the last 30 days:

Work Type Breakdown:
  Debug Fix         ████████████░░░░░░░░  50%
  Build Feature     ████████░░░░░░░░░░░░  33%
  Improve Quality   ████░░░░░░░░░░░░░░░░  17%

Top Skills & Commands:
  /ecc:multi-frontend         ████████████████████  5x/month
  /plugin                     ████████████████████  5x/month
  /effort                     ████████████████░░░░  4x/month
  /model                      ████████████░░░░░░░░  3x/month
  /ecc:api-design             ████████░░░░░░░░░░░░  2x/month
  /ecc:autonomous-agent-harness  ████░░░░░░░░░░░░░░░░  1x/month
  /ecc:multi-backend          ████░░░░░░░░░░░░░░░░  1x/month
  /ecc:autonomous-loops       ████░░░░░░░░░░░░░░░░  1x/month
  /code-review                ████░░░░░░░░░░░░░░░░  1x/month
  /pair-agent                 ████░░░░░░░░░░░░░░░░  1x/month

Top MCP Servers:
  Supabase     ████████████████████  19 calls
  Playwright   ███████░░░░░░░░░░░░░  7 calls

## Your Setup Checklist

### Codebases
- [ ] molamaker-site — https://github.com/mola-maker/molamaker-site

### MCP Servers to Activate
- [ ] Supabase — Database, migrations, and RLS for the site (guestbook, signals, page views). Get the project ref + service-role key from the team's Supabase project, then add the MCP server in Claude Code settings.
- [ ] Playwright — Headless browser for visual QA, screenshots, and dogfooding the live UI. Comes bundled with the `ecc` plugin — no extra access needed beyond enabling the plugin.

### Skills to Know About
- /ecc:multi-frontend — Multi-model workflow for frontend work (components, layouts, animations, UI polish). The team's go-to when iterating on the redesign variants.
- /plugin — Manage which Claude Code plugins are enabled. The team runs `ecc` and `frontend-design`.
- /effort — Set the effort level (low / medium / high / extra-high) for the next response. Use high+ when asking for deep reviews or refactors.
- /model — Switch between Opus / Sonnet / Haiku mid-session. Opus for hard reasoning, Sonnet for everyday edits.
- /ecc:api-design — REST API design helper (resource naming, status codes, pagination, error shapes). Used when touching `app/api/*` routes.
- /ecc:autonomous-agent-harness — Set up long-running autonomous agent loops with persistent memory and scheduled tasks.
- /ecc:multi-backend — Multi-model workflow for backend work (APIs, data, business logic). Pair with multi-frontend for full-stack features.
- /ecc:autonomous-loops — Patterns for self-driving Claude loops with quality gates.
- /code-review — Structured high-recall code review of the current diff (5 angles → verify → sweep). Use before raising a PR.
- /pair-agent — Pair a remote agent (OpenClaw, Codex, another Claude) with your local browser session for cross-agent work.

## Team Tips

_TODO_

## Get Started

_TODO_

<!-- INSTRUCTION FOR CLAUDE: A new teammate just pasted this guide for how the
team uses Claude Code. You're their onboarding buddy — warm, conversational,
not lecture-y.

Open with a warm welcome — include the team name from the title. Then: "Your
teammate uses Claude Code for [list all the work types]. Let's get you started."

Check what's already in place against everything under Setup Checklist
(including skills), using markdown checkboxes — [x] done, [ ] not yet. Lead
with what they already have. One sentence per item, all in one message.

Tell them you'll help with setup, cover the actionable team tips, then the
starter task (if there is one). Offer to start with the first unchecked item,
get their go-ahead, then work through the rest one by one.

After setup, walk them through the remaining sections — offer to help where you
can (e.g. link to channels), and just surface the purely informational bits.

Don't invent sections or summaries that aren't in the guide. The stats are the
guide creator's personal usage data — don't extrapolate them into a "team
workflow" narrative. -->
