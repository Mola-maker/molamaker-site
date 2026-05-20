const buckets = new Map<
  string,
  { tokens: number; lastRefill: number }
>();

const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function maybeCleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  const expiry = now - 10 * 60 * 1000;
  for (const [k, v] of buckets) {
    if (v.lastRefill < expiry) buckets.delete(k);
  }
}

/**
 * Token-bucket rate limiter (in-memory, per-process).
 *
 * Each bucket starts full ('limit' tokens) and refills linearly over
 * 'windowMs'. One token is consumed per allowed request. Buckets are
 * cleaned up after 10 minutes of inactivity.
 *
 * @param key      — unique bucket identifier (e.g. "gb:192.168.1.1")
 * @param limit    — maximum tokens (burst capacity)
 * @param windowMs — refill window in milliseconds
 * @returns
 *   allowed   — whether the request should proceed
 *   remaining — tokens left after this request
 *   resetMs   — estimated milliseconds until a token refills
 */
export function checkRate(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetMs: number } {
  maybeCleanup();
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket) {
    bucket = { tokens: limit, lastRefill: now };
    buckets.set(key, bucket);
  }

  const elapsed = now - bucket.lastRefill;
  const refill = (elapsed / windowMs) * limit;
  bucket.tokens = Math.min(limit, bucket.tokens + refill);
  bucket.lastRefill = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return {
      allowed: true,
      remaining: Math.floor(bucket.tokens),
      resetMs: Math.ceil(windowMs - (elapsed % windowMs)),
    };
  }

  return {
    allowed: false,
    remaining: 0,
    resetMs: Math.ceil(windowMs - (elapsed % windowMs)),
  };
}

/** 5 guestbook entries per 60 seconds per IP. */
export const RATE_GUESTBOOK = { limit: 5, windowMs: 60_000 };
/** 3 contact messages per 60 seconds per IP. */
export const RATE_CONTACT = { limit: 3, windowMs: 60_000 };
/** 60 page-view pings per 60 seconds per IP. */
export const RATE_VIEWS = { limit: 60, windowMs: 60_000 };
