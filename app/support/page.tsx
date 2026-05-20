import type { Metadata } from 'next';
import NavWrapper from '@/components/nav-wrapper';
import Footer from '@/components/footer';
import SupportButton from '@/components/support-button';

export const metadata: Metadata = { title: 'Support — molamaker' };

export default function SupportPage() {
  return (
    <>
      <NavWrapper />
      <main>
        <section>
          <div className="label">Support</div>
          <h1 className="display">
            If this site <em>helped</em> you,
          </h1>
          <p className="lead">
            This is my personal journal and portfolio — I write about
            systems, AI, and the messy seams between them. Everything
            here is free and open source.
          </p>
          <p className="lead" style={{ marginTop: 16 }}>
            If something here saved you time, taught you something, or
            just made your day a little better — a coffee is always
            appreciated. No paywalls, no ads, no tracking. Just notes
            from a developer figuring things out.
          </p>
        </section>
        <section style={{ textAlign: 'center', paddingTop: 40 }}>
          <SupportButton size="lg" />
        </section>
      </main>
      <Footer />
    </>
  );
}
