import { logError } from '@/lib/logger';

export type Repo = {
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  topics: string[];
  fork: boolean;
  archived: boolean;
  pushed_at: string;
  created_at: string;
};

export type UserStats = {
  public_repos: number;
  followers: number;
  following: number;
  avatar_url: string;
  name: string | null;
  bio: string | null;
  html_url: string;
};

const PINNED = ['astrbot_plugin_whythemistake', 'agent-gateway', '-MathModel', 'AstrBot'];

export function isPinned(name: string): boolean {
  return PINNED.includes(name);
}

export async function fetchRepos(username: string): Promise<Repo[]> {
  const token = process.env.GITHUB_TOKEN;
  try {
    const res = await fetch(
      `https://api.github.com/users/${username}/repos?per_page=100&sort=updated`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        next: { revalidate: 3600 },
        // api.github.com is slow/blocked in mainland China — fail fast (≈4.5s)
        // instead of hanging on undici's 10s connect timeout, then fall back.
        signal: AbortSignal.timeout(4500),
      }
    );
    if (!res.ok) {
      logError('github', 'GitHub API error', { status: res.status });
      return [];
    }
    const repos: Repo[] = await res.json();
    return repos
      .filter((r) => !r.archived)
      .filter((r) => !r.fork || r.stargazers_count > 0)
      .sort((a, b) => {
        const aPin = isPinned(a.name) ? 1 : 0;
        const bPin = isPinned(b.name) ? 1 : 0;
        if (aPin !== bPin) return bPin - aPin;
        if (b.stargazers_count !== a.stargazers_count) return b.stargazers_count - a.stargazers_count;
        return new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime();
      });
  } catch (e) {
    logError('github', 'Failed to fetch repos', e);
    return [];
  }
}

export async function fetchUserStats(username: string): Promise<UserStats | null> {
  const token = process.env.GITHUB_TOKEN;
  try {
    const res = await fetch(`https://api.github.com/users/${username}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(4500),
    });
    if (!res.ok) return null;
    return res.json();
  } catch (e) {
    logError('github', 'Failed to fetch user stats', e);
    return null;
  }
}
