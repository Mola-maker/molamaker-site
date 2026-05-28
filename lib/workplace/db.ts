import { createServiceClient } from '@/lib/supabase/service';
import { generateUserId } from './session';

function client() {
  try { return createServiceClient(); } catch { return null; }
}

export type AuditAction = 'login' | 'logout' | 'deploy' | 'workflow_add' | 'claude_run' | 'role_change';

export type WPRole = 'owner' | 'admin' | 'contributor' | 'viewer';

// Owner seeding: a phone or email listed in env is granted 'owner' at first login.
function seedRole(opts: { phone?: string; email?: string }): WPRole {
  const ownerPhone = process.env.WORKPLACE_OWNER_PHONE?.trim();
  const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (ownerPhone && opts.phone && opts.phone.trim() === ownerPhone) return 'owner';
  if (ownerEmail && opts.email && opts.email.trim().toLowerCase() === ownerEmail) return 'owner';
  return 'contributor';
}

export type ResolvedUser = { id: string; role: WPRole };

// Stable identity: find an existing user by phone/openid and reuse their id +
// persisted role; otherwise create one. Falls back to an ephemeral id when
// Supabase is unavailable (dev without env) so login still works.
export async function getOrCreateUser(u: {
  name: string; phone?: string; email?: string; wechatOpenId?: string;
  ip?: string; authMethod?: 'phone' | 'wechat';
}): Promise<ResolvedUser> {
  const fallbackRole = seedRole(u);
  const c = client();
  if (!c) return { id: generateUserId(), role: fallbackRole };
  try {
    // Look up by phone, then by wechat openid
    let existing: { id: string; role: string } | null = null;
    if (u.phone) {
      const { data } = await c.from('workplace_users').select('id, role').eq('phone', u.phone).maybeSingle();
      if (data) existing = data;
    }
    if (!existing && u.wechatOpenId) {
      const { data } = await c.from('workplace_users').select('id, role').eq('wechat_openid', u.wechatOpenId).maybeSingle();
      if (data) existing = data;
    }

    if (existing) {
      // Update last-seen/ip/name without clobbering the (possibly promoted) role
      await c.from('workplace_users').update({
        name: u.name, last_ip: u.ip ?? null, last_seen_at: new Date().toISOString(),
      }).eq('id', existing.id);
      return { id: existing.id, role: (existing.role as WPRole) ?? fallbackRole };
    }

    // New user
    const id = generateUserId();
    const role = fallbackRole;
    await c.from('workplace_users').insert({
      id, name: u.name, phone: u.phone ?? null, email: u.email ?? null,
      wechat_openid: u.wechatOpenId ?? null, last_ip: u.ip ?? null,
      role, auth_method: u.authMethod ?? null,
    });
    return { id, role };
  } catch {
    return { id: generateUserId(), role: fallbackRole };
  }
}

export type WPUserRow = {
  id: string; name: string; phone: string | null; email: string | null;
  wechat_openid: string | null; last_ip: string | null; role: string;
  auth_method: string | null; created_at: string; last_seen_at: string;
};

export async function listUsers(): Promise<WPUserRow[]> {
  const c = client();
  if (!c) return [];
  try {
    const { data } = await c.from('workplace_users').select('*').order('last_seen_at', { ascending: false });
    return (data ?? []) as WPUserRow[];
  } catch { return []; }
}

export async function setUserRole(id: string, role: WPRole): Promise<boolean> {
  const c = client();
  if (!c) return false;
  try {
    await c.from('workplace_users').update({ role }).eq('id', id);
    return true;
  } catch { return false; }
}

// Current role for one user — used by the last-owner lockout guard.
export async function getUserRole(id: string): Promise<WPRole | null> {
  const c = client();
  if (!c) return null;
  try {
    const { data } = await c.from('workplace_users').select('role').eq('id', id).maybeSingle();
    return (data?.role as WPRole) ?? null;
  } catch { return null; }
}

// Count current owners — used to block demoting the last owner (lockout guard).
export async function countOwners(): Promise<number | null> {
  const c = client();
  if (!c) return null; // null = DB unavailable, caller skips the guard
  try {
    const { count } = await c.from('workplace_users').select('id', { count: 'exact', head: true }).eq('role', 'owner');
    return count ?? 0;
  } catch { return null; }
}

export type WPAuditRow = {
  id: string; user_id: string | null; user_name: string | null;
  ip: string | null; action: string; detail: Record<string, unknown>; created_at: string;
};

export async function listAudit(limit = 100): Promise<WPAuditRow[]> {
  const c = client();
  if (!c) return [];
  try {
    const { data } = await c.from('workplace_audit_log')
      .select('*').order('created_at', { ascending: false }).limit(limit);
    return (data ?? []) as WPAuditRow[];
  } catch { return []; }
}

export async function upsertUser(u: {
  id: string; name: string; phone?: string; email?: string;
  wechatOpenId?: string; ip?: string; role?: string; authMethod?: string;
}): Promise<void> {
  const c = client();
  if (!c) return;
  try {
    await c.from('workplace_users').upsert({
      id: u.id, name: u.name, phone: u.phone ?? null, email: u.email ?? null,
      wechat_openid: u.wechatOpenId ?? null, last_ip: u.ip ?? null,
      role: u.role ?? 'contributor', auth_method: u.authMethod ?? null,
      last_seen_at: new Date().toISOString(),
    }, { onConflict: 'id' });
  } catch { /* best-effort */ }
}

export async function writeAudit(entry: {
  userId?: string; userName?: string; ip?: string; action: AuditAction; detail?: Record<string, unknown>;
}): Promise<void> {
  const c = client();
  if (!c) return;
  try {
    await c.from('workplace_audit_log').insert({
      user_id: entry.userId ?? null, user_name: entry.userName ?? null,
      ip: entry.ip ?? null, action: entry.action, detail: entry.detail ?? {},
    });
  } catch { /* best-effort */ }
}

export async function saveOtp(phone: string, code: string, ttlMs: number): Promise<boolean> {
  const c = client();
  if (!c) return false; // signal caller to use in-memory fallback
  try {
    await c.from('workplace_otp').upsert({
      phone, code, expires_at: new Date(Date.now() + ttlMs).toISOString(),
    }, { onConflict: 'phone' });
    return true;
  } catch { return false; }
}

export async function verifyOtpDb(phone: string, code: string): Promise<boolean | null> {
  const c = client();
  if (!c) return null; // null = DB unavailable, caller uses in-memory
  try {
    const { data } = await c.from('workplace_otp').select('code, expires_at').eq('phone', phone).maybeSingle();
    if (!data) return false;
    if (new Date(data.expires_at).getTime() < Date.now()) return false;
    if (data.code !== code) return false;
    await c.from('workplace_otp').delete().eq('phone', phone);
    return true;
  } catch { return null; }
}

export async function recordProject(p: {
  name: string; githubRepo?: string; port?: number;
  creatorId?: string; creatorName?: string; creatorIp?: string; status?: string;
}): Promise<void> {
  const c = client();
  if (!c) return;
  try {
    await c.from('workplace_projects').insert({
      name: p.name, github_repo: p.githubRepo ?? null, port: p.port ?? null,
      creator_id: p.creatorId ?? null, creator_name: p.creatorName ?? null,
      creator_ip: p.creatorIp ?? null, status: p.status ?? 'starting',
    });
  } catch { /* best-effort */ }
}

export type StoredWorkflow = { id: string; name: string; port: number; url?: string; githubRepo?: string; description?: string };

export async function listStoredWorkflows(): Promise<StoredWorkflow[]> {
  const c = client();
  if (!c) return [];
  try {
    const { data } = await c.from('workplace_workflows').select('*').order('created_at');
    return (data ?? []).map((r) => ({ id: r.id, name: r.name, port: r.port, url: r.url ?? undefined, githubRepo: r.github_repo ?? undefined, description: r.description ?? undefined }));
  } catch { return []; }
}

export async function addStoredWorkflow(w: StoredWorkflow): Promise<void> {
  const c = client();
  if (!c) return;
  try {
    await c.from('workplace_workflows').insert({
      id: w.id, name: w.name, port: w.port, url: w.url ?? null,
      github_repo: w.githubRepo ?? null, description: w.description ?? null,
    });
  } catch { /* best-effort */ }
}
