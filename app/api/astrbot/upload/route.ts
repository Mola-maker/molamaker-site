import { NextRequest, NextResponse } from 'next/server';
import { validateOrigin } from '@/lib/origin';
import { checkRate } from '@/lib/rate-limit';
import { clientIp } from '@/lib/client-ip';

export const runtime = 'nodejs';

// Same-origin proxy for AstrBot's file-upload endpoint (POST /api/v1/file).
// The browser sends multipart here; we forward it to AstrBot with the server
// API key and return the attachment_id, which the client then references in a
// chat message chain. Only AstrBot supports attachments, so this needs
// ASTRBOT_INTERNAL_URL configured.

const ASTRBOT_URL = process.env.ASTRBOT_INTERNAL_URL;
const ASTRBOT_KEY = process.env.ASTRBOT_API_KEY;

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPE = /^(image\/(png|jpe?g|gif|webp|svg\+xml)|application\/pdf|text\/plain)$/;

export async function POST(req: NextRequest) {
  const origin = validateOrigin(req);
  if (origin) return origin;

  if (!ASTRBOT_URL) {
    return NextResponse.json(
      { error: { code: 'not_configured', message: 'File upload requires AstrBot.' } },
      { status: 503 },
    );
  }

  const ip = await clientIp();
  const rate = await checkRate(`astrbot:upload:${ip}`, 10, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: { code: 'rate_limited', message: 'Too many uploads — slow down.' } },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rate.resetMs / 1000)) } },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: { code: 'bad_request', message: 'expected multipart/form-data' } }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: { code: 'bad_request', message: 'file field required' } }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: { code: 'too_large', message: 'max 10 MB' } }, { status: 413 });
  }
  if (file.type && !ALLOWED_TYPE.test(file.type)) {
    return NextResponse.json({ error: { code: 'unsupported_type', message: 'Unsupported file type.', detail: file.type } }, { status: 415 });
  }

  // Forward as multipart. Do NOT set Content-Type — fetch sets the boundary.
  const upstream = new FormData();
  upstream.append('file', file, file.name || 'upload');

  const headers: Record<string, string> = {};
  if (ASTRBOT_KEY) headers['Authorization'] = `Bearer ${ASTRBOT_KEY}`;

  try {
    const res = await fetch(`${ASTRBOT_URL}/api/v1/file`, {
      method: 'POST',
      headers,
      body: upstream,
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      return NextResponse.json({ error: { code: 'upstream_error', message: 'Upload failed on the server.', status: res.status } }, { status: 502 });
    }
    const j = await res.json().catch(() => ({})) as Record<string, unknown>;
    // Spec documents `{ attachment_id }`; also accept a nested data envelope.
    const data = (j.data && typeof j.data === 'object') ? j.data as Record<string, unknown> : undefined;
    const attachmentId = String(j.attachment_id ?? data?.attachment_id ?? '');
    if (!attachmentId) {
      return NextResponse.json({ error: { code: 'no_attachment_id' } }, { status: 502 });
    }
    const type = file.type.startsWith('image/') ? 'image' : 'file';
    return NextResponse.json({ data: { attachment_id: attachmentId, type, name: file.name } });
  } catch (err) {
    return NextResponse.json(
      { error: { code: 'upstream_error', message: 'Could not reach the upload service.', detail: err instanceof Error ? err.message : 'timeout' } },
      { status: 502 },
    );
  }
}
