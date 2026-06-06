import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { astrbotHostHint, getAstrbotEnv } from '@/lib/chat/astrbot-env';

// ── Runtime-editable workplace settings ────────────────────────────────────
// A single JSON file (gitignored) is the source of truth for the model API
// configs and the access-control settings an admin edits from the UI. Every
// value falls back to its existing env var when blank, so an empty/missing
// file reproduces the previous env-only behaviour exactly.
//
// Storage target is the ECS box's filesystem (single instance). Override the
// path with WORKPLACE_SETTINGS_FILE to point at a persistent volume. Secrets
// (API keys, password hashes) live server-side only — the client never sees
// raw keys, just masked hints (see maskSettings).

export type ProviderName = 'anthropic' | 'deepseek' | 'coze' | 'dashscope';

/** Canonical provider list — single source of truth to avoid drift. */
export const PROVIDER_NAMES: ProviderName[] = ['anthropic', 'deepseek', 'coze', 'dashscope'];

export interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  botId: string; // coze only; ignored elsewhere
}

export interface AccessConfig {
  // false = workplace is open to visitors with no password ("no verification");
  // true  = visitors must enter the visitor password to get a viewer session.
  visitorMode: boolean;
  visitorPassword: string | null; // "salt:hash" or null
  adminPassword: string | null;   // optional override of WORKPLACE_ADMIN_KEY ("salt:hash")
}

export interface WorkplaceSettings {
  providers: Record<ProviderName, ProviderConfig>;
  access: AccessConfig;
}

// Built-in defaults mirror the previously-hardcoded values in the AI routes.
const PROVIDER_DEFAULTS: Record<ProviderName, Omit<ProviderConfig, 'apiKey'>> = {
  anthropic: { baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-4-6', botId: '' },
  deepseek:  { baseUrl: 'https://api.deepseek.com',  model: 'deepseek-chat',     botId: '' },
  coze:      { baseUrl: 'https://api.coze.cn',        model: '',                  botId: '' },
  // Alibaba Bailian / DashScope — OpenAI-compatible endpoint (Beijing region).
  // Official base URL per docs: https://dashscope.aliyuncs.com/compatible-mode/v1
  // (Singapore: dashscope-intl..., US: dashscope-us...). The streamer tolerates
  // a base with or without the trailing /v1.
  dashscope: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', botId: '' },
};

// Stored config holds only raw user-entered values (blank when unset). The
// built-in defaults and env fallbacks are applied later, in the resolution
// layer (getEffectiveProvider / maskSettings), so an explicit env like
// COZE_BASE_URL is never shadowed by a baked-in default.
function emptySettings(): WorkplaceSettings {
  const blank = (): ProviderConfig => ({ apiKey: '', baseUrl: '', model: '', botId: '' });
  return {
    providers: { anthropic: blank(), deepseek: blank(), coze: blank(), dashscope: blank() },
    access: { visitorMode: false, visitorPassword: null, adminPassword: null },
  };
}

async function resolveSettingsPath(): Promise<string> {
  const envFile = process.env.WORKPLACE_SETTINGS_FILE?.trim();
  if (envFile) return envFile;
  const { join } = await import('path');
  return join(/* turbopackIgnore: true */ process.cwd(), 'data', 'workplace-settings.json');
}

// ── Read / write with a small mtime-aware cache ─────────────────────────────
let cache: { mtimeMs: number; data: WorkplaceSettings } | null = null;

function mergeProvider(_name: ProviderName, raw: Partial<ProviderConfig> | undefined): ProviderConfig {
  // Keep raw values (blank when unset); defaults are applied at resolution time.
  return {
    apiKey: (raw?.apiKey ?? '').trim(),
    baseUrl: (raw?.baseUrl ?? '').trim(),
    model: (raw?.model ?? '').trim(),
    botId: (raw?.botId ?? '').trim(),
  };
}

function normalize(parsed: Partial<WorkplaceSettings> | null): WorkplaceSettings {
  const base = emptySettings();
  if (!parsed) return base;
  return {
    providers: {
      anthropic: mergeProvider('anthropic', parsed.providers?.anthropic),
      deepseek:  mergeProvider('deepseek',  parsed.providers?.deepseek),
      coze:      mergeProvider('coze',      parsed.providers?.coze),
      dashscope: mergeProvider('dashscope', parsed.providers?.dashscope),
    },
    access: {
      visitorMode: Boolean(parsed.access?.visitorMode),
      visitorPassword: parsed.access?.visitorPassword ?? null,
      adminPassword: parsed.access?.adminPassword ?? null,
    },
  };
}

export async function readSettings(): Promise<WorkplaceSettings> {
  const file = await resolveSettingsPath();
  const io = await import('./settings-io');
  try {
    const mtimeMs = await io.statMtimeMs(file);
    if (mtimeMs === null) return emptySettings();
    if (cache && cache.mtimeMs === mtimeMs) return cache.data;
    const raw = await io.readTextFile(file);
    if (raw === null) return emptySettings();
    const data = normalize(JSON.parse(raw) as Partial<WorkplaceSettings>);
    cache = { mtimeMs, data };
    return data;
  } catch {
    return emptySettings();
  }
}

export async function writeSettings(next: WorkplaceSettings): Promise<void> {
  const file = await resolveSettingsPath();
  const io = await import('./settings-io');
  await io.writeTextFileAtomic(file, JSON.stringify(next, null, 2));
  cache = null;
}

// ── Effective provider config (settings → env fallback) ─────────────────────
export interface EffectiveProvider {
  apiKey: string;
  baseUrl: string;
  model: string;
  botId: string;
  configured: boolean;
}

function envFallback(name: ProviderName): { apiKey: string; botId: string; baseUrl?: string } {
  switch (name) {
    case 'anthropic': return { apiKey: process.env.ANTHROPIC_API_KEY ?? '', botId: '' };
    case 'deepseek':  return { apiKey: process.env.DEEPSEEK_API_KEY ?? '', botId: '' };
    case 'dashscope': return { apiKey: process.env.DASHSCOPE_API_KEY ?? '', botId: '' };
    case 'coze':      return {
      apiKey: process.env.COZE_API_KEY ?? '',
      botId: process.env.COZE_BOT_ID ?? '',
      baseUrl: process.env.COZE_BASE_URL,
    };
  }
}

export async function getEffectiveProvider(name: ProviderName): Promise<EffectiveProvider> {
  const s = await readSettings();
  const cfg = s.providers[name];
  const env = envFallback(name);
  const apiKey = cfg.apiKey || env.apiKey;
  const botId = cfg.botId || env.botId;
  const baseUrl = cfg.baseUrl || env.baseUrl || PROVIDER_DEFAULTS[name].baseUrl;
  const model = cfg.model || PROVIDER_DEFAULTS[name].model;
  const configured = name === 'coze' ? !!(apiKey && botId) : !!apiKey;
  return { apiKey, baseUrl, model, botId, configured };
}

// ── Password hashing (scrypt) ───────────────────────────────────────────────
export function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pw, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPassword(pw: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  try {
    const expected = Buffer.from(hashHex, 'hex');
    const actual = scryptSync(pw, Buffer.from(saltHex, 'hex'), 64);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

// ── Public/masked views (safe to send to the client) ────────────────────────
export interface MaskedSettings {
  providers: Record<ProviderName, { hasKey: boolean; keyHint: string; baseUrl: string; model: string; botId: string }>;
  access: { visitorMode: boolean; hasVisitorPassword: boolean; hasAdminPassword: boolean };
  /** AstrBot is env-only (not editable in this panel). */
  astrbot: { configured: boolean; hasKey: boolean; hostHint: string };
}

function keyHint(key: string): string {
  if (!key) return '';
  return key.length <= 8 ? '••••' : `••••${key.slice(-4)}`;
}

export async function maskSettings(): Promise<MaskedSettings> {
  const s = await readSettings();
  const view = (eff: EffectiveProvider) => ({
    hasKey: !!eff.apiKey,
    keyHint: keyHint(eff.apiKey),
    baseUrl: eff.baseUrl,
    model: eff.model,
    botId: eff.botId,
  });
  const [anthropic, deepseek, coze, dashscope] = await Promise.all([
    getEffectiveProvider('anthropic'),
    getEffectiveProvider('deepseek'),
    getEffectiveProvider('coze'),
    getEffectiveProvider('dashscope'),
  ]);
  const ab = getAstrbotEnv();
  return {
    providers: { anthropic: view(anthropic), deepseek: view(deepseek), coze: view(coze), dashscope: view(dashscope) },
    access: {
      visitorMode: s.access.visitorMode,
      hasVisitorPassword: !!s.access.visitorPassword,
      hasAdminPassword: !!(s.access.adminPassword || process.env.WORKPLACE_ADMIN_KEY?.trim()),
    },
    astrbot: {
      configured: ab.configured,
      hasKey: ab.hasKey,
      hostHint: astrbotHostHint(ab.url),
    },
  };
}

// Access config for the public auth gate (no secrets).
export async function getPublicAccess(): Promise<{ visitorMode: boolean; adminEnabled: boolean }> {
  const s = await readSettings();
  return {
    visitorMode: s.access.visitorMode,
    adminEnabled: !!(s.access.adminPassword || process.env.WORKPLACE_ADMIN_KEY?.trim()),
  };
}

// Admin password check: settings hash takes precedence; else the env key
// (compared as a plain shared secret for backward compatibility).
export async function verifyAdminPassword(pw: string): Promise<boolean> {
  const s = await readSettings();
  if (s.access.adminPassword) return verifyPassword(pw, s.access.adminPassword);
  const envKey = process.env.WORKPLACE_ADMIN_KEY?.trim();
  if (!envKey) return false;
  const a = Buffer.from(pw, 'utf8');
  const b = Buffer.from(envKey, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function verifyVisitorPassword(pw: string): Promise<boolean> {
  const s = await readSettings();
  return verifyPassword(pw, s.access.visitorPassword);
}
