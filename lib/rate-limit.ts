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

    if (error || !data || (Array.isArray(data) && data.length === 0)) {
      // Backend reachable but returned nothing usable (missing RPC, bad row):
      // fail OPEN so a limiter misconfiguration can't lock every user out.
      // The only legitimate "deny" is a genuine over-limit row, handled below.
      return { allowed: true, remaining: limit, resetMs: 0 };
    }

    // PostgREST returns SETOF results as an array — unwrap the first row
    const row = Array.isArray(data) ? data[0] : data;
    return {
      allowed: Boolean(row?.allowed),
      remaining: Number(row?.remaining ?? 0),
      resetMs: Number(row?.reset_ms ?? 0),
    };
  } catch {
    // Backend down (e.g. SUPABASE_SERVICE_ROLE_KEY unset on ECS → createServiceClient
    // throws): don't lock users out. Brute-force window only lapses while Supabase
    // is unreachable; auth/login routes stay usable. See deploy runbook.
    return { allowed: true, remaining: limit, resetMs: 0 };
  }
}

/** 20 guestbook entries per 60 seconds per IP. */
export const RATE_GUESTBOOK = { limit: 20, windowMs: 60_000 };
/** 3 contact messages per 60 seconds per IP. */
export const RATE_CONTACT = { limit: 3, windowMs: 60_000 };
/** 60 page-view pings per 60 seconds per IP. */
export const RATE_VIEWS = { limit: 60, windowMs: 60_000 };
/** 20 chat messages per 60 seconds per key (IP or sessionId). */
export const RATE_CHAT = { limit: 20, windowMs: 60_000 };
