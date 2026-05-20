import { createClient } from '@/lib/supabase/server';
import Nav from '@/components/nav';
import Hero from '@/components/hero';
import About from '@/components/about';
import Work from '@/components/work';
import Writing from '@/components/writing';
import Guestbook from '@/components/guestbook';
import Contact from '@/components/contact';
import Footer from '@/components/footer';

export const revalidate = 30; // ISR: refresh every 30s

export default async function Home() {
  const supabase = await createClient();

  const [postsRes, entriesRes, viewsRes] = await Promise.all([
    supabase
      .from('posts')
      .select('slug, title, published_at, read_time, view_count')
      .order('published_at', { ascending: false })
      .limit(5),
    supabase
      .from('guestbook')
      .select('id, name, message, created_at')
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('page_views')
      .select('*', { count: 'exact', head: true })
  ]);

  if (postsRes.error) {
    console.error('Failed to fetch posts:', postsRes.error.message);
  }

  if (entriesRes.error) {
    console.error('Failed to fetch guestbook entries:', entriesRes.error.message);
  }

  if (viewsRes.error) {
    console.error('Failed to fetch page_views count:', viewsRes.error.message);
  }

  return (
    <>
      <Nav />
      <main>
        <Hero visitorCount={viewsRes.error ? 1247 : (viewsRes.count ?? 1247)} />
        <About />
        <Work />
        <Writing posts={postsRes.error ? [] : (postsRes.data ?? [])} />
        <Guestbook entries={entriesRes.error ? [] : (entriesRes.data ?? [])} />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
