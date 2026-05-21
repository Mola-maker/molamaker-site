'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { SITE_CONFIG } from '@/lib/constants';
import LocaleSwitcher from './locale-switcher';

export default function Nav({ isOwner = false }: { isOwner?: boolean }) {
  const t = useTranslations('nav');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const routeKeys = ['about', 'work', 'projects', 'blog', 'resources', 'chat', 'now', 'uses', 'guestbook', 'contact'] as const;
  const links = routeKeys.map((key) => ({ href: `/${key}`, label: t(key) }));
  const allLinks = isOwner
    ? [...links, { href: '/admin', label: t('admin') }]
    : links;

  return (
    <>
      <nav className="top">
        <div className="nav-inner">
          <Link href="/" className="brand">
            <Image className="brand-mini" src={SITE_CONFIG.avatarUrl} alt="mola" width={28} height={28} unoptimized />
            molamaker<span className="dot">.</span>
          </Link>
          <div className="nav-links">
            {allLinks.map((l) => (
              <Link key={l.href} href={l.href}>{l.label}</Link>
            ))}
            <LocaleSwitcher />
          </div>
          <button className="hamburger" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? '×' : '☰'}
          </button>
        </div>
      </nav>
      {open && (
        <div className="mobile-menu">
          <button className="mobile-close" onClick={() => setOpen(false)} aria-label="Close">×</button>
          <div className="mobile-links">
            {allLinks.map((l) => (
              <Link key={l.href} href={l.href} className="mobile-link" onClick={() => setOpen(false)}>{l.label}</Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
