import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAdmin } from '@/lib/auth';

// Static fallback so the feature works with no DB.
const STATIC_GLOSSARY: Record<string, string> = {
  'CUDA':        'NVIDIA\'s parallel computing platform and API for GPU programming.',
  'kernel':      'In GPU programming, a function that runs in parallel across thousands of CUDA threads.',
  'warp':        'A group of 32 CUDA threads that execute together in lock-step on the same SM.',
  'SM':          'Streaming Multiprocessor — the core processing unit in an NVIDIA GPU.',
  'LLM':         'Large Language Model — a transformer-based neural network trained on text at scale.',
  'AstrBot':     'An open-source agentic IM chatbot framework integrating LLMs and messaging platforms.',
  'MCM':         'Mathematical Contest in Modeling — a collegiate applied math competition.',
  'ECC':         'Elliptic-Curve Cryptography — public-key crypto based on algebraic curves over finite fields.',
  'HMAC':        'Hash-based Message Authentication Code — a MAC using a cryptographic hash function and a secret key.',
  'SSE':         'Server-Sent Events — a one-way HTTP push mechanism from server to browser.',
  'RLS':         'Row-Level Security — Supabase/PostgreSQL feature that enforces per-row access policies.',
  'Playwright':  'A cross-browser browser automation library from Microsoft.',
  'occupancy':   'In CUDA, the ratio of active warps to the maximum supported warps per SM.',
  'bank conflict': 'A performance penalty in CUDA shared memory when multiple threads in a warp access the same memory bank simultaneously.',
};

export const revalidate = 0;

// GET /api/glossary → { data: Record<term, definition> }
export async function GET() {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ data: STATIC_GLOSSARY });
  }

  try {
    const { data } = await supabase
      .from('glossary')
      .select('term, definition')
      .order('term');

    if (!data || data.length === 0) {
      return NextResponse.json({ data: STATIC_GLOSSARY });
    }

    const merged: Record<string, string> = { ...STATIC_GLOSSARY };
    for (const row of data) {
      merged[row.term] = row.definition;
    }
    return NextResponse.json({ data: merged });
  } catch {
    return NextResponse.json({ data: STATIC_GLOSSARY });
  }
}

// POST /api/glossary — admin only, upsert a term
export async function POST(req: NextRequest) {
  try { await requireAdmin(); } catch { return NextResponse.json({ error: 'forbidden' }, { status: 403 }); }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const term = String(body.term ?? '').trim().slice(0, 100);
  const definition = String(body.definition ?? '').trim().slice(0, 500);
  if (!term || !definition) return NextResponse.json({ error: 'term and definition required' }, { status: 400 });

  const sc = createServiceClient();
  if (!sc) return NextResponse.json({ error: 'db unavailable' }, { status: 503 });

  try {
    const { error } = await sc.from('glossary').upsert({ term, definition }, { onConflict: 'term' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE /api/glossary?term=... — admin only
export async function DELETE(req: NextRequest) {
  try { await requireAdmin(); } catch { return NextResponse.json({ error: 'forbidden' }, { status: 403 }); }

  const term = new URL(req.url).searchParams.get('term') ?? '';
  if (!term) return NextResponse.json({ error: 'term required' }, { status: 400 });

  const sc = createServiceClient();
  if (!sc) return NextResponse.json({ error: 'db unavailable' }, { status: 503 });

  try {
    await sc.from('glossary').delete().eq('term', term);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
