import { createClient } from '@/lib/supabase/server';

export async function getPage(slug: string): Promise<{ slug: string; content: string; updated_at: string } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pages')
    .select('slug, content, updated_at')
    .eq('slug', slug)
    .single();

  if (error) {
    console.error('Failed to fetch page:', error.message);
    return null;
  }
  return data;
}

export async function updatePage(slug: string, content: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('pages')
    .upsert({ slug, content, updated_at: new Date().toISOString() });

  if (error) {
    console.error('Failed to update page:', error.message);
    throw new Error('Could not update page');
  }
}
