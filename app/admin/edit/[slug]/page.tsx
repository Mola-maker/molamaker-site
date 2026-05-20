import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { PostForm } from '@/components/post-form';
import type { Post } from '@/lib/types';

export const revalidate = 0;

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('posts')
    .select('slug, title, excerpt, content, read_time, published')
    .eq('slug', slug)
    .single();

  if (error || !data) {
    notFound();
  }

  const post = data as Post;

  return (
    <div style={{ padding: '40px 0', maxWidth: 720 }}>
      <div className="label">Admin</div>
      <h2>Edit Post</h2>
      <PostForm post={post} />
    </div>
  );
}
