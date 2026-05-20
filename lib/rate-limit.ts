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

export const RATE_GUESTBOOK = { limit: 5, windowMs: 60_000 };
export const RATE_CONTACT = { limit: 3, windowMs: 60_000 };
export const RATE_VIEWS = { limit: 60, windowMs: 60_000 };
