import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { getWPSession } from '@/lib/workplace/session';
import { messageBus } from '@/lib/workplace/bus';
import { isRepoAllowed } from '@/lib/workplace/allowlist';

export const runtime = 'nodejs';

const execAsync = promisify(exec);
let nextPort = 6200;

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
  if (!/^https:\/\/github\.com\/[^/]+\/[^/]+/.test(repoUrl)) {
    return NextResponse.json({ error: 'only github.com URLs supported' }, { status: 400 });
  }

  if (!isRepoAllowed(repoUrl)) {
    return NextResponse.json({ error: 'repo not in allowlist — set WORKPLACE_REPO_ALLOWLIST' }, { status: 403 });
  }

  const port = nextPort++;
  const dir = mkdtempSync(join(tmpdir(), 'wp-deploy-'));
  const deployName = name ?? repoUrl.split('/').at(-1) ?? 'workflow';

  messageBus.publish({ workflow: 'deploy', text: `Cloning ${repoUrl} → port ${port}`, level: 'info' });

  // Fire-and-forget: clone + install + start
  (async () => {
    try {
      await execAsync(`git clone --depth 1 ${repoUrl} ${dir}`);
      messageBus.publish({ workflow: 'deploy', text: `[${deployName}] clone complete`, level: 'info' });

      // Detect package manager
      const useNpm = await execAsync(`test -f ${dir}/package.json`).then(() => true).catch(() => false);
      if (useNpm) {
        await execAsync(`cd ${dir} && npm install --ignore-scripts 2>&1`);
        messageBus.publish({ workflow: 'deploy', text: `[${deployName}] dependencies installed`, level: 'info' });
      }

      messageBus.publish({ workflow: 'deploy', text: `[${deployName}] ready on port ${port}`, level: 'info' });
    } catch (err) {
      messageBus.publish({ workflow: 'deploy', text: `[${deployName}] deploy failed: ${String(err)}`, level: 'error' });
    }
  })();

  return NextResponse.json({ ok: true, data: { port, name: deployName, dir } });
}
