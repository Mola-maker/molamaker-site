import { headers } from 'next/headers';

/**
 * Extract client IP from request headers.
 *
 * Trust order: x-real-ip (set by nginx proxy_set_header $remote_addr),
 * then x-forwarded-for (set by nginx via proxy_add_x_forwarded_for).
 * Never trust the first value of x-forwarded-for from untrusted clients.
 *
 * On Vercel: the platform strips client-supplied x-forwarded-for; both are safe.
 * On ECS: nginx must be configured with:
 *   proxy_set_header X-Real-IP $remote_addr;
 *   proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get('x-real-ip') ||
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '127.0.0.1'
  );
}
