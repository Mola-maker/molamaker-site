'use client';

import { useState, useEffect } from 'react';

type Props = { onAuth: () => void };
type Tab = 'visitor' | 'phone' | 'wechat' | 'admin';
type Access = { visitorMode: boolean; adminEnabled: boolean };

export function WorkplaceAuth({ onAuth }: Props) {
  const [tab, setTab] = useState<Tab>('visitor');
  const [access, setAccess] = useState<Access | null>(null);
  // Admin key state
  const [adminKey, setAdminKey] = useState('');
  const [adminName, setAdminName] = useState('');
  const [keySubmitting, setKeySubmitting] = useState(false);
  // Visitor state
  const [visitorName, setVisitorName] = useState('');
  const [visitorPw, setVisitorPw] = useState('');
  const [visitorBusy, setVisitorBusy] = useState(false);
  // Phone OTP state
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugCode, setDebugCode] = useState<string | null>(null);
  // WeChat QR state
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);

  // Discover access config (visitor mode + whether admin sign-in is enabled).
  useEffect(() => {
    fetch('/api/workplace/access')
      .then((r) => r.ok ? r.json() : null)
      .then((j: { data?: Access } | null) => { if (j?.data) setAccess(j.data); })
      .catch(() => {});
  }, []);

  // Load WeChat QR when that tab is shown
  useEffect(() => {
    if (tab !== 'wechat' || qrUrl || qrLoading) return;
    setQrLoading(true);
    fetch('/api/workplace/auth/wechat?action=qr')
      .then((r) => r.json())
      .then((j: { data?: { url: string }; error?: string }) => {
        if (j.data?.url) setQrUrl(j.data.url);
        else setQrError(j.error ?? 'WeChat not configured');
      })
      .catch(() => setQrError('Failed to load QR'))
      .finally(() => setQrLoading(false));
  }, [tab, qrUrl, qrLoading]);

  const enterVisitor = async () => {
    setVisitorBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/workplace/auth/visitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: visitorName.trim() || undefined, password: visitorPw.trim() || undefined }),
      });
      const j = await r.json() as { ok?: boolean; error?: string };
      if (!r.ok || !j.ok) { setError(j.error ?? 'Could not enter'); return; }
      onAuth();
    } catch { setError('Network error'); }
    finally { setVisitorBusy(false); }
  };

  const sendCode = async () => {
    if (!phone.trim()) { setError('Phone number required'); return; }
    setSending(true);
    setError(null);
    try {
      const r = await fetch('/api/workplace/auth/phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', phone: phone.trim() }),
      });
      const j = await r.json() as { ok?: boolean; debug_code?: string; error?: string };
      if (!r.ok || !j.ok) { setError(j.error ?? 'Failed to send'); return; }
      setCodeSent(true);
      if (j.debug_code) setDebugCode(j.debug_code); // dev mode only
    } finally { setSending(false); }
  };

  const signInWithKey = async () => {
    if (!adminKey.trim()) { setError('Admin password required'); return; }
    setKeySubmitting(true);
    setError(null);
    try {
      const r = await fetch('/api/workplace/auth/key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: adminKey.trim(), name: adminName.trim() || undefined }),
      });
      const j = await r.json() as { ok?: boolean; error?: string };
      if (!r.ok || !j.ok) { setError(j.error ?? 'Sign-in failed'); return; }
      onAuth();
    } catch { setError('Network error'); }
    finally { setKeySubmitting(false); }
  };

  const verify = async () => {
    if (!code.trim() || !name.trim()) { setError('Name and verification code required'); return; }
    setVerifying(true);
    setError(null);
    try {
      const r = await fetch('/api/workplace/auth/phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', phone: phone.trim(), code: code.trim(), name: name.trim() }),
      });
      const j = await r.json() as { ok?: boolean; error?: string };
      if (!r.ok || !j.ok) { setError(j.error ?? 'Verification failed'); return; }
      onAuth();
    } finally { setVerifying(false); }
  };

  const switchTab = (t: Tab) => { setTab(t); setError(null); };

  return (
    <div className="wp-auth-gate">
      <h1 className="wp-auth-gate__title">work<em>place</em></h1>
      <p className="wp-auth-gate__sub">AI workflow orchestration · choose how to enter</p>

      <div className="wp-auth-card">
        <div className="wp-auth-tabs wp-auth-tabs--4">
          <button className={`wp-auth-tab${tab === 'visitor' ? ' is-active' : ''}`} onClick={() => switchTab('visitor')}>
            ✦ Visitor
          </button>
          <button className={`wp-auth-tab${tab === 'phone' ? ' is-active' : ''}`} onClick={() => switchTab('phone')}>
            ☎ Phone
          </button>
          <button className={`wp-auth-tab${tab === 'wechat' ? ' is-active' : ''}`} onClick={() => switchTab('wechat')}>
            微 WeChat
          </button>
          <button className={`wp-auth-tab${tab === 'admin' ? ' is-active' : ''}`} onClick={() => switchTab('admin')}>
            ⌘ Admin
          </button>
        </div>

        <div className="wp-auth-body">
          {tab === 'visitor' && (
            <div className="wp-phone">
              <label className="wp-phone__label">Display name <span style={{ color: 'var(--ink-soft)' }}>(optional)</span></label>
              <input
                className="wp-phone__name"
                type="text"
                name="visitor-name"
                placeholder="Guest"
                value={visitorName}
                onChange={(e) => setVisitorName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !access?.visitorMode && enterVisitor()}
              />
              {access?.visitorMode ? (
                <>
                  <label className="wp-phone__label">Visitor password</label>
                  <input
                    className="wp-phone__name"
                    type="password"
                    name="visitor-password"
                    placeholder="••••••••"
                    value={visitorPw}
                    onChange={(e) => setVisitorPw(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && enterVisitor()}
                    autoComplete="off"
                  />
                  <button className="wp-phone__send" onClick={enterVisitor} disabled={visitorBusy}>
                    {visitorBusy ? 'Entering…' : 'Enter →'}
                  </button>
                </>
              ) : (
                <>
                  <button className="wp-phone__send" onClick={enterVisitor} disabled={visitorBusy}>
                    {visitorBusy ? 'Entering…' : 'Enter as visitor →'}
                  </button>
                  <p className="wp-auth__hint">Open access — no password needed.<br />You&apos;ll have read-only (viewer) access.</p>
                </>
              )}
              {error && <div className="wp-auth__error">{error}</div>}
            </div>
          )}

          {tab === 'phone' && (
            <div className="wp-phone">
              {!codeSent ? (
                <>
                  <label className="wp-phone__label">Phone number</label>
                  <div className="wp-phone__row">
                    <span className="wp-phone__prefix">+86</span>
                    <input
                      className="wp-phone__input"
                      type="tel"
                      name="phone-number"
                      placeholder="138 0000 0000"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && sendCode()}
                    />
                  </div>
                  <button className="wp-phone__send" onClick={sendCode} disabled={sending}>
                    {sending ? 'Sending…' : 'Send OTP →'}
                  </button>
                </>
              ) : (
                <>
                  <label className="wp-phone__label">Your name</label>
                  <input
                    className="wp-phone__name"
                    type="text"
                    name="phone-name"
                    placeholder="Display name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <label className="wp-phone__label">Verification code{debugCode ? ` (dev: ${debugCode})` : ''}</label>
                  <div className="wp-phone__otp-row">
                    <input
                      className="wp-phone__otp"
                      type="text"
                      name="phone-otp"
                      maxLength={6}
                      placeholder="______"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                      onKeyDown={(e) => e.key === 'Enter' && verify()}
                    />
                    <button className="wp-phone__verify" onClick={verify} disabled={verifying}>
                      {verifying ? '…' : 'Verify'}
                    </button>
                  </div>
                  <button className="wp-phone__send" style={{ background: 'none', border: '1px solid var(--rule)', color: 'var(--ink-soft)' }} onClick={() => { setCodeSent(false); setCode(''); setDebugCode(null); }}>
                    ← Back
                  </button>
                </>
              )}
              {error && <div className="wp-auth__error">{error}</div>}
              <p className="wp-auth__hint">Accounts are scoped to this workspace.<br />Your IP and device info will be recorded.</p>
            </div>
          )}

          {tab === 'admin' && (
            <div className="wp-phone">
              <label className="wp-phone__label">Display name</label>
              <input
                className="wp-phone__name"
                type="text"
                name="admin-name"
                placeholder="Owner"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
              />
              <label className="wp-phone__label">Admin password</label>
              <input
                className="wp-phone__name"
                type="password"
                name="admin-key"
                placeholder="••••••••••••"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && signInWithKey()}
                autoComplete="off"
              />
              <button className="wp-phone__send" onClick={signInWithKey} disabled={keySubmitting}>
                {keySubmitting ? 'Signing in…' : 'Enter as administrator →'}
              </button>
              {error && <div className="wp-auth__error">{error}</div>}
              <p className="wp-auth__hint">
                {access && !access.adminEnabled
                  ? 'No admin password is set yet — configure WORKPLACE_ADMIN_KEY or set one in Settings.'
                  : 'Full control: manage members, visitor access and model API keys.'}
              </p>
            </div>
          )}

          {tab === 'wechat' && (
            <div className="wp-wechat">
              <div className="wp-wechat__qr">
                {qrLoading && <div className="wp-wechat__qr-loading">Loading QR…</div>}
                {qrError && <div style={{ fontSize: '10.5px', color: 'var(--ink-soft)', textAlign: 'center' }}>{qrError}</div>}
                {qrUrl && !qrLoading && (
                  <iframe
                    className="wp-wechat__frame"
                    src={qrUrl}
                    title="WeChat QR login"
                    sandbox="allow-scripts allow-same-origin allow-top-navigation"
                  />
                )}
              </div>
              <p className="wp-wechat__label">
                Scan with WeChat to continue.<br />
                Requires WECHAT_APP_ID to be configured.
              </p>
              {qrError && <span className="wp-wechat__status">{qrError}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
