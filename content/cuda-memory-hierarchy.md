---
title: CUDA memory hierarchy — a practical map
date: 2026-04-10
excerpt: Global, shared, register, L1/L2 — how GPU memory actually behaves under load, and the one mistake that kills every kernel.
tag: systems
read_time: 8
---

Every CUDA performance problem I've ever debugged traces back to the same root cause: treating GPU memory like CPU memory. They share the same name, vaguely the same vocabulary, and almost nothing else. Here's the map I wish I'd had on day one.

## The hierarchy

```
Registers (per-thread, ~255 per SM thread)
  └── Shared memory (per-block, 48–164 KB depending on SM)
       └── L1 cache (per-SM, managed by hardware)
            └── L2 cache (device-wide, ~6–32 MB)
                 └── Global memory (HBM3, 16–80 GB, ~2–3 TB/s)
```

Registers are free. Shared memory is expensive but fast. Global memory is what kills your bandwidth numbers.

## The one mistake

The mistake is writing a kernel that touches global memory in a non-coalesced pattern. Coalescing means: threads in a warp (32 threads) should access consecutive memory addresses so the memory controller can service the whole warp in a single 128-byte transaction.

Non-coalesced access looks like this:

```cuda
// Bad — stride-N access, N warps × N transactions each
__global__ void bad(float* in, float* out, int N) {
    int tid = blockIdx.x * blockDim.x + threadIdx.x;
    out[tid] = in[tid * N]; // stride N — each thread reads a different cache line
}
```

Coalesced access:

```cuda
// Good — consecutive, one transaction per warp
__global__ void good(float* in, float* out) {
    int tid = blockIdx.x * blockDim.x + threadIdx.x;
    out[tid] = in[tid]; // sequential — entire warp in one L1 line
}
```

The difference in throughput is a 10–50× depending on the access stride.

## Shared memory as a programmer-managed L1

The GPU's L1 is hardware-managed and works well for read-heavy workloads. But for patterns the hardware can't predict — matrix transposes, reductions, stencil operations — you reach for shared memory explicitly.

```cuda
__global__ void matTranspose(float* in, float* out, int N) {
    __shared__ float tile[32][33]; // +1 to avoid bank conflicts

    int bx = blockIdx.x * 32, by = blockIdx.y * 32;

    // Coalesced read into shared memory
    tile[threadIdx.y][threadIdx.x] = in[(by + threadIdx.y) * N + bx + threadIdx.x];
    __syncthreads();

    // Coalesced write from transposed tile
    out[(bx + threadIdx.y) * N + by + threadIdx.x] = tile[threadIdx.x][threadIdx.y];
}
```

The `__syncthreads()` barrier is mandatory: you must ensure all threads in the block have finished writing to shared memory before any thread reads it. Skipping it is undefined behavior that produces subtly wrong results — the worst kind.

## The +1 padding trick

Notice `float tile[32][33]` rather than `[32][32]`. Shared memory is divided into 32 banks, each 4 bytes wide. If two threads in the same warp access the same bank in the same clock cycle, they serialize — a *bank conflict*.

For a 32×32 tile, row `i` starts at byte `i * 32 * 4 = i * 128`. Since 128 is a multiple of 128 (32 banks × 4 bytes), row `i` and row `j` of the same column map to the *same* bank. Adding one element of padding shifts each row by 4 bytes, staggering the bank assignments and eliminating the conflict entirely.

One integer of padding, 2× throughput.

## Occupancy vs. register pressure

There's a tradeoff buried in here. More registers per thread = faster kernel (fewer loads), but *fewer* active warps per SM (because the register file is finite). The SM can only run as many warps as fit in the register file simultaneously.

NVCC's `--ptxas-options=-v` will tell you how many registers each kernel uses. The occupancy calculator (available in Nsight) maps register count → warps per SM → theoretical occupancy. Tuning this tradeoff is often the last 10% of performance left on the table after coalescing is fixed.

## What Nsight tells you

```
L1/L2 hit rate, global memory bandwidth, shared memory bank conflicts,
warp occupancy, stall reasons (memory dependency, synchronization, other)
```

If you see `mem_dep` as the top stall reason: you have a coalescing problem.
If you see `sync`: shared memory barriers are serializing warps unnecessarily.
If occupancy is < 50%: register pressure or block size needs tuning.

Start with coalescing. Everything else is commentary.
