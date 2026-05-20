import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { pageViewSchema } from '@/lib/validation';
import { checkRate, RATE_VIEWS } from '@/lib/rate-limit';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = pageViewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      '127.0.0.1';
    const rate = checkRate(`pv:${ip}`, RATE_VIEWS.limit, RATE_VIEWS.windowMs);
    if (!rate.allowed) {
      return NextResponse.json({ ok: false }, {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rate.resetMs / 1000)) },
      });
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from('page_views')
      .insert({ path: parsed.data.path });
    if (error) {
      console.error('page_views insert error:', error.message);
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
