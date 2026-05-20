import type { MetadataRoute } from 'next';
import { getPostSlugs } from '@/lib/data/posts';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://molamaker.com';

  const slugs = await getPostSlugs();

  const blogEntries: MetadataRoute.Sitemap = slugs.map((slug) => ({
    url: `${baseUrl}/blog/${slug}`,
    lastModified: new Date(),
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
