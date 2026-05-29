import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAllPosts } from '@/lib/content';
import { routing } from '@/i18n/routing';
import BlogListReader from '@/components/redesign/blog-list-reader';
import type { Locale } from '@/components/redesign/data';

export const metadata: Metadata = { title: 'Blog — molamaker' };
export const dynamic = 'force-dynamic';

export default async function BlogPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as Locale)) notFound();

  const posts = (await getAllPosts()).map((p) => ({
    slug: p.slug,
    title: p.title,
    date: p.date.slice(0, 10),
    read_time: p.read_time,
    excerpt: p.excerpt,
    tag: p.tag,
  }));

  return <BlogListReader posts={posts} locale={locale as Locale} />;
}
