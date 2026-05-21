'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

export default function SupportButton({
  size = 'sm',
  isSupporter = false,
}: {
  size?: 'sm' | 'lg';
  isSupporter?: boolean;
}) {
  const t = useTranslations('support');
  const handle = process.env.NEXT_PUBLIC_BMAC_HANDLE;

  if (isSupporter) {
    return (
      <Link
        href="/resources"
        className={`coffee-btn coffee-btn-${size}`}
        style={{ textDecoration: 'none' }}
      >
        <span className="coffee-label">{t('alreadySupporter')}</span>
      </Link>
    );
  }

  if (!handle) return null;
  return (
    <a
      href={`https://www.buymeacoffee.com/${handle}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`coffee-btn coffee-btn-${size}`}
      aria-label={t('buyMeACoffee')}
    >
      <span className="coffee-emoji" aria-hidden="true">☕</span>
      <span className="coffee-label">{t('buyMeACoffee')}</span>
    </a>
  );
}
