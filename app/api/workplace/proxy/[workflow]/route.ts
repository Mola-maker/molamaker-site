// Same-origin reverse proxy for workflow UIs loaded in the dashboard iframe.
//
// KNOWN LIMITATION: full HTML apps that reference assets with root-absolute
// paths (e.g. `/static/...`) will NOT resolve through this path-prefixed proxy
// without an asset-path rewrite, or without the upstream app being configured
// with a matching base path. This proxy works best for apps that support a
// base path or use relative asset URLs.
import { NextRequest, NextResponse } from 'next/server';
import { getWPSession } from '@/lib/workplace/session';
import { getAstrbotEnv } from '@/lib/chat/astrbot-env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Last-resort defaults if nothing else is configured.
const DEFAULT_TARGETS: Record<string, string> = {
  astrbot: 'http://127.0.0.1:6185',
};

// Resolve the upstream base URL for a workflow. Priority:
//   1. WORKPLACE_PROXY_<ID>            (explicit per-workflow override)
//   2. the workflow's own canonical connection env
//      (astrbot → ASTRBOT_INTERNAL_URL, the SAME var the chat API uses, so the
//       iframe and the chat never diverge — this fixes the proxy 502 when the
//       real AstrBot isn't on localhost)
//   3. DEFAULT_TARGETS                 (hardcoded localhost fallback)
function targetFor(id: string): string | null {
  const envKey = `WORKPLACE_PROXY_${id.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
  const override = process.env[envKey]?.trim();
  if (override) return override.replace(/\/+$/, '');
  if (id === 'astrbot') {
    const url = getAstrbotEnv().url;
    if (url) return url.replace(/\/+$/, '');
  }
  return DEFAULT_TARGETS[id] ?? null;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ workflow: string }> }) {
  const session = await getWPSession();
  if (!session) return new NextResponse('unauthenticated', { status: 401 });

  const { workflow } = await ctx.params;
  const base = targetFor(workflow);
  if (!base) return new NextResponse('unknown workflow', { status: 404 });

  // Forward the sub-path after /api/workplace/proxy/<workflow>
  const url = new URL(req.url);
  const prefix = `/api/workplace/proxy/${workflow}`;
  const subPath = url.pathname.startsWith(prefix) ? url.pathname.slice(prefix.length) : '';
  const targetUrl = `${base}${subPath || '/'}${url.search}`;

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10_000);
    const upstream = await fetch(targetUrl, {
      headers: { 'accept': req.headers.get('accept') ?? '*/*' },
      signal: ctrl.signal,
      redirect: 'manual',
    });
    clearTimeout(t);

    // Strip framing-blocker headers so it can render inside our iframe
    const headers = new Headers(upstream.headers);
    headers.delete('x-frame-options');
    headers.delete('content-security-policy');
    headers.delete('content-security-policy-report-only');

    return new NextResponse(upstream.body, { status: upstream.status, headers });
  } catch {
    // Escape the workflow id before reflecting it into HTML to avoid XSS.
    const safeId = workflow.replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
    const safeEnv = safeId.toUpperCase().replace(/[^A-Z0-9]/g, '_');
    return new NextResponse(
      `<html><body style="font-family:monospace;padding:24px;color:#8B816E;background:#FAF7F1">Workflow "${safeId}" is not reachable.<br/>Set <code>WORKPLACE_PROXY_${safeEnv}</code> to its URL, or start it on its default port.</body></html>`,
      { status: 502, headers: { 'content-type': 'text/html' } }
    );
  }
}
