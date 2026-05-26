// Deprecated 2025-Q2: routes split into /api/music/search and /api/music/[id].
// Keep until 2026-Q2 to allow cached clients and external consumers to migrate.
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { error: { code: 'moved', message: 'Use /api/music/search or /api/music/<id>' } },
    { status: 410 },
  );
}
