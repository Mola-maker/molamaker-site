export const SITE_CONFIG = {
  avatarUrl:
    process.env.NEXT_PUBLIC_AVATAR_URL ??
    'https://avatars.githubusercontent.com/u/229602071?v=4',
  siteUrl:
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://molamaker.com',
} as const;

