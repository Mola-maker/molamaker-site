import { NextResponse } from 'next/server';
import { LANGUAGE_COLORS } from '@/lib/language-colors';

// GET /api/github → { data: Repo[] }
export async function GET() {
  const token = process.env.GITHUB_TOKEN;
  const username = process.env.GITHUB_USERNAME ?? 'Mola-maker';

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(
      `https://api.github.com/users/${username}/repos?sort=updated&per_page=10&type=public`,
      { headers, next: { revalidate: 3600 } },
    );
    if (!res.ok) {
      return NextResponse.json(
        { error: { code: 'upstream_error', message: 'GitHub API unavailable' } },
        { status: 502 },
      );
    }

    const raw = (await res.json()) as Array<Record<string, unknown>>;
    const data = raw
      .filter((r) => !r.fork)
      .slice(0, 6)
      .map((r) => ({
        name: r.name as string,
        desc: (r.description as string) ?? '',
        lang: (r.language as string) ?? 'Text',
        langColor: LANGUAGE_COLORS[(r.language as string) ?? ''] ?? '#8b8b8b',
        stars: (r.stargazers_count as number) ?? 0,
        updated: ((r.pushed_at as string) ?? '').slice(0, 10),
      }));

    return NextResponse.json({ data });
  } catch {
    return NextResponse.json(
      { error: { code: 'upstream_error', message: 'GitHub API failed' } },
      { status: 502 },
    );
  }
}
