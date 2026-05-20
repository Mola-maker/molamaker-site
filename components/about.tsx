export default function About() {
  return (
    <section id="about">
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
            >GitHub</a>.
          </p>
        </div>
        <div className="portrait-stack">
          <div className="portrait">
            <img
              src="https://avatars.githubusercontent.com/u/229602071?v=4"
              alt="Portrait"
            />
            <div className="portrait-caption">
              <span>mola · 2026</span>
              <span className="glyph">𓆉</span>
            </div>
          </div>
          <aside className="sidecard">
            <h3>Now</h3>
            <ul>
              <li><span>Reading</span><span>PMPP, 4th ed.</span></li>
              <li><span>Learning</span><span>CUDA · Triton</span></li>
              <li><span>Building</span><span>Multi-agent CMS</span></li>
              <li><span>Listening</span><span>lo-fi, mostly</span></li>
              <li><span>Stack</span><span>Next · Postgres</span></li>
            </ul>
          </aside>
        </div>
      </div>
    </section>
  );
}
