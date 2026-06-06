import { NextResponse } from 'next/server';
import { fmtRelative } from '@/lib/date';
import { logError } from '@/lib/logger';

const USERNAME = process.env.GITHUB_USERNAME ?? 'Mola-maker';
const TOKEN = process.env.GITHUB_TOKEN;
const WATCHED = ['astrbot-plugins', 'kernel-notes', 'gstack', 'omc', 'molamaker-site'];

// GET /api/github/commits → { data: CommitSignal[] }
export const revalidate = 300; // cache 5 min

export async function GET() {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'molamaker-site/1.0',
  };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;

  try {
    const results = await Promise.allSettled(
      WATCHED.map(async (repo) => {
        const res = await fetch(
          `https://api.github.com/repos/${USERNAME}/${repo}/commits?per_page=3&sha=main`,
          { headers, next: { revalidate: 300 }, signal: AbortSignal.timeout(4500) },
        );
        if (!res.ok) return [];
        const commits: Record<string, unknown>[] = await res.json();
        return commits.map((c) => {
          const commit = c.commit as Record<string, unknown>;
          const authorData = (commit.author ?? commit.committer ?? {}) as Record<string, unknown>;
          const date = (authorData.date as string) ?? new Date().toISOString();
          return {
            kind: 'commit',
            id: (c.sha as string).slice(0, 7),
            repo,
            branch: 'main',
            message: ((commit.message as string) ?? '').split('\n')[0].slice(0, 120),
            hash: (c.sha as string).slice(0, 7),
            author: USERNAME,
            meta: '',
            time: fmtRelative(date),
            created_at: date,
            files: [] as { path: string; plus: number; minus: number }[],
            diff: '',
          };
        });
      }),
    );

    const commits = results
      .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 12);

    return NextResponse.json({ data: commits });
  } catch (err) {
    logError('github/commits', 'Failed to fetch commits', err);
    return NextResponse.json({ data: [] });
  }
}

