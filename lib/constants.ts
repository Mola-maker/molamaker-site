export const SITE_CONFIG = {
  avatarUrl:
    process.env.NEXT_PUBLIC_AVATAR_URL ??
    'https://avatars.githubusercontent.com/u/229602071?v=4',
  // `||` (not `??`) so empty-string env vars don't slip through.
  // `window.location.origin` at runtime means the redirect URL always
  // matches the actual deployed origin, even if NEXT_PUBLIC_SITE_URL
  // was unset or wrong at build time.
  siteUrl:
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    'https://molamaker.com',
} as const;
