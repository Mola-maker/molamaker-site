import { createClient } from '@/lib/supabase/server';
import { logError } from '@/lib/logger';

export async function getPage(slug: string): Promise<{ slug: string; content: string; updated_at: string } | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('pages')
    .select('slug, content, updated_at')
    .eq('slug', slug)
    .single();

  if (error) {
    logError('pages', 'Failed to fetch page', error);
    return null;
  }
  return data;
}

export async function updatePage(slug: string, content: string): Promise<void> {
  const supabase = await createClient();
  if (!supabase) throw new Error('Supabase is not configured — cannot update page');
  const { error } = await supabase
    .from('pages')
    .upsert({ slug, content, updated_at: new Date().toISOString() });

  if (error) {
    logError('pages', 'Failed to update page', error);
    throw new Error('Could not update page');
  }
}
