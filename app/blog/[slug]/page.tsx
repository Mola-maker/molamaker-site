import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Nav from '@/components/nav';
import Footer from '@/components/footer';

export const revalidate = 60;

export default async function PostPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  // increment view count atomically
  await supabase.rpc('increment_view', { post_slug: slug });

  const { data: post } = await supabase
    .from('posts')
    .select('*')
    .eq('slug', slug)
    .single();

  if (!post) notFound();

  return (
    <>
      <Nav />
      <main>
        <article style={{ padding: '80px 0', maxWidth: '68ch', margin: '0 auto' }}>
          <div className="label">
            {new Date(post.published_at).toLocaleDateString('en-US', {
              month: 'long', day: 'numeric', year: 'numeric'
            })}
            {' · '}
            {post.read_time} min read
            {' · '}
            {post.view_count.toLocaleString()} views
          </div>
          <h1 className="display" style={{ maxWidth: 'none' }}>{post.title}</h1>
          {post.excerpt && (
            <p className="lead" style={{ fontStyle: 'italic', color: 'var(--ink-soft)' }}>
              {post.excerpt}
            </p>
          )}
          <div style={{
            color: 'var(--ink-2)',
            fontSize: 17,
            lineHeight: 1.7,
            whiteSpace: 'pre-wrap'
          }}>
            {post.content || '(Body coming soon. Edit this post in the Supabase dashboard.)'}
          </div>
          <p style={{ marginTop: 60 }}>
            <a href="/#writing" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
              ← Back to writing
            </a>
          </p>
        </article>
      </main>
      <Footer />
    </>
  );
}
