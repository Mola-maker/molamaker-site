import { NextRequest, NextResponse } from 'next/server';
import { getWPSession } from '@/lib/workplace/session';

export const runtime = 'nodejs';

export type WorkflowDef = {
  id: string;
  name: string;
  port: number;
  url?: string;
  githubRepo?: string;
  description?: string;
};

// Module-level workflow registry (persists within process)
const registry: WorkflowDef[] = [
  { id: 'astrbot', name: 'AstrBot', port: 6185, description: 'AI chat agent platform' },
  { id: 'claude', name: 'ClaudeCode', port: 6186, description: 'Claude CLI agent manager' },
];

async function ping(url: string): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch(url, { signal: ctrl.signal, method: 'GET' });
    clearTimeout(t);
    return res.status < 500;
  } catch { return false; }
}

export async function GET() {
  const results = await Promise.all(
    registry.map(async (wf) => {
      const healthUrl = wf.url ?? `http://localhost:${wf.port}`;
      const alive = await ping(healthUrl);
      return { ...wf, status: alive ? 'live' : 'offline' as const };
    })
  );
  return NextResponse.json({ data: { workflows: results } });
}

export async function POST(req: NextRequest) {
  const session = await getWPSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role === 'viewer') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await req.json() as Partial<WorkflowDef>;
  if (!body.id || !body.name || !body.port) {
    return NextResponse.json({ error: 'id, name, and port are required' }, { status: 400 });
  }
  if (registry.find((w) => w.id === body.id)) {
    return NextResponse.json({ error: 'workflow id already exists' }, { status: 409 });
  }
  registry.push({ id: body.id, name: body.name, port: body.port, url: body.url, githubRepo: body.githubRepo, description: body.description });
  return NextResponse.json({ ok: true, data: { workflow: registry.at(-1) } });
}
