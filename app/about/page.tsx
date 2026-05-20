import type { Metadata } from 'next';
import Image from 'next/image';
import Nav from '@/components/nav';
import Footer from '@/components/footer';
import { SITE_CONFIG } from '@/lib/constants';

export const metadata: Metadata = { title: 'About — molamaker' };

export default function AboutPage() {
  return (
    <>
      <Nav />
      <main>
        <section>
          <div className="label">01 — About</div>
          <div className="about-grid">
            <div className="about-text">
              <h2>Engineer interested in the lower layers and the upper ones.</h2>
              <p>
                I spend most of my time between two extremes: writing kernels for
                the GPU, and orchestrating agents on top of LLMs. The surprise
                is how often they teach each other something.
              </p>
              <p>
                Outside of code I read physics — currently rotational dynamics —
                and tinker with rootless Linux environments on phones I probably
                shouldn&apos;t be tinkering with.
              </p>
              <p>
                This site is a slow journal. I write things down so I remember
                why they worked. Find me on{' '}
                <a
                  href="https://github.com/Mola-maker"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GitHub
                </a>
                .
              </p>
            </div>
            <div className="portrait-stack">
              <div className="portrait">
                <Image
                  src={SITE_CONFIG.avatarUrl}
                  alt="Portrait"
                  width={400}
                  height={400}
                />
                <div className="portrait-caption">
                  <span>mola &middot; 2026</span>
                  <span className="glyph">&#x13046;</span>
                </div>
              </div>
              <aside className="sidecard">
                <h3>Now</h3>
                <ul>
                  <li><span>Reading</span><span>PMPP, 4th ed.</span></li>
                  <li><span>Learning</span><span>CUDA &middot; Triton</span></li>
                  <li><span>Building</span><span>Multi-agent CMS</span></li>
                  <li><span>Listening</span><span>lo-fi, mostly</span></li>
                  <li><span>Stack</span><span>Next &middot; Postgres</span></li>
                </ul>
              </aside>
            </div>
          </div>
        </section>

        <section>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 'clamp(28px, 4vw, 40px)', marginBottom: 32 }}>
            Beyond code
          </h2>
          <p style={{ color: 'var(--ink-2)', maxWidth: '58ch', fontSize: 17, lineHeight: 1.7 }}>
            Outside of code I read physics — currently rotational dynamics —
            and tinker with rootless Linux environments on phones I probably
            shouldn&apos;t be tinkering with.
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
