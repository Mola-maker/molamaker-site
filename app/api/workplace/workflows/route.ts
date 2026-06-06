import { NextRequest, NextResponse } from 'next/server';
import { getWPSession } from '@/lib/workplace/session';
import { listStoredWorkflows, addStoredWorkflow, writeAudit } from '@/lib/workplace/db';
import { getAstrbotEnv } from '@/lib/chat/astrbot-env';

// Resolve a reachable health/base URL for a workflow. AstrBot reuses the same
// ASTRBOT_INTERNAL_URL the chat + proxy use, so the live/offline dot reflects the
// real instance instead of always probing localhost.
function healthUrlFor(wf: { id: string; url?: string; port: number }): string {
  if (wf.url) return wf.url;
  if (wf.id === 'astrbot') {
    const url = getAstrbotEnv().url;
    if (url) return url;
  }
  return `http://localhost:${wf.port}`;
}

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
  // Merge hardcoded defaults with persisted workflows (defaults win on id clash).
  const merged: WorkflowDef[] = [...registry];
  const seen = new Set(merged.map((w) => w.id));
  for (const w of await listStoredWorkflows()) {
    if (!seen.has(w.id)) {
      merged.push(w);
      seen.add(w.id);
    }
  }

  const results = await Promise.all(
    merged.map(async (wf) => {
      const alive = await ping(healthUrlFor(wf));
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
  const workflow: WorkflowDef = { id: body.id, name: body.name, port: body.port, url: body.url, githubRepo: body.githubRepo, description: body.description };
  registry.push(workflow);
  await addStoredWorkflow(workflow);
  await writeAudit({
    action: 'workflow_add',
    userId: session.userId,
    userName: session.name,
    ip: session.ip,
    detail: { id: workflow.id, name: workflow.name, port: workflow.port },
  });
  return NextResponse.json({ ok: true, data: { workflow } });
}
