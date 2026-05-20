import type { Metadata } from 'next';
import Nav from '@/components/nav';
import Footer from '@/components/footer';

export const metadata: Metadata = { title: 'Now — molamaker' };

const updated = new Date().toLocaleDateString('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric'
});

export default function NowPage() {
  return (
    <>
      <Nav />
      <main>
        <section>
          <div className="label">Now</div>
          <h1 className="display">Now</h1>
          <p style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: 'var(--ink-soft)',
            marginBottom: 40
          }}>
            Updated whenever the wind changes. &middot; {updated}
          </p>

          <div style={{
            color: 'var(--ink-2)',
            fontSize: 17,
            lineHeight: 1.7,
            maxWidth: '64ch',
            whiteSpace: 'pre-wrap'
          }}>
            <p style={{ marginBottom: 24 }}>
              I&apos;m currently deep in the CUDA programming model — writing
              kernels, understanding warp-level execution, and slowly building
              intuition for how data movement dominates everything on the GPU.
              It&apos;s humbling in the best way.
            </p>
            <p style={{ marginBottom: 24 }}>
              On the application layer, I&apos;m building a multi-agent CMS that
              coordinates several LLM-backed specialists through a shared context
              layer. The goal is to let agents plan, edit, and publish content
              collaboratively, with a human in the loop only when it matters.
            </p>
            <p style={{ marginBottom: 24 }}>
              I&apos;m also working through <em>Programming Massively Parallel
              Processors</em> (4th edition) cover to cover. The exercises are
              brutal. Highly recommended.
            </p>
            <p style={{ marginBottom: 24 }}>
              When I&apos;m not heads-down in code, I&apos;m listening to lo-fi
              streams, tinkering with Linux on unconventional hardware, and
              trying to understand rotational dynamics well enough to explain it
              to someone else.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
