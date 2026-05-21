---
title: Designing an agent orchestrator — lessons from -MathModel
date: 2026-02-03
excerpt: Five specialist agents, one shared JSON context, and a lot of things that broke.
read_time: 6
---

-MathModel started as a bet: could five independent LLM agents coordinate through a shared JSON workspace to solve math modeling problems? The answer was yes, but not in the way I expected.

**The architecture.** One orchestrator agent reads the problem description, decomposes it into subtasks, and dispatches them to five specialists: DataAnalyzer, ModelBuilder, Solver, Validator, and Reporter. Each specialist reads from and writes to a shared JSON context. The orchestrator monitors the context and decides when to move on.

**What worked.** The shared JSON context was surprisingly effective. Specialists didn't need to parse each other's natural language — they read structured data. The ModelBuilder wrote equations as JSON arrays; the Solver consumed them directly. This clean interface between agents eliminated most of the hallucination cascades that plague multi-agent systems.

**What broke.** The orchestrator kept making up tasks that didn't exist. Given a vague problem description, it would invent subproblems that sounded plausible but weren't asked. Mitigation: a strict task-schema validation step before dispatching.

**Token budget.** Five agents reading and writing to a shared context adds up fast. A typical problem consumed ~50K tokens across all agents. For MCM/ICM competition problems, this was acceptable. For real-time applications, it's not.

**The insight.** Multi-agent systems don't fail because agents are dumb. They fail because agents don't share enough context — or share too much. The shared JSON workspace hit a sweet spot: structured enough for machines, readable enough for humans debugging why the Solver produced negative probabilities.
