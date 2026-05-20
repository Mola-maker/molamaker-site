'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.OWNER_EMAIL) {
    redirect('/login');
  }
  return supabase;
}

export async function savePost(formData: FormData) {
  const supabase = await requireAuth();

  const slug = (formData.get('slug') as string).trim();
  const title = (formData.get('title') as string).trim();
  const excerpt = (formData.get('excerpt') as string).trim() || null;
  const content = (formData.get('content') as string) || '';
  const readTime = parseInt(formData.get('read_time') as string) || 5;
  const published = formData.get('published') === 'on';
  const existingSlug = (formData.get('existing_slug') as string) || null;

  if (!slug || !title) {
    redirect(
      existingSlug
        ? `/admin/edit/${existingSlug}?error=missing_fields`
        : '/admin/new?error=missing_fields',
    );
  }

  const postData = {
    slug,
    title,
    excerpt,
    content,
    read_time: readTime,
    published,
  };

  if (existingSlug && existingSlug !== slug) {
    await supabase.from('posts').delete().eq('slug', existingSlug);
    const { error: insertError } = await supabase.from('posts').insert(postData);
    if (insertError) {
      console.error('Failed to save post:', insertError.message);
      redirect(`/admin/edit/${existingSlug}?error=save_failed`);
    }
  } else {
    const { error: upsertError } = await supabase
      .from('posts')
      .upsert(postData, { onConflict: 'slug' });
    if (upsertError) {
      console.error('Failed to save post:', upsertError.message);
      redirect(
        existingSlug
          ? `/admin/edit/${existingSlug}?error=save_failed`
          : '/admin/new?error=save_failed',
      );
    }
  }

  revalidatePath('/admin');
  revalidatePath('/blog');
  revalidatePath('/');
  redirect('/admin');
}

export async function deletePost(slug: string) {
  const supabase = await requireAuth();
  await supabase.from('posts').delete().eq('slug', slug);
  revalidatePath('/admin');
}
