'use client';

import { useState, useEffect } from 'react';

type Props = { onAuth: () => void };

export function WorkplaceAuth({ onAuth }: Props) {
  const [tab, setTab] = useState<'wechat' | 'phone'>('phone');
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

  return (
    <div className="wp-auth-gate">
      <h1 className="wp-auth-gate__title">work<em>place</em></h1>
      <p className="wp-auth-gate__sub">AI workflow orchestration · sign in to continue</p>

      <div className="wp-auth-card">
        <div className="wp-auth-tabs">
          <button className={`wp-auth-tab${tab === 'phone' ? ' is-active' : ''}`} onClick={() => setTab('phone')}>
            ☎ Phone OTP
          </button>
          <button className={`wp-auth-tab${tab === 'wechat' ? ' is-active' : ''}`} onClick={() => setTab('wechat')}>
            微 WeChat
          </button>
        </div>

        <div className="wp-auth-body">
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
                    placeholder="Display name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <label className="wp-phone__label">Verification code{debugCode ? ` (dev: ${debugCode})` : ''}</label>
                  <div className="wp-phone__otp-row">
                    <input
                      className="wp-phone__otp"
                      type="text"
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
