import { createClient } from '@/lib/supabase/server';

export async function getTotalViews(): Promise<number> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from('page_views')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('Failed to fetch page_views count:', error.message);
    return 0;
  }

  return count ?? 0;
}

export async function insertPageView(path: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('page_views')
    .insert({ path });

  if (error) {
    console.error('page_views insert error:', error.message);
  }
}
