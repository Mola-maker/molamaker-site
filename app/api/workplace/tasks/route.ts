import { NextRequest, NextResponse } from 'next/server';
import { getWPSession } from '@/lib/workplace/session';
import { listTasks, createTask, updateTaskStatus, deleteTask, type TaskStatus } from '@/lib/workplace/db';

// GET /api/workplace/tasks — all roles
export async function GET() {
  const session = await getWPSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const tasks = await listTasks();
  return NextResponse.json({ data: tasks });
}

// POST /api/workplace/tasks — contributor+
export async function POST(req: NextRequest) {
  const session = await getWPSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role === 'viewer') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const title = String(body.title ?? '').trim();
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 });

  const task = await createTask({
    title,
    description: String(body.description ?? ''),
    status: (body.status as TaskStatus) ?? 'todo',
    repoUrl: String(body.repoUrl ?? ''),
    createdBy: session.userId,
    createdByName: session.name,
  });

  if (!task) return NextResponse.json({ error: 'failed to create task' }, { status: 500 });
  return NextResponse.json({ data: task }, { status: 201 });
}

// PATCH /api/workplace/tasks — contributor+ (move card)
export async function PATCH(req: NextRequest) {
  const session = await getWPSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role === 'viewer') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const id = String(body.id ?? '').trim();
  const status = body.status as TaskStatus;
  if (!id || !['todo', 'doing', 'done'].includes(status)) {
    return NextResponse.json({ error: 'id and valid status required' }, { status: 400 });
  }

  const ok = await updateTaskStatus(id, status, typeof body.position === 'number' ? body.position : undefined);
  if (!ok) return NextResponse.json({ error: 'update failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/workplace/tasks — admin+
export async function DELETE(req: NextRequest) {
  const session = await getWPSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!['admin', 'owner'].includes(session.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id') ?? '';
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const ok = await deleteTask(id);
  if (!ok) return NextResponse.json({ error: 'delete failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
