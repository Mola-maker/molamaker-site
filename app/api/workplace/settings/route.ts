import { NextRequest, NextResponse } from 'next/server';
import { getWPSession } from '@/lib/workplace/session';
import { writeAudit } from '@/lib/workplace/db';
import { clientIp } from '@/lib/client-ip';
import {
  readSettings, writeSettings, maskSettings, hashPassword,
  PROVIDER_NAMES, type ProviderName, type WorkplaceSettings,
} from '@/lib/workplace/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROVIDERS: ProviderName[] = PROVIDER_NAMES;

function isAdmin(role: string | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

// GET — masked settings for the admin panel. Never returns raw API keys.
export async function GET() {
  const session = await getWPSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!isAdmin(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return NextResponse.json({ data: await maskSettings() });
}

// Provider field patch: blank string = keep existing, null = clear.
type ProviderPatch = {
  apiKey?: string | null;
  baseUrl?: string;
  model?: string;
  botId?: string;
};
type AccessPatch = {
  visitorMode?: boolean;
  visitorPassword?: string | null;
  adminPassword?: string | null;
};

function applyKey(current: string, patch: string | null | undefined): string {
  if (patch === null) return '';        // explicit clear
  if (patch === undefined) return current;
  const t = patch.trim();
  return t === '' ? current : t;        // blank = keep (the UI shows a masked hint, not the real key)
}

function applyPassword(current: string | null, patch: string | null | undefined): string | null {
  if (patch === null) return null;      // explicit clear
  if (patch === undefined) return current;
  const t = patch.trim();
  return t === '' ? current : hashPassword(t);
}

// POST — update settings (admin/owner only). Accepts a partial patch.
export async function POST(req: NextRequest) {
  const session = await getWPSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!isAdmin(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  let body: { providers?: Partial<Record<ProviderName, ProviderPatch>>; access?: AccessPatch };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const current = await readSettings();
  const next: WorkplaceSettings = {
    providers: { ...current.providers },
    access: { ...current.access },
  };

  for (const name of PROVIDERS) {
    const p = body.providers?.[name];
    if (!p) continue;
    const cur = current.providers[name];
    next.providers[name] = {
      apiKey: applyKey(cur.apiKey, p.apiKey),
      baseUrl: typeof p.baseUrl === 'string' ? p.baseUrl.trim() : cur.baseUrl,
      model: typeof p.model === 'string' ? p.model.trim() : cur.model,
      botId: typeof p.botId === 'string' ? p.botId.trim() : cur.botId,
    };
  }

  if (body.access) {
    const a = body.access;
    next.access = {
      visitorMode: typeof a.visitorMode === 'boolean' ? a.visitorMode : current.access.visitorMode,
      visitorPassword: applyPassword(current.access.visitorPassword, a.visitorPassword),
      adminPassword: applyPassword(current.access.adminPassword, a.adminPassword),
    };
  }

  await writeSettings(next);
  await writeAudit({
    userId: session.userId, userName: session.name, ip: await clientIp(),
    action: 'role_change',
    detail: { what: 'workplace_settings_update', by: session.name },
  });

  return NextResponse.json({ data: await maskSettings() });
}
