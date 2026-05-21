import { createClient } from '@/lib/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const locale = request.cookies.get('NEXT_LOCALE')?.value || 'en';

  if (!code) {
    return NextResponse.redirect(`${origin}/${locale}/login?error=no_code`);
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.redirect(`${origin}/${locale}/login?error=config_error`);
  }
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user?.email) {
    return NextResponse.redirect(`${origin}/${locale}/login?error=auth_failed`);
  }

  if (data.user.email === process.env.OWNER_EMAIL) {
    return NextResponse.redirect(`${origin}/${locale}/admin`);
  }

  return NextResponse.redirect(`${origin}/${locale}`);
}
