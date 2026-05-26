import { createClient } from '@/lib/supabase/server';
import { logError } from '@/lib/logger';
import type { GuestbookEntry, ApiResult } from '@/lib/types';

export async function getEntries(limit?: number): Promise<GuestbookEntry[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  let query = supabase
    .from('guestbook')
    .select('id, name, message, created_at')
    .order('created_at', { ascending: false });

  if (limit != null && limit > 0) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) {
    logError('guestbook', 'Failed to fetch entries', error);
    return [];
  }
  return (data as GuestbookEntry[]) ?? [];
}

export async function insertEntry(
  name: string,
  message: string,
): Promise<ApiResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'Service temporarily unavailable.' };

  const { error } = await supabase
    .from('guestbook')
    .insert({ name, message });

  if (error) {
    logError('guestbook', 'insert failed', error);
    return { ok: false, error: 'Could not sign guestbook. Try again.' };
  }

  return { ok: true };
}
