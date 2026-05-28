import { NextResponse } from 'next/server';
import { getWPSession } from '@/lib/workplace/session';

export const runtime = 'nodejs';

export async function GET() {
  const session = await getWPSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  return NextResponse.json({ data: { user: session } });
}
