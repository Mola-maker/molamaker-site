import { NextRequest, NextResponse } from 'next/server';
import { validateOrigin } from '@/lib/origin';
import { checkRate } from '@/lib/rate-limit';
import { clientIp } from '@/lib/client-ip';
import { err } from './response';
import { E } from './errors';
import type { ZodSchema } from 'zod';

type Handler<T = void> = (req: NextRequest, ctx: T) => Promise<NextResponse>;

/** Reject requests that fail the origin/CSRF check. */
export function withOrigin(handler: Handler): Handler {
  return async (req, ctx) => {
    const block = validateOrigin(req);
    if (block) return block;
    return handler(req, ctx);
  };
}

/** Reject requests that exceed the sliding-window rate limit. */
export function withRateLimit(
  key: (req: NextRequest) => Promise<string>,
  limit: number,
  windowMs: number,
) {
  return (handler: Handler): Handler =>
    async (req, ctx) => {
      const k = await key(req);
      const rate = await checkRate(k, limit, windowMs);
      if (!rate.allowed) {
        return err(E.RATE_LIMITED, 'Too many requests', 429, {
          'Retry-After': String(Math.ceil(rate.resetMs / 1000)),
        });
      }
      return handler(req, ctx);
    };
}

/** Parse and validate the JSON request body with a Zod schema. */
export function withBody<T>(schema: ZodSchema<T>) {
  return (handler: (req: NextRequest, body: T) => Promise<NextResponse>) =>
    async (req: NextRequest): Promise<NextResponse> => {
      const raw = await req.json().catch(() => ({}));
      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        return err(
          E.VALIDATION_ERROR,
          parsed.error.issues[0]?.message ?? 'Invalid input',
          400,
        );
      }
      return handler(req, parsed.data);
    };
}

// Re-export for convenience so callers can get clientIp from one place.
export { clientIp };
