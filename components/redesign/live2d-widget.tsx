'use client';

// Live2D corner mascot via stevenjoezhang/live2d-widget.
// autoload.js self-mounts a draggable Live2D character (bottom-left by default,
// clear of the bottom-right AstrBot dock). Set NEXT_PUBLIC_LIVE2D_BASE to a
// self-hosted copy (your ECS / Aliyun OSS) for China; defaults to the public
// CDN. Workflow message-bus events surface as the mascot's speech bubble via
// the widget's global showMessage(). See deploy/live2d/SETUP.md.

import { useEffect } from 'react';

const LIVE2D_BASE =
  process.env.NEXT_PUBLIC_LIVE2D_BASE?.replace(/\/+$/, '') || '/live2d';

export function Live2DWidget() {
  useEffect(() => {
    // Load the widget once (it appends its own #waifu element to <body>).
    if (!document.getElementById('live2d-autoload')) {
      const s = document.createElement('script');
      s.id = 'live2d-autoload';
      s.src = `${LIVE2D_BASE}/autoload.js`;
      s.async = true;
      document.body.appendChild(s);
    }
    // Surface workflow activity as the mascot's speech.
    const onBus = (e: Event) => {
      const d = (e as CustomEvent).detail as { text?: string; level?: string } | undefined;
      const w = window as unknown as { showMessage?: (t: string, timeout?: number, priority?: number) => void };
      if (d?.text && typeof w.showMessage === 'function') {
        w.showMessage(d.level === 'error' ? `⚠ ${d.text}` : d.text, 4000, 9);
      }
    };
    window.addEventListener('wp:bus', onBus);
    return () => window.removeEventListener('wp:bus', onBus);
  }, []);

  return null;
}
