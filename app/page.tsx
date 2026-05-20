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

  return (
    <>
      <Nav />
      <main>
        <Hero visitorCount={viewsRes.count ?? 1247} />
        <About />
        <Work />
        <Writing posts={postsRes.data ?? []} />
        <Guestbook entries={entriesRes.data ?? []} />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
