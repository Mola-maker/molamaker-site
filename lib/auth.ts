import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import type { User } from '@supabase/supabase-js';

export async function getCurrentUser(): Promise<User | null> {
  try {
    const supabase = await createClient();
    if (!supabase) return null;
    const { data: { user } } = await supabase.auth.getUser();
    return user ?? null;
  } catch {
    return null;
  }
}

export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    const locale = await getLocale();
    redirect(`/${locale}/login`);
  }
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireAuth();
  if (user.email !== process.env.OWNER_EMAIL) {
    const locale = await getLocale();
    redirect(`/${locale}/login?error=unauthorized`);
  }
  return user;
}

export async function isSupporter(userId: string): Promise<boolean> {
  try {
    const supabase = await createClient();
    if (!supabase) return false;
    const { data } = await supabase
      .from('supporters')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}
