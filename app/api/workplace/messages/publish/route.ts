import { NextRequest, NextResponse } from 'next/server';
import { messageBus } from '@/lib/workplace/bus';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = await req.json() as { workflow?: string; text?: string; level?: string };
  if (!body.workflow || !body.text) {
    return NextResponse.json({ error: 'workflow and text required' }, { status: 400 });
  }
  const msg = messageBus.publish({
    workflow: body.workflow,
    text: body.text,
    level: (body.level as 'info' | 'warn' | 'error') ?? 'info',
  });
  return NextResponse.json({ ok: true, data: { msg } });
}
