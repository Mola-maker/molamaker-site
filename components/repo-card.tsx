import type { Repo } from '@/lib/github';
import { languageColor } from '@/lib/language-colors';

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

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
          {fmtRelative(repo.pushed_at)}
        </span>
      </div>
    </a>
  );
}
