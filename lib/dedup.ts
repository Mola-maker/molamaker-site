const recent = new Map<string, number>();

const DEDUP_WINDOW = 60_000;

let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 60_000;

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return h.toString(36);
}

export function isDuplicate(key: string, content: string): boolean {
  const now = Date.now();
  const h = `${key}:${hash(content)}`;
  const last = recent.get(h);
  if (last && now - last < DEDUP_WINDOW) return true;
  recent.set(h, now);

  if (recent.size > 1000 || now - lastCleanup > CLEANUP_INTERVAL) {
    lastCleanup = now;
    for (const [k, v] of recent) {
      if (now - v > DEDUP_WINDOW * 2) recent.delete(k);
    }
  }
  return false;
}
