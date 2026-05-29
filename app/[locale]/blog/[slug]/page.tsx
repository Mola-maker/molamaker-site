import { getPostBySlug } from '@/lib/content';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import BlogPostReader from '@/components/redesign/blog-post-reader';
import type { Locale } from '@/components/redesign/data';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: 'Not Found' };
  return {
    title: post.title,
    description: post.excerpt ?? undefined,
    openGraph: {
      title: post.title,
      description: post.excerpt ?? undefined,
      images: [
        `/og?title=${encodeURIComponent(post.title)}&date=${encodeURIComponent(new Date(post.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))}&tag=${encodeURIComponent(post.tag ?? '')}&readTime=${encodeURIComponent(String(post.read_time ?? ''))}&excerpt=${encodeURIComponent((post.excerpt ?? '').slice(0, 120))}`,
      ],
    },
  };
}

export default async function PostPage({
  params
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!routing.locales.includes(locale as Locale)) notFound();
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const date = new Date(post.date).toISOString().slice(0, 10);

  return (
    <BlogPostReader
      title={post.title}
      date={date}
      readTime={post.read_time}
      excerpt={post.excerpt}
      markdown={post.content}
      locale={locale as Locale}
    />
  );
}
