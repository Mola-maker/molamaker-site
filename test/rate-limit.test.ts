import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRpc = vi.fn();
const mockCreateServiceClient = vi.fn(() => ({ rpc: mockRpc }));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => mockCreateServiceClient(),
}));

import { checkRate, RATE_GUESTBOOK } from '@/lib/rate-limit';

function uniqueKey() {
  return `test:${Math.random().toString(36).slice(2)}`;
}

describe('checkRate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns allowed=true when RPC succeeds under limit (single object)', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { allowed: true, remaining: 4, reset_ms: 0 },
      error: null,
    });

    const result = await checkRate(uniqueKey(), 5, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('returns allowed=true when RPC succeeds under limit (array — PostgREST SETOF)', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ allowed: true, remaining: 4, reset_ms: 0 }],
      error: null,
    });

    const result = await checkRate(uniqueKey(), 5, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('returns allowed=false when RPC reports limit exceeded', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ allowed: false, remaining: 0, reset_ms: 30000 }],
      error: null,
    });

    const result = await checkRate(uniqueKey(), 5, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.resetMs).toBe(30000);
  });

  it('fails closed when RPC returns an error', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: new Error('connection failed'),
    });

    const result = await checkRate(uniqueKey(), 5, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('fails closed when RPC returns empty array', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const result = await checkRate(uniqueKey(), 5, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('fails closed when RPC throws', async () => {
    mockRpc.mockRejectedValueOnce(new Error('timeout'));

    const result = await checkRate(uniqueKey(), 5, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('uses RATE_GUESTBOOK constants correctly', () => {
    expect(RATE_GUESTBOOK.limit).toBe(20);
    expect(RATE_GUESTBOOK.windowMs).toBe(60_000);
  });

  it('passes correct bucket_key, max_count, and window_ms to RPC', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { allowed: true, remaining: 2, reset_ms: 0 },
      error: null,
    });

    await checkRate('test-key', 10, 30000);

    expect(mockRpc).toHaveBeenCalledWith('check_rate', {
      bucket_key: 'test-key',
      max_count: 10,
      window_ms: 30000,
    });
  });
});
