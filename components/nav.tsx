'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { SITE_CONFIG } from '@/lib/constants';

const LINKS = [
  { href: '/about', label: 'About' },
  { href: '/work', label: 'Work' },
  { href: '/blog', label: 'Blog' },
  { href: '/now', label: 'Now' },
  { href: '/uses', label: 'Uses' },
  { href: '/guestbook', label: 'Guestbook' },
  { href: '/contact', label: 'Contact' },
];

export default function Nav({ isOwner = false }: { isOwner?: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const links = isOwner
    ? [...LINKS, { href: '/admin', label: 'Admin' }]
    : LINKS;

  return (
    <>
      <nav className="top">
        <div className="nav-inner">
          <Link href="/" className="brand">
            <Image className="brand-mini" src={SITE_CONFIG.avatarUrl} alt="mola" width={28} height={28} unoptimized />
            molamaker<span className="dot">.</span>
          </Link>
          <div className="nav-links">
            {links.map((l) => (
              <Link key={l.href} href={l.href}>{l.label}</Link>
            ))}
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
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="mobile-link" onClick={() => setOpen(false)}>{l.label}</Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
