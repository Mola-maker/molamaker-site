'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';

interface BotStatus {
  online: boolean;
  latencyMs: number | null;
}

interface Props {
  online?: boolean | null;
  latencyMs?: number | null;
}

export default function BotStatusBadge({ online: onlineProp, latencyMs: latencyProp }: Props) {
  const t = useTranslations('bot');
  const [status, setStatus] = useState<BotStatus | null>(
    onlineProp !== undefined ? { online: onlineProp ?? false, latencyMs: latencyProp ?? null } : null,
  );

  useEffect(() => {
    if (onlineProp !== undefined) {
      setStatus({ online: onlineProp ?? false, latencyMs: latencyProp ?? null });
      return;
    }

    let cancelled = false;
    function poll() {
      fetch('/api/bot/status')
        .then((r) => r.json())
        .then((d) => { if (!cancelled) setStatus({ online: d.online, latencyMs: d.latencyMs }); })
        .catch(() => { if (!cancelled) setStatus({ online: false, latencyMs: null }); });
    }
    poll();
    const id = setInterval(poll, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [onlineProp, latencyProp]);

  const label =
    status === null
      ? t('checking')
      : status.online
        ? `${t('online')} · ${status.latencyMs}ms`
        : t('offline');

  return (
    <span
      className={`bot-status-badge ${status === null ? '' : status.online ? 'bot-online' : 'bot-offline'}`}
      aria-live="polite"
    >
      <span className="bot-dot" />
      {label}
    </span>
  );
}
