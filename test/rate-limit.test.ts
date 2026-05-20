import { describe, it, expect, afterEach, vi } from 'vitest';
import { checkRate, RATE_GUESTBOOK } from '@/lib/rate-limit';

// Use a unique key per test to avoid state bleed from the module-level Map
let keyCounter = 0;
function uniqueKey() {
  return `test:${++keyCounter}:${Date.now()}`;
}

describe('checkRate', () => {
  it('allows first request within the window', () => {
    const result = checkRate(uniqueKey(), 5, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('allows requests up to the limit', () => {
    const key = uniqueKey();
    const limit = 3;
    const window = 60_000;

    for (let i = 0; i < limit; i++) {
      const result = checkRate(key, limit, window);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(limit - i - 1);
    }
  });

  it('blocks requests that exceed the limit', () => {
    const key = uniqueKey();
    const limit = 2;
    const window = 60_000;

    // Exhaust the tokens
    checkRate(key, limit, window);
    checkRate(key, limit, window);

    // Next request should be blocked
    const blocked = checkRate(key, limit, window);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it('refills tokens after the window elapses', () => {
    // Use fake timers so we can control Date.now()
    vi.useFakeTimers();
    const now = Date.now();

    const key = uniqueKey();
    const limit = 3;
    const window = 1000; // 1 second window

    // Exhaust tokens
    checkRate(key, limit, window);
    checkRate(key, limit, window);
    checkRate(key, limit, window);

    // Should be blocked immediately
    expect(checkRate(key, limit, window).allowed).toBe(false);

    // Advance time past the window for full refill
    vi.advanceTimersByTime(window + 100);

    // Now requests should be allowed again
    const result = checkRate(key, limit, window);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(limit - 1);

    vi.useRealTimers();
  });

  it('returns a positive resetMs', () => {
    const result = checkRate(uniqueKey(), 5, 60_000);
    expect(result.resetMs).toBeGreaterThan(0);
  });

  it('uses RATE_GUESTBOOK constants correctly', () => {
    expect(RATE_GUESTBOOK.limit).toBe(5);
    expect(RATE_GUESTBOOK.windowMs).toBe(60_000);
  });
});
