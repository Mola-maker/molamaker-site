// Handles anonymous login to the NetEase Docker API for song URL access.
// Cookies are cached in-memory and refreshed when they expire.

const DOCKER_BASE = process.env.NETEASE_API_URL;
let cachedCookies: string | null = null;
let cookieExpiry = 0;

function extractCookies(raw: string): string {
  return raw
    .split(';')
    .map((s) => s.trim())
    .filter((s) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(s))
    .join('; ');
}

export async function getNeteaseCookies(): Promise<string | null> {
  if (cachedCookies && Date.now() < cookieExpiry) return cachedCookies;
  if (!DOCKER_BASE) return null;
  try {
    const r = await fetch(`${DOCKER_BASE}/register/anonimous`, {
      signal: AbortSignal.timeout(5000),
    });
    const j = await r.json();
    if (j.code === 200 && j.cookie) {
      cachedCookies = extractCookies(j.cookie);
      cookieExpiry = Date.now() + 30 * 60 * 1000;
      return cachedCookies;
    }
  } catch {
    /* docker unreachable */
  }
  return null;
}

export function clearNeteaseCookies() {
  cachedCookies = null;
  cookieExpiry = 0;
}
