import { getAllPosts } from '@/lib/content';

export async function GET() {
  const posts = getAllPosts().slice(0, 20);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://molamaker-site.vercel.app';

  const items = posts
    .map((p) => `<item>
      <title><![CDATA[${p.title}]]></title>
      <link>${siteUrl}/blog/${p.slug}</link>
      <guid>${siteUrl}/blog/${p.slug}</guid>
      <pubDate>${new Date(p.date).toUTCString()}</pubDate>
      <description><![CDATA[${p.excerpt ?? ''}]]></description>
    </item>`)
    .join('');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>molamaker journal</title>
    <link>${siteUrl}</link>
    <description>Building at the edge of systems and intelligence.</description>
    <language>en</language>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
