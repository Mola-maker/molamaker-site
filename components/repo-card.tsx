import type { Repo } from '@/lib/github';
import { languageColor } from '@/lib/language-colors';
import { fmtRelative } from '@/lib/date';

export default function RepoCard({ repo }: { repo: Repo }) {
  const langColor = languageColor(repo.language);
  const shown = repo.topics.slice(0, 4);

  return (
    <a
      className="work-card"
      href={repo.html_url}
      target="_blank"
      rel="noopener noreferrer"
    >
      <div className="arrow">&nearr;</div>

      <h3>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 16,
            fontWeight: 500,
          }}
        >
          {repo.name}
        </span>
      </h3>

      {repo.description && (
        <p
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {repo.description}
        </p>
      )}

      {shown.length > 0 && (
        <div className="tags">
          {shown.map((t) => (
            <span key={t} className="tag">{t}</span>
          ))}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          marginTop: 16,
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--ink-soft)',
          flexWrap: 'wrap',
        }}
      >
        {repo.language && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: langColor,
                flexShrink: 0,
              }}
            />
            {repo.language}
          </span>
        )}

        <span>&starf; {repo.stargazers_count}</span>

        <span>&#9218; {repo.forks_count}</span>

        <span style={{ color: 'var(--ink-soft)' }}>
          {fmtRelative(repo.pushed_at, { style: 'ago' })}
        </span>
      </div>
    </a>
  );
}
