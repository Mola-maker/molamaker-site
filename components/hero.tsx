export default function Hero({ visitorCount }: { visitorCount: number }) {
  return (
    <section className="hero" id="top">
      <div className="label">Portfolio &amp; Journal · est. 2026</div>
      <h1 className="display">
        <span className="hover-zoom">Building at the</span>{' '}
        <em>edge</em>{' '}
        <span className="hover-zoom">of systems and intelligence.</span>
      </h1>
      <p className="lead">
        <span className="hover-zoom">I&apos;m a developer working across CUDA, AI tooling, and the messy seams where they meet.</span>{' '}
        <span className="hover-zoom">Currently learning to write fast GPU kernels and reasoning about agentic systems.</span>{' '}
        <span className="hover-zoom">This is where I keep notes.</span>
      </p>
      <div className="hero-meta">
        <span>visitor <strong>#{visitorCount.toLocaleString()}</strong></span>
        <span>currently learning <strong>CUDA</strong></span>
        <span>based <strong>somewhere quiet</strong></span>
      </div>
    </section>
  );
}
