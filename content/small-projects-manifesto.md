---
title: In defense of the small project
date: 2026-05-01
excerpt: The best software I've written ran in under 500 lines. A defense of scope restraint as a form of craft.
tag: craft
read_time: 5
---

A few weeks ago I finished a tool that does exactly one thing: it reads a markdown file, extracts all the headers, and writes a numbered outline to stdout. It's 87 lines of Go. I've used it every day since.

I'm more proud of it than anything I've shipped at scale.

## The tyranny of scope

There's a failure mode in software that nobody talks about candidly: the project that grows until it bends under its own weight. You add a feature because it's "obviously useful." Then another. Then an abstraction to handle both. Then tests for the abstraction. Then documentation for the tests.

Six months later you have a system that does twelve things adequately instead of one thing well. You spend more time maintaining the edifice than using it. The original problem — the reason you started — is somewhere in there, served worse than it was on day one.

> The question is not "what else could this do?" It's "what is this for?"

## Constraints as craft

The 87-line outline extractor could also handle YAML frontmatter, output JSON, filter by depth, follow `[[wiki links]]`, and detect broken anchors. I know this because I thought of all those features while writing it.

I didn't add them because I don't need them yet. If I need them, I'll add them then, and only then. The constraint isn't laziness — it's a deliberate choice to keep the surface area small enough to hold entirely in my head.

Small surface area means:
- No config file to misread
- No --flag to forget
- No version mismatch to debug
- No mental overhead to pay every time I use it

## The small project as complete thought

A 500-line tool can be *finished*. Not abandoned, not archived, not in permanent maintenance mode — *done*. The problem it solves is solved. You can look at the code in six months and understand everything in two minutes.

This is rarer than it sounds. Most software is never finished; it's just used less and less until it's quietly retired. But a small, scoped project can reach a genuine resting state. That feeling — "this is done, and it works" — is worth optimizing for.

## What this looks like in practice

I keep a `bin/` directory of small tools. Things like:

- `outline` — the markdown extractor above
- `today` — prints my daily log template
- `slugify` — converts a phrase to a URL-safe string
- `wordcount` — counts words by file, sorts by length
- `timebox` — runs a command with a visible countdown timer

None of them are longer than 200 lines. None of them have dependencies. All of them get used.

The discipline is this: if a new feature would require a new abstraction, it probably belongs in a *different* tool. Composition at the shell level — pipes, stdin, stdout — is more flexible than building a swiss-army knife.

## The critique

The obvious objection: "but real problems require real complexity." Yes. I build large systems too. I work with databases and distributed queues and authentication layers. That complexity is necessary. I'm not arguing against it.

I'm arguing that the *default* should be small, and that you should need a compelling reason to add each increment of complexity. Not "this would be nice," but "this problem cannot be solved without this."

Most of the time, the small version is enough. The 87 lines do the job. The rest is — however pleasantly it occupies the afternoon — just more code to maintain.

---

The tool is on GitHub if you want it. Or write your own. It'll take an hour and you'll learn more from writing it than from reading mine.
