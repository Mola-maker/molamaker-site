import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { mkdtempSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { getWPSession } from '@/lib/workplace/session';
import { messageBus } from '@/lib/workplace/bus';
import { isRepoAllowed } from '@/lib/workplace/allowlist';
import { recordProject, writeAudit } from '@/lib/workplace/db';

export const runtime = 'nodejs';

// execFile (no shell) — args are passed as an array so a malicious repoUrl can
// never break out into shell metacharacters. Never switch this back to exec().
const execFileAsync = promisify(execFile);
let nextPort = 6200;

// Strict GitHub repo URL: anchored, owner/repo limited to safe characters,
// optional trailing .git or slash. Defense-in-depth on top of execFile.
const GITHUB_URL_RE = /^https:\/\/github\.com\/[A-Za-z0-9][A-Za-z0-9_.-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*(?:\.git)?\/?$/;

export async function POST(req: NextRequest) {
  const session = await getWPSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role === 'viewer' || session.role === 'contributor') {
    return NextResponse.json({ error: 'admin or owner required' }, { status: 403 });
  }

  const body = await req.json() as { repoUrl?: string; name?: string };
  const { repoUrl, name } = body;
  if (!repoUrl || typeof repoUrl !== 'string') {
    return NextResponse.json({ error: 'repoUrl required' }, { status: 400 });
  }

  // Validate it looks like a GitHub URL
  if (!GITHUB_URL_RE.test(repoUrl)) {
    return NextResponse.json({ error: 'only github.com URLs supported' }, { status: 400 });
  }

  if (!isRepoAllowed(repoUrl)) {
    return NextResponse.json({ error: 'repo not in allowlist — set WORKPLACE_REPO_ALLOWLIST' }, { status: 403 });
  }

  const port = nextPort++;
  const dir = mkdtempSync(join(tmpdir(), 'wp-deploy-'));
  const deployName = name ?? repoUrl.split('/').at(-1) ?? 'workflow';

  messageBus.publish({ workflow: 'deploy', text: `Cloning ${repoUrl} → port ${port}`, level: 'info' });

  // Record the project + who created it (Goal: accountability per creator).
  await recordProject({
    name: deployName, githubRepo: repoUrl, port,
    creatorId: session.userId, creatorName: session.name, creatorIp: session.ip,
    status: 'starting',
  });
  await writeAudit({
    action: 'deploy', userId: session.userId, userName: session.name, ip: session.ip,
    detail: { name: deployName, repo: repoUrl, port },
  });

  // Fire-and-forget: clone + install + start
  (async () => {
    try {
      // `--` ensures repoUrl is treated as a positional arg, never an option.
      await execFileAsync('git', ['clone', '--depth', '1', '--', repoUrl, dir]);
      messageBus.publish({ workflow: 'deploy', text: `[${deployName}] clone complete`, level: 'info' });

      if (existsSync(join(dir, 'package.json'))) {
        await execFileAsync('npm', ['install', '--ignore-scripts'], { cwd: dir });
        messageBus.publish({ workflow: 'deploy', text: `[${deployName}] dependencies installed`, level: 'info' });
      }

      messageBus.publish({ workflow: 'deploy', text: `[${deployName}] ready on port ${port}`, level: 'info' });
    } catch (err) {
      messageBus.publish({ workflow: 'deploy', text: `[${deployName}] deploy failed: ${String(err)}`, level: 'error' });
    }
  })();

  return NextResponse.json({ ok: true, data: { port, name: deployName, dir } });
}
