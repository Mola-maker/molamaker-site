import { getPostBySlug, getPostSlugs } from '@/lib/content';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import NavWrapper from '@/components/nav-wrapper';
import Footer from '@/components/footer';
import AnnotationSidebarWrapper from '@/components/annotation-sidebar-wrapper';
import ViewCounter from '@/components/view-counter';
import CommentsLoader from '@/components/comments-loader';
import { Link } from '@/i18n/routing';

export async function generateStaticParams() {
  const slugs = getPostSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
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
      images: [`/og?title=${encodeURIComponent(post.title)}&date=${encodeURIComponent(new Date(post.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))}`],
    },
  };
}

export default async function PostPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) notFound();

  return (
    <>
      <NavWrapper />
      <main>
        <article style={{ padding: '80px 0', maxWidth: '68ch', margin: '0 auto' }}>
          <div className="label">
            {new Date(post.date).toLocaleDateString('en-US', {
              month: 'long', day: 'numeric', year: 'numeric'
            })}
            {' · '}
            {post.read_time} min read
          </div>
          <h1 className="display" style={{ maxWidth: 'none' }}>{post.title}</h1>
          {post.excerpt && (
            <p className="lead" style={{ fontStyle: 'italic', color: 'var(--ink-soft)' }}>
              {post.excerpt}
            </p>
          )}
          <div className="prose">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {post.content}
            </ReactMarkdown>
          </div>
          <ViewCounter slug={slug} />
          <CommentsLoader />
          <p style={{ marginTop: 60 }}>
            <Link href="/blog" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
              ← Back to writing
            </Link>
          </p>
        </article>
      </main>
      <Footer />
      <AnnotationSidebarWrapper />
    </>
  );
}
