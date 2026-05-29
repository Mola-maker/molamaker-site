import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

// GET /api/glossary → { data: Record<term, definition> }
export const revalidate = 3600;

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
