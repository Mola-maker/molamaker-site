'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PostSchema } from '@/lib/schemas';
import { logError } from '@/lib/logger';

export async function savePost(formData: FormData) {
  await requireAdmin();
  const locale = await getLocale();

  const existingSlug = (formData.get('existing_slug') as string) || null;

  const parsed = PostSchema.safeParse({
    slug: (formData.get('slug') as string).trim(),
    title: (formData.get('title') as string).trim(),
    excerpt: (formData.get('excerpt') as string).trim() || null,
    content: (formData.get('content') as string) || '',
    read_time: parseInt(formData.get('read_time') as string) || 5,
    published: formData.get('published') === 'on',
  });

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Invalid input';
    redirect(
      existingSlug
        ? `/${locale}/admin/edit/${existingSlug}?error=${encodeURIComponent(msg)}`
        : `/${locale}/admin/new?error=${encodeURIComponent(msg)}`,
    );
  }

  const { slug, title, excerpt, content, read_time: readTime, published } = parsed.data;
  const supabase = await createClient();
  if (!supabase) {
    redirect(
      existingSlug
        ? `/${locale}/admin/edit/${existingSlug}?error=config_error`
        : `/${locale}/admin/new?error=config_error`,
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
      logError('admin/savePost', 'Insert failed', insertError);
      redirect(`/${locale}/admin/edit/${existingSlug}?error=save_failed`);
    }
  } else {
    const { error: upsertError } = await supabase
      .from('posts')
      .upsert(postData, { onConflict: 'slug' });
    if (upsertError) {
      logError('admin/savePost', 'Upsert failed', upsertError);
      redirect(
        existingSlug
          ? `/${locale}/admin/edit/${existingSlug}?error=save_failed`
          : `/${locale}/admin/new?error=save_failed`,
      );
    }
  }

  revalidatePath('/', 'layout');
  redirect(`/${locale}/admin`);
}

export async function deletePost(slug: string) {
  await requireAdmin();
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'Service temporarily unavailable.' };
  const { error } = await supabase.from('posts').delete().eq('slug', slug);
  if (error) {
    logError('admin/deletePost', 'Delete failed', error);
    return { ok: false, error: 'Delete failed' };
  }
  revalidatePath('/', 'layout');
  return { ok: true };
}
