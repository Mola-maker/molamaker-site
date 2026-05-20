import type { MetadataRoute } from 'next';
import { createStaticClient } from '@/lib/supabase/static';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://molamaker.com';
  const supabase = createStaticClient();

  const { data: posts } = await supabase
    .from('posts')
    .select('slug, published_at');

  const blogEntries: MetadataRoute.Sitemap = (posts ?? []).map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: new Date(post.published_at),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 1,
    },
    ...blogEntries,
  ];
}
