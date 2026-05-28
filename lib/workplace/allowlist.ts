// Repo allowlist for the deploy route. Set WORKPLACE_REPO_ALLOWLIST to a
// comma-separated list of allowed "owner" or "owner/repo" entries
// (e.g. "paperclipai,rullerzhou-afk/clawd-on-desk,mola-maker").
// If unset, deploys are denied (fail-closed) unless NODE_ENV !== 'production'.

export function parseRepo(repoUrl: string): { owner: string; repo: string } | null {
  const m = repoUrl.match(/^https:\/\/github\.com\/([^/]+)\/([^/?#]+)/);
  if (!m) return null;
  return { owner: m[1], repo: m[2].replace(/\.git$/, '') };
}

export function isRepoAllowed(repoUrl: string): boolean {
  const parsed = parseRepo(repoUrl);
  if (!parsed) return false;
  const raw = process.env.WORKPLACE_REPO_ALLOWLIST;
  if (!raw) return process.env.NODE_ENV !== 'production'; // dev: allow; prod: deny
  const entries = raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const owner = parsed.owner.toLowerCase();
  const full = `${parsed.owner}/${parsed.repo}`.toLowerCase();
  return entries.includes(owner) || entries.includes(full);
}
