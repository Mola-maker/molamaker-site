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

/** Host portion for masked UI (no path, no credentials). */
export function astrbotHostHint(url: string | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).host;
  } catch {
    return url.replace(/^https?:\/\//, '').split('/')[0] ?? '';
  }
}
