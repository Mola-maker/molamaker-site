import { createClient } from '@/lib/supabase/server';
import { createStaticClient } from '@/lib/supabase/static';
import { logError } from '@/lib/logger';
import type { Post } from '@/lib/types';

export async function getPosts(limit?: number): Promise<Post[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  let query = supabase
    .from('posts')
    .select('slug, title, published_at, read_time, view_count')
    .eq('published', true)
    .order('published_at', { ascending: false });

  if (limit != null && limit > 0) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) {
    logError('posts', 'Failed to fetch posts', error);
    return [];
  }
  return (data as Post[]) ?? [];
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('posts')
    .select('slug, title, published_at, read_time, view_count, excerpt, content')
    .eq('published', true)
    .eq('slug', slug)
    .single();

  if (error) {
    logError('posts', 'Failed to fetch post', error);
    return null;
  }
  return (data as Post) ?? null;
}

export async function getPostSlugs(): Promise<string[]> {
  const supabase = createStaticClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('posts')
    .select('slug')
    .eq('published', true);

  if (error) {
    logError('posts', 'Failed to fetch slugs', error);
    return [];
  }
  return (data ?? []).map((p: { slug: string }) => p.slug);
}

export async function incrementPostView(slug: string): Promise<void> {
  const supabase = await createClient();
  if (!supabase) return;

  const { error } = await supabase.rpc('increment_view', { post_slug: slug });
  if (error) {
    logError('posts', 'Failed to increment view', error);
  }
}
