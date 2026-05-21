import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

export type BlogPost = {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  read_time: number;
  content: string;
};

const CONTENT_DIR = path.join(process.cwd(), 'content');

export async function getAllPosts(): Promise<BlogPost[]> {
  try {
    const files = (await fs.promises.readdir(CONTENT_DIR)).filter((f) => f.endsWith('.md'));
    const posts = await Promise.all(
      files.map(async (file) => {
        const raw = await fs.promises.readFile(path.join(CONTENT_DIR, file), 'utf-8');
        const { data, content } = matter(raw);
        return {
          slug: file.replace(/\.md$/, ''),
          title: data.title ?? file,
          date: data.date ? new Date(data.date).toISOString() : new Date().toISOString(),
          excerpt: data.excerpt ?? '',
          read_time: data.read_time ?? Math.ceil(content.split(/\s+/).length / 200),
          content,
        } as BlogPost;
      }),
    );
    return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch {
    return [];
  }
}

export function getPostBySlug(slug: string): BlogPost | null {
  if (slug.includes('..') || slug.includes('/')) return null;
  const filePath = path.join(CONTENT_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const { data, content } = matter(raw);
    return {
      slug,
      title: data.title ?? slug,
      date: data.date ? new Date(data.date).toISOString() : new Date().toISOString(),
      excerpt: data.excerpt ?? '',
      read_time: data.read_time ?? Math.ceil(content.split(/\s+/).length / 200),
      content,
    };
  } catch {
    return null;
  }
}

export function getPostSlugs(): string[] {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  return fs.readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/, ''));
}
