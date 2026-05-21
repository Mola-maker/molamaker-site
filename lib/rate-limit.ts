import { createServiceClient } from '@/lib/supabase/service';

/**
 * Postgres-backed sliding-window rate limiter.
 *
 * Calls the `check_rate` RPC function (see supabase/migrations) which
 * atomically counts entries in the current window and inserts a new row
 * if under the limit. State lives in Supabase, so this works correctly
 * on Vercel serverless, PM2 cluster mode, and multi-container deploys.
 */

export async function checkRate(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; remaining: number; resetMs: number }> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.rpc('check_rate', {
      bucket_key: key,
      max_count: limit,
      window_ms: windowMs,
    });

    if (error || !data) {
      return { allowed: true, remaining: limit - 1, resetMs: 0 };
    }

    return {
      allowed: Boolean(data.allowed),
      remaining: Number(data.remaining),
      resetMs: Number(data.reset_ms),
    };
  } catch {
    return { allowed: true, remaining: limit - 1, resetMs: 0 };
  }
}

/** 5 guestbook entries per 60 seconds per IP. */
export const RATE_GUESTBOOK = { limit: 5, windowMs: 60_000 };
/** 3 contact messages per 60 seconds per IP. */
export const RATE_CONTACT = { limit: 3, windowMs: 60_000 };
/** 60 page-view pings per 60 seconds per IP. */
export const RATE_VIEWS = { limit: 60, windowMs: 60_000 };
/** 20 chat messages per 60 seconds per key (IP or sessionId). */
export const RATE_CHAT = { limit: 20, windowMs: 60_000 };
