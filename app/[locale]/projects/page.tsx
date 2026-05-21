import type { Metadata } from 'next';
import NavWrapper from '@/components/nav-wrapper';
import Footer from '@/components/footer';
import RepoCard from '@/components/repo-card';
import LanguageBar from '@/components/language-bar';
import { fetchRepos, fetchUserStats, isPinned } from '@/lib/github';
import { languageColor } from '@/lib/language-colors';

export const metadata: Metadata = { title: 'Projects — molamaker' };
export const revalidate = 3600;

export default async function ProjectsPage() {
  const username = process.env.GITHUB_USERNAME || 'Mola-maker';
  const [repos, user] = await Promise.all([
    fetchRepos(username),
    fetchUserStats(username),
  ]);

  const totalStars = repos.reduce((sum, r) => sum + r.stargazers_count, 0);

  const langCounts: Record<string, number> = {};
  for (const r of repos) {
    if (r.language) {
      langCounts[r.language] = (langCounts[r.language] || 0) + 1;
    }
  }
  let primaryLang = '';
  let primaryLangCount = 0;
  for (const [lang, count] of Object.entries(langCounts)) {
    if (count > primaryLangCount) {
      primaryLang = lang;
      primaryLangCount = count;
    }
  }

  const pinnedRepos = repos.filter((r) => isPinned(r.name));

  return (
    <>
      <NavWrapper />
      <main>
        <section>
          <div className="label">ARCHIVE</div>
          <h2>Every repo, pinned or otherwise.</h2>
          <p className="lead">
            A live mirror of what&apos;s on my GitHub. Pinned projects first,
            then ranked by stars and recent activity. Refreshes every hour.
          </p>

          {/* Stats row */}
          <div
            style={{
              display: 'flex',
              gap: 32,
              flexWrap: 'wrap',
              padding: '28px 0',
              borderTop: '1px dashed var(--rule)',
              borderBottom: '1px dashed var(--rule)',
              marginBottom: 28,
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--ink-soft)',
            }}
          >
            <span>
              <strong style={{ color: 'var(--ink-2)', fontWeight: 500 }}>
                {repos.length}
              </strong>{' '}
              repos
            </span>
            <span>
              <strong style={{ color: 'var(--ink-2)', fontWeight: 500 }}>
                {totalStars}
              </strong>{' '}
              stars
            </span>
            {user && (
              <span>
                <strong style={{ color: 'var(--ink-2)', fontWeight: 500 }}>
                  {user.followers}
                </strong>{' '}
                followers
              </span>
            )}
            {primaryLang && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: languageColor(primaryLang),
                    flexShrink: 0,
                  }}
                />
                <strong style={{ color: 'var(--ink-2)', fontWeight: 500 }}>
                  {primaryLang}
                </strong>{' '}
                top language
              </span>
            )}
          </div>

          {/* Language bar */}
          <div style={{ marginBottom: 36 }}>
            <LanguageBar counts={langCounts} />
          </div>

          {/* Repo grid */}
          <div className="work-grid">
            {repos.map((repo) => (
              <RepoCard key={repo.full_name} repo={repo} />
            ))}
          </div>
        </section>

        {repos.length === 0 && (
          <p
            style={{
              textAlign: 'center',
              padding: '48px 0',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              color: 'var(--ink-soft)',
            }}
          >
            Could not load repos right now. Try again later.
          </p>
        )}

        <p
          style={{
            textAlign: 'center',
            padding: '48px 0',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--ink-soft)',
          }}
        >
          Updated just now &middot;{' '}
          <a
            href={`https://github.com/${username}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--accent)', textDecoration: 'none' }}
          >
            github.com/{username} &rarr;
          </a>
        </p>
      </main>
      <Footer />
    </>
  );
}
