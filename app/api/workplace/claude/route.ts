import { NextRequest } from 'next/server';
import { spawn } from 'child_process';
import { getWPSession } from '@/lib/workplace/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getWPSession();
  if (!session) return new Response('unauthenticated', { status: 401 });

  const { searchParams } = req.nextUrl;
  const prompt = searchParams.get('prompt') ?? '';
  const flags = ['--print', '--no-permissions-prompt-cache'];
  if (prompt) flags.push('-p', prompt);

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      const send = (type: string, data: string) => {
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify({ type, data })}\n\n`));
        } catch { /* client disconnected */ }
      };

      const proc = spawn('claude', flags, {
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      proc.stdout.on('data', (chunk: Buffer) => send('stdout', chunk.toString()));
      proc.stderr.on('data', (chunk: Buffer) => send('stderr', chunk.toString()));
      proc.on('close', (code) => {
        send('exit', String(code ?? 0));
        try { controller.close(); } catch { /* already closed */ }
      });
      proc.on('error', (err) => {
        send('error', err.message);
        try { controller.close(); } catch { /* already closed */ }
      });

      req.signal.addEventListener('abort', () => {
        proc.kill();
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
