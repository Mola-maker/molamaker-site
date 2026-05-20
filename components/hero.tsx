export default function Hero({ visitorCount }: { visitorCount: number }) {
  return (
    <section className="hero" id="top">
      <div className="label">Portfolio &amp; Journal · est. 2026</div>
      <h1 className="display">
        Building at the <em>edge</em> of systems and intelligence.
      </h1>
      <p className="lead">
        I&apos;m a developer working across CUDA, AI tooling, and the messy
        seams where they meet. Currently learning to write fast GPU kernels
        and reasoning about agentic systems. This is where I keep notes.
      </p>
      <div className="hero-meta">
        <span>visitor <strong>#{visitorCount.toLocaleString()}</strong></span>
        <span>currently learning <strong>CUDA</strong></span>
        <span>based <strong>somewhere quiet</strong></span>
      </div>
    </section>
  );
}
