import type { Project } from '@/lib/types';

const projects: Project[] = [
  {
    repo: 'astrbot_plugin_whythemistake',
    year: '2026 · ACTIVE',
    desc: "An AstrBot plugin that watches your terminal, catches errors as they happen, and suggests fixes before you've finished swearing.",
    tags: ['PYTHON', 'ASTRBOT', 'PLUGIN'],
    stars: 1
  },
  {
    repo: 'agent-gateway',
    year: '2026',
    desc: 'A LLM + Playwright pipeline that aggregates university OA notifications into one quiet feed. Less inbox, more signal.',
    tags: ['TYPESCRIPT', 'LLM', 'PLAYWRIGHT'],
    stars: 1
  },
  {
    repo: '-MathModel',
    year: '2025',
    desc: 'A multi-agent framework for MCM/ICM-style math modeling. One orchestrator coordinates five specialists through a shared JSON context.',
    tags: ['PYTHON', 'AGENTS', 'MCM'],
    stars: 2
  },
  {
    repo: 'AstrBot',
    year: '2025 · FORK',
    desc: 'Working fork of AstrBot — an agentic IM chatbot infrastructure integrating LLMs, plugins, and a dozen messaging platforms. Plenty of late nights here.',
    tags: ['PYTHON', 'LLM', 'BOT']
  }
];

export default function Work() {
  return (
    <section id="work">
      <div className="label">02 — Selected Work</div>
      <h2>Things I&apos;ve made, broken, and occasionally finished.</h2>
      <div className="work-grid">
        {projects.map((p) => (
          <a
            key={p.repo}
            className="work-card"
            href={`https://github.com/Mola-maker/${p.repo}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <div className="year">{p.year}</div>
            <div className="arrow">↗</div>
            <h3><span className="repo-mono">{p.repo}</span></h3>
            <p>{p.desc}</p>
            <div className="tags">
              {p.tags.map((t) => <span key={t} className="tag">{t}</span>)}
              {p.stars ? <span className="tag star">★ {p.stars}</span> : null}
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
