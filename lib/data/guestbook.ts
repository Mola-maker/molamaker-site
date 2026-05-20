import { createClient } from '@/lib/supabase/server';
import type { GuestbookEntry, ApiResult } from '@/lib/types';

export async function getEntries(limit?: number): Promise<GuestbookEntry[]> {
  const supabase = await createClient();

  let query = supabase
    .from('guestbook')
    .select('id, name, message, created_at')
    .order('created_at', { ascending: false });

  if (limit != null && limit > 0) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Failed to fetch guestbook entries:', error.message);
    return [];
  }
  return (data as GuestbookEntry[]) ?? [];
}

export async function insertEntry(
  name: string,
  message: string,
): Promise<ApiResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('guestbook')
    .insert({ name, message });

  if (error) {
    console.error('guestbook insert error:', error.message);
    return { ok: false, error: 'Could not sign guestbook. Try again.' };
  }

  return { ok: true };
}
