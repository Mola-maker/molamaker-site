import type { MetadataRoute } from 'next';
import { getPostSlugs } from '@/lib/content';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://molamaker.com';
  const slugs = getPostSlugs();

  const blogEntries: MetadataRoute.Sitemap = slugs.map((slug) => ({
    url: `${baseUrl}/blog/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  const pages = ['about', 'work', 'projects', 'blog', 'chat', 'guestbook', 'contact', 'now', 'uses', 'journey'];
  const pageEntries: MetadataRoute.Sitemap = pages.map((p) => ({
    url: `${baseUrl}/${p}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: p === 'about' || p === 'work' ? 0.9 : 0.6,
  }));

  return [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 1 },
    ...pageEntries,
    ...blogEntries,
  ];
}
