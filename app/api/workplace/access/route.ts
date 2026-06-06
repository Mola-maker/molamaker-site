import { NextResponse } from 'next/server';
import { getPublicAccess } from '@/lib/workplace/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public: tells the auth gate whether visitors need a password (visitorMode)
// and whether an admin password is configured. No secrets.
export async function GET() {
  return NextResponse.json({ data: await getPublicAccess() });
}
