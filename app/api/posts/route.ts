import { NextResponse } from 'next/server';
import { getAllPosts } from '@/lib/content';

// GET /api/posts → { data: Post[] }
// Reads from content/*.md (GitHub) — push a new .md file and it appears.
export async function GET() {
  const posts = (await getAllPosts()).map((p) => ({
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    date: p.date.slice(0, 10),
    readTime: p.read_time,
    tag: p.tag,
  }));

  return NextResponse.json({ data: posts });
}
