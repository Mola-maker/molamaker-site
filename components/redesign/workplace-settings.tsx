'use client';

// Workplace — Model & Access settings (owner/admin only).
// One place to manage every model's API config (Anthropic / DeepSeek / Coze —
// AstrBot is excluded, it keeps its own env config) plus access control:
// the visitor-mode toggle, the visitor password and the admin password.
// Reads masked state from GET /api/workplace/settings (never raw keys) and
// patches via POST. Blank key/password fields mean "keep the current value".

import { useState, useEffect, useCallback } from 'react';

type ProviderName = 'anthropic' | 'deepseek' | 'coze' | 'dashscope';

type ProviderView = { hasKey: boolean; keyHint: string; baseUrl: string; model: string; botId: string };
type MaskedSettings = {
  providers: Record<ProviderName, ProviderView>;
  access: { visitorMode: boolean; hasVisitorPassword: boolean; hasAdminPassword: boolean };
  astrbot: { configured: boolean; hasKey: boolean; hostHint: string };
};

type ProviderForm = { apiKey: string; baseUrl: string; model: string; botId: string };

const PROVIDER_META: { name: ProviderName; label: string; needsBot?: boolean }[] = [
  { name: 'anthropic', label: 'Anthropic (Claude)' },
  { name: 'deepseek', label: 'DeepSeek' },
  { name: 'dashscope', label: 'DashScope (阿里百炼 · 通义千问)' },
  { name: 'coze', label: 'Coze', needsBot: true },
];

const emptyForm = (): ProviderForm => ({ apiKey: '', baseUrl: '', model: '', botId: '' });

export default function WorkplaceSettings() {
  const [masked, setMasked] = useState<MaskedSettings | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [forms, setForms] = useState<Record<ProviderName, ProviderForm>>({
    anthropic: emptyForm(), deepseek: emptyForm(), coze: emptyForm(), dashscope: emptyForm(),
  });
  const [visitorMode, setVisitorMode] = useState(false);
  const [visitorPassword, setVisitorPassword] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const hydrate = useCallback((m: MaskedSettings) => {
    setMasked(m);
    setForms({
      anthropic: { apiKey: '', baseUrl: m.providers.anthropic.baseUrl, model: m.providers.anthropic.model, botId: '' },
      deepseek: { apiKey: '', baseUrl: m.providers.deepseek.baseUrl, model: m.providers.deepseek.model, botId: '' },
      dashscope: { apiKey: '', baseUrl: m.providers.dashscope.baseUrl, model: m.providers.dashscope.model, botId: '' },
      coze: { apiKey: '', baseUrl: m.providers.coze.baseUrl, model: m.providers.coze.model, botId: m.providers.coze.botId },
    });
    setVisitorMode(m.access.visitorMode);
    setVisitorPassword('');
    setAdminPassword('');
  }, []);

  useEffect(() => {
    let alive = true;
    fetch('/api/workplace/settings', { credentials: 'include' })
      .then((r) => {
        if (r.status === 403 || r.status === 401) { if (alive) setForbidden(true); return null; }
        return r.ok ? r.json() : null;
      })
      .then((j: { data?: MaskedSettings } | null) => { if (alive && j?.data) hydrate(j.data); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [hydrate]);

  const setField = (name: ProviderName, field: keyof ProviderForm, value: string) => {
    setForms((f) => ({ ...f, [name]: { ...f[name], [field]: value } }));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const body = {
        providers: {
          anthropic: { apiKey: forms.anthropic.apiKey, baseUrl: forms.anthropic.baseUrl, model: forms.anthropic.model },
          deepseek: { apiKey: forms.deepseek.apiKey, baseUrl: forms.deepseek.baseUrl, model: forms.deepseek.model },
          dashscope: { apiKey: forms.dashscope.apiKey, baseUrl: forms.dashscope.baseUrl, model: forms.dashscope.model },
          coze: { apiKey: forms.coze.apiKey, baseUrl: forms.coze.baseUrl, model: forms.coze.model, botId: forms.coze.botId },
        },
        access: {
          visitorMode,
          // Blank = keep the current password; routes hash any non-empty value.
          visitorPassword: visitorPassword || undefined,
          adminPassword: adminPassword || undefined,
        },
      };
      const r = await fetch('/api/workplace/settings', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({})) as { data?: MaskedSettings; error?: string };
      if (!r.ok || !j.data) { setError(j.error ?? 'Save failed'); return; }
      hydrate(j.data);
      setSaved(true);
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  if (forbidden) return null;

  return (
    <section className="wp-settings" aria-label="Model and access settings">
      <div className="wp-section-label"><span>Settings</span></div>

      {loading ? (
        <div className="wp-settings__loading" aria-busy="true">
          <div className="wp-skeleton wp-settings__skel" />
          <div className="wp-skeleton wp-settings__skel" />
        </div>
      ) : (
        <div className="wp-settings__grid">
          {/* ── AstrBot (env-only) ───────────────────────────────── */}
          <div className="wp-settings__group wp-settings__group--astrbot">
            <h4 className="wp-settings__group-title">AstrBot <span className="wp-settings__note">server env only</span></h4>
            <p className="wp-settings__astrbot-desc">
              Powers the site chat bubble, Live2D mascot, and file uploads. Set{' '}
              <code>ASTRBOT_INTERNAL_URL</code> and <code>ASTRBOT_API_KEY</code> in{' '}
              <code>.env.local</code> on the host — not in this panel.
            </p>
            <div className="wp-settings__provider">
              <div className="wp-settings__provider-head">
                <span className="wp-settings__provider-name">ECS AstrBot</span>
                <span className={`wp-settings__chip${masked?.astrbot.configured ? ' is-on' : ''}`}>
                  {masked?.astrbot.configured
                    ? `${masked.astrbot.hostHint || 'configured'}${masked.astrbot.hasKey ? ' · key set' : ' · no API key'}`
                    : 'not configured'}
                </span>
              </div>
            </div>
          </div>

          {/* ── Models (Math + chat fallback) ───────────────────── */}
          <div className="wp-settings__group">
            <h4 className="wp-settings__group-title">Models <span className="wp-settings__note">Math assistant &amp; chat fallback</span></h4>
            {PROVIDER_META.map(({ name, label, needsBot }) => {
              const view = masked?.providers[name];
              return (
                <div className="wp-settings__provider" key={name}>
                  <div className="wp-settings__provider-head">
                    <span className="wp-settings__provider-name">{label}</span>
                    <span className={`wp-settings__chip${view?.hasKey ? ' is-on' : ''}`}>
                      {view?.hasKey ? `key ${view.keyHint}` : 'no key'}
                    </span>
                  </div>
                  <div className="wp-settings__fields">
                    <label className="wp-settings__field">
                      <span>API key</span>
                      <input
                        type="password"
                        name={`${name}-apikey`}
                        autoComplete="off"
                        placeholder={view?.hasKey ? `${view.keyHint} — leave blank to keep` : 'paste key'}
                        value={forms[name].apiKey}
                        onChange={(e) => setField(name, 'apiKey', e.target.value)}
                      />
                    </label>
                    <label className="wp-settings__field">
                      <span>Base URL</span>
                      <input
                        type="text"
                        name={`${name}-baseurl`}
                        value={forms[name].baseUrl}
                        onChange={(e) => setField(name, 'baseUrl', e.target.value)}
                      />
                    </label>
                    <label className="wp-settings__field">
                      <span>Model</span>
                      <input
                        type="text"
                        name={`${name}-model`}
                        value={forms[name].model}
                        onChange={(e) => setField(name, 'model', e.target.value)}
                      />
                    </label>
                    {needsBot && (
                      <label className="wp-settings__field">
                        <span>Bot ID</span>
                        <input
                          type="text"
                          name={`${name}-botid`}
                          value={forms[name].botId}
                          onChange={(e) => setField(name, 'botId', e.target.value)}
                        />
                      </label>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Access control ───────────────────────────────────── */}
          <div className="wp-settings__group">
            <h4 className="wp-settings__group-title">Access control</h4>

            <label className="wp-settings__toggle">
              <input
                type="checkbox"
                name="visitor-mode"
                checked={visitorMode}
                onChange={(e) => { setVisitorMode(e.target.checked); setSaved(false); }}
              />
              <span>
                <strong>Require a visitor password</strong>
                <small>{visitorMode
                  ? 'Visitors must enter the visitor password to view the workplace.'
                  : 'Off — the workplace is open to visitors with no verification.'}</small>
              </span>
            </label>

            <label className="wp-settings__field">
              <span>Visitor password {masked?.access.hasVisitorPassword && <em className="wp-settings__set">set</em>}</span>
              <input
                type="password"
                name="visitor-password"
                autoComplete="off"
                placeholder={masked?.access.hasVisitorPassword ? 'leave blank to keep' : 'set a visitor password'}
                value={visitorPassword}
                onChange={(e) => { setVisitorPassword(e.target.value); setSaved(false); }}
                disabled={!visitorMode}
              />
            </label>

            <label className="wp-settings__field">
              <span>Admin password {masked?.access.hasAdminPassword && <em className="wp-settings__set">set</em>}</span>
              <input
                type="password"
                name="admin-password"
                autoComplete="off"
                placeholder={masked?.access.hasAdminPassword ? 'leave blank to keep' : 'set an admin password'}
                value={adminPassword}
                onChange={(e) => { setAdminPassword(e.target.value); setSaved(false); }}
              />
              <small className="wp-settings__hint">Overrides the WORKPLACE_ADMIN_KEY env. Used for the Administrator entry.</small>
            </label>
          </div>

          {/* ── Actions ──────────────────────────────────────────── */}
          <div className="wp-settings__actions">
            {error && <span className="wp-settings__error">{error}</span>}
            {saved && <span className="wp-settings__ok">Saved ✓</span>}
            <button className="wp-settings__save" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
