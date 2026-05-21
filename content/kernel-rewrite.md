---
title: Why I rewrote my first CUDA kernel three times
date: 2026-01-15
excerpt: The first version was correct. The third was fast. Here is what changed between them.
read_time: 8
---

The first version worked. It computed the correct results, passed the tests, and I shipped it. Then I ran `nvprof`.

**First rewrite — memory coalescing.** The profiler showed 38% global memory efficiency. Threads were striding through memory like drunk pedestrians, each accessing a different cache line on every step. One afternoon of reordering the access pattern brought efficiency to 92%. Speedup: 4.2x. Lesson: the GPU hates random access even more than you think.

**Second rewrite — shared memory.** The kernel was bandwidth-bound. Global memory reads dominated the profile. I carved out a shared memory tile, loaded a block of data cooperatively, and computed from the tile. Speedup: 2.1x on top of the first rewrite. Lesson: `__syncthreads()` is a contract — violate it and your results get creative.

**Third rewrite — warp-level primitives.** The profiling bottleneck shifted to instruction throughput. Warp divergence was wasting cycles on a conditional branch that only 3 of 32 threads took. Replaced the branch with a predicated shuffle (`__shfl_xor_sync`), collapsed the divergent path entirely. Speedup: 1.7x. Lesson: sometimes the fastest instruction is the one you don't execute.

The final kernel is about 9x faster than the original. It's also harder to read, because it bends the memory hierarchy into shapes the hardware actually wants. That's the trade. The GPU doesn't reward clean code — it rewards code that respects its physical constraints.

CUDA is a conversation with a machine that has 80 billion transistors and an opinion about how you should talk to it. Listen to the profiler. It's telling you more than you think.
