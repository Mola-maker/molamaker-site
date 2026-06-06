import { NextResponse } from 'next/server';
import { getAstrbotEnv } from '@/lib/chat/astrbot-env';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { url: apiUrl, key: apiKey } = getAstrbotEnv();

  if (!apiUrl) {
    return NextResponse.json(
      { online: false, latencyMs: null, lastCheckedAt: new Date().toISOString() },
      { headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' } },
    );
  }

  const startedAt = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(`${apiUrl}/api/health`, {
      headers: apiKey ? { 'X-API-Key': apiKey } : {},
      signal: controller.signal,
    });

    clearTimeout(timeout);

    return NextResponse.json(
      {
        online: res.ok,
        latencyMs: Date.now() - startedAt,
        lastCheckedAt: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' } },
    );
  } catch {
    return NextResponse.json(
      { online: false, latencyMs: null, lastCheckedAt: new Date().toISOString() },
      { headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' } },
    );
  }
}
