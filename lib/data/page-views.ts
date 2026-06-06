import { createClient } from '@/lib/supabase/server';
import { logError } from '@/lib/logger';

export async function getTotalViews(): Promise<number> {
  const supabase = await createClient();
  if (!supabase) return 0;

  const { count, error } = await supabase
    .from('page_views')
    .select('id', { count: 'exact', head: true });

  if (error) {
    logError('page-views', 'Failed to fetch count', error);
    return 0;
  }

  return count ?? 0;
}

export async function insertPageView(path: string, sessionId?: string): Promise<void> {
  const supabase = await createClient();
  if (!supabase) return;

  const row: { path: string; session_id?: string } = { path };
  if (sessionId) row.session_id = sessionId;

  const { error } = await supabase
    .from('page_views')
    .insert(row);

  if (error) {
    logError('page-views', 'insert failed', error);
  }
}
