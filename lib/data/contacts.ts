import { createClient } from '@/lib/supabase/server';
import type { ContactPayload, ApiResult } from '@/lib/types';

export async function insertContact(
  data: ContactPayload,
): Promise<ApiResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('contacts')
    .insert(data);

  if (error) {
    console.error('contact insert error:', error.message);
    return { ok: false, error: 'Could not send message. Try again later.' };
  }

  return { ok: true };
}
