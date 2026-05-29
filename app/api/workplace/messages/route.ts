import { NextRequest } from 'next/server';
import { messageBus } from '@/lib/workplace/bus';
import type { BusMessage } from '@/lib/workplace/bus';
import { getWPSession } from '@/lib/workplace/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getWPSession();
  if (!session) return new Response('unauthenticated', { status: 401 });

  const history = messageBus.getHistory(50);

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();

      const send = (msg: BusMessage) => {
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(msg)}\n\n`));
        } catch { /* client disconnected */ }
      };

      // Send backlog
      for (const msg of history) send(msg);

      messageBus.on('message', send);

      req.signal.addEventListener('abort', () => {
        messageBus.off('message', send);
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
