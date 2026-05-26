import { createClient } from '@/lib/supabase/server';
import { logError } from '@/lib/logger';
import type { ContactPayload, ApiResult } from '@/lib/types';

export async function insertContact(
  data: ContactPayload,
): Promise<ApiResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'Service temporarily unavailable.' };

  const { error } = await supabase
    .from('contacts')
    .insert(data);

  if (error) {
    logError('contacts', 'insert failed', error);
    return { ok: false, error: 'Could not send message. Try again later.' };
  }

  return { ok: true };
}
