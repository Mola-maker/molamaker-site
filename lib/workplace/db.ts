import { createServiceClient } from '@/lib/supabase/service';

function client() {
  try { return createServiceClient(); } catch { return null; }
}

export type AuditAction = 'login' | 'logout' | 'deploy' | 'workflow_add' | 'claude_run';

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
