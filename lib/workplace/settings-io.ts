import { promises as fs } from 'fs';
import path from 'path';

/** Disk I/O for workplace-settings.json — isolated to reduce Turbopack NFT over-tracing. */

export async function statMtimeMs(file: string): Promise<number | null> {
  try {
    const stat = await fs.stat(file);
    return stat.mtimeMs;
  } catch {
    return null;
  }
}

export async function readTextFile(file: string): Promise<string | null> {
  try {
    return await fs.readFile(file, 'utf8');
  } catch {
    return null;
  }
}

export async function writeTextFileAtomic(file: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, content, { mode: 0o600 });
  await fs.rename(tmp, file);
}
