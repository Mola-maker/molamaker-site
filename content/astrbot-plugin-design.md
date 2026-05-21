---
title: How I built an error-catching AstrBot plugin in a weekend
date: 2026-04-01
excerpt: A terminal-watching plugin that catches your errors before you finish swearing.
read_time: 4
---

The idea came from frustration: I'd run a long training script, walk away, and come back to find it crashed 10 minutes in with an opaque CUDA error. What if a bot watched the terminal and told me what went wrong?

**The plugin architecture.** AstrBot's plugin system is hook-based. My plugin registers a terminal output hook that watches for error patterns — Python tracebacks, CUDA errors, `RuntimeError`, `Segmentation fault`. When it catches one, it sends a formatted message through whatever IM platform AstrBot is connected to.

**Pattern matching.** Simple regex catches most errors. The tricky part is false positives — not every mention of "error" in terminal output is an actual crash. A multi-pass filter: first pass checks for known error signatures, second pass checks context (is the process still running? did it exit with non-zero?), third pass decides whether to notify.

**The naming.** `astrbot_plugin_whythemistake` — a play on "why the mistake." The README says: "Watches your terminal, catches errors as they happen, and suggests fixes before you've finished swearing."

**What I'd do differently.** The plugin currently uses hardcoded error patterns. A better approach would be a small classifier model that learns what errors look like in your specific workflow. But for a weekend project, regex works surprisingly well. Terminal output is more structured than people think — compilers, runtimes, and OS kernels have been emitting machine-readable error messages for decades.
