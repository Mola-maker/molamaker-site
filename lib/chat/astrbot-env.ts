// Single source of truth for AstrBot connection env vars.
// Used by /api/astrbot/*, /api/chat/*, and the settings panel status chip.
// AstrBot is intentionally NOT in workplace-settings.json — it stays on the ECS host.

export interface AstrbotEnv {
  url: string | undefined;
  key: string | undefined;
  configured: boolean;
  hasKey: boolean;
}

export function getAstrbotEnv(): AstrbotEnv {
  const url = process.env.ASTRBOT_INTERNAL_URL?.trim() || undefined;
  const key = process.env.ASTRBOT_API_KEY?.trim() || undefined;
  return {
    url,
    key,
    configured: !!url,
    hasKey: !!key,
  };
}

/**
 * Auth headers for AstrBot Open API calls. The canonical scheme is the
 * X-API-Key header (api1.json); Bearer is accepted by newer builds only —
 * send both so every deployed version authenticates. Single source of truth
 * for all /api/astrbot/* proxies.
 */
export function astrbotAuthHeaders(key: string | undefined, extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  if (key) {
    headers['X-API-Key'] = key;
    headers['Authorization'] = `Bearer ${key}`;
  }
  return headers;
}

/** Host portion for masked UI (no path, no credentials). */
export function astrbotHostHint(url: string | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).host;
  } catch {
    return url.replace(/^https?:\/\//, '').split('/')[0] ?? '';
  }
}
