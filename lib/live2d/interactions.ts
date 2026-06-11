'use client';

// Live2D life — the ambient behaviours that make the 看板娘 feel inhabited.
// One init, many small reactions, all built on the director:
//
//   · time-of-day greeting when the model first appears
//   · petting: stroke her with the cursor → blush + flustered line
//   · variant-switch commentary (mola:variant from root)
//   · NetEase: announces tracks, and outside the concert she SINGS ALONG —
//     lip-sync follows the LRC line timing, with the occasional lyric bubble
//   · message-board host: a new guestbook entry (mola:guest-posted) gets a
//     thank-you by name + a reply in her voice (lib/miku/board-replies);
//     idle chatter sometimes quotes a recent entry off the wall
//   · reaching the page bottom nudges visitors toward the guestbook
//
// Everything is throttled and yields to bigger productions: nothing speaks
// during stage scenes, and ambient lines use low priority so the widget's own
// messages win.

import { live2dVisible, mascotSay, playMotion, playExpression, startLipSync, stopLipSync } from '@/lib/live2d/director';
import { mikuBoardReply } from '@/lib/miku/board-replies';

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/** Time-of-day greeting bucket — exported for tests. */
export function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 11) return pick(['早上好~ 今天也要元气满满! ♪', 'おはよう! 新的一天开始啦']);
  if (hour >= 11 && hour < 14) return pick(['中午好~ 吃饭了吗?', '午安! 适合听一首歌的时间 ♪']);
  if (hour >= 14 && hour < 18) return pick(['下午好~ 来杯茶慢慢逛吧', '午后时光最适合画画了 ✎']);
  if (hour >= 18 && hour < 23) return pick(['晚上好~ 今天过得怎么样?', 'こんばんは! 夜里歌声更清楚哦 ♪']);
  return pick(['夜深了…要注意休息哦', '还没睡呀? 那陪你待一会儿 ☽']);
}

const VARIANT_LINES: Record<string, string> = {
  terminal: '终端模式…有黑客的感觉! ▌',
  magazine: '杂志刊~ 记得逛逛我的美术馆哦 ✎',
  atlas: '地图集! 想去哪个角落?',
  stream: '生命信号流~ 一切都在跳动',
  workplace: '工作台! 画几何还是跑 MATLAB?',
  notebook: '笔记本最适合慢慢读了 ☕',
};

const IDLE_LINES = [
  '点我可以聊天哦~',
  '让我画一幅画吧? 在聊天里说「画一幅画」',
  '想听歌的话, 打开右下角的音乐 ♪',
  '跟小小的我玩捉迷藏? 说「捉迷藏」!',
  '留言板等你写一句话呢 ✎',
];

interface GuestQuote { name: string; message: string }

export function initLive2dLife(): () => void {
  let alive = true;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const after = (ms: number, fn: () => void) => {
    const t = setTimeout(() => { timers.delete(t); if (alive) fn(); }, ms);
    timers.add(t);
  };

  const onStage = () => document.body.classList.contains('mstage-on');
  const quiet = () => !live2dVisible() || onStage() || document.hidden;

  // ambient-line throttle: never chatter more than once per 9s
  let lastAmbient = 0;
  const ambient = (text: string, ms = 4200, priority = 7) => {
    const now = Date.now();
    if (quiet() || now - lastAmbient < 9000) return;
    lastAmbient = now;
    mascotSay(text, ms, priority);
  };

  // ── greeting: wait for the model, then say hello for the hour ──
  let greeted = false;
  const tryGreet = (attempt = 0) => {
    if (!alive || greeted) return;
    if (live2dVisible()) {
      greeted = true;
      mascotSay(greetingFor(new Date().getHours()), 5200, 10);
      playMotion('idle');
      return;
    }
    if (attempt < 40) after(600, () => tryGreet(attempt + 1));
  };
  tryGreet();

  // ── petting: enough cursor travel over the canvas = a stroke ──
  let petDist = 0;
  let petLast: { x: number; y: number } | null = null;
  let petCooldownUntil = 0;
  const onPetMove = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target || !target.closest('#waifu-canvas')) { petLast = null; return; }
    if (petLast) petDist += Math.hypot(e.clientX - petLast.x, e.clientY - petLast.y);
    petLast = { x: e.clientX, y: e.clientY };
    if (petDist > 650 && Date.now() > petCooldownUntil) {
      petDist = 0;
      petCooldownUntil = Date.now() + 30_000;
      playExpression();
      playMotion('null');
      mascotSay(pick(['哇、好痒~ ///', '摸头可以, 头发不要乱啦!', 'えへへ…再摸一下也行']), 3600, 9);
    }
    if (petDist > 2000) petDist = 0; // slow strokes decay eventually
  };

  // ── variant commentary ──
  const onVariant = (e: Event) => {
    const v = ((e as CustomEvent).detail?.variant as string) ?? '';
    const line = VARIANT_LINES[v];
    if (line) { ambient(line, 4200, 8); playMotion('idle'); }
  };

  // ── NetEase: announce tracks + sing along (LRC-timed lip-sync) ──
  let lyrics: Array<{ time: number; text: string }> = [];
  let musicPlaying = false;
  let lastTrackId = 0;
  let lyricIdx = -1;
  let lyricsSince = 0;
  const onNowPlaying = (e: Event) => {
    const d = (e as CustomEvent).detail as { id?: number; title?: string; artist?: string; lyrics?: Array<{ time: number; text: string }>; playing?: boolean } | undefined;
    if (!d) return;
    musicPlaying = !!d.playing;
    if (Array.isArray(d.lyrics) && d.lyrics.length) lyrics = d.lyrics;
    if (d.playing && d.id && d.id !== lastTrackId && d.title) {
      lastTrackId = d.id;
      lyricIdx = -1;
      lyricsSince = 0;
      ambient(`♪ ${d.title} — ${d.artist ?? ''}`, 4600, 8);
      playMotion('idle');
    }
    if (!d.playing) stopLipSync();
  };
  const onTime = (e: Event) => {
    if (!musicPlaying || quiet() || !lyrics.length) return;
    const t = ((e as CustomEvent).detail?.time as number) ?? 0;
    let idx = -1;
    for (let i = 0; i < lyrics.length && lyrics[i].time <= t; i++) idx = i;
    if (idx === lyricIdx || idx < 0) return;
    lyricIdx = idx;
    // she mouths every line; every third line gets a small lyric bubble
    const lineDur = (lyrics[idx + 1]?.time ?? lyrics[idx].time + 4) - lyrics[idx].time;
    startLipSync();
    after(Math.min(Math.max(lineDur * 1000, 800), 6000), stopLipSync);
    lyricsSince += 1;
    if (lyricsSince % 3 === 0 && lyrics[idx].text.trim()) {
      ambient(`♪ ${lyrics[idx].text.trim()}`, 3400, 7);
    }
  };

  // ── message-board host ──
  const onGuestPosted = (e: Event) => {
    const d = (e as CustomEvent).detail as { name?: string; message?: string } | undefined;
    if (!d?.name) return;
    playMotion('null');
    playExpression();
    // direct reaction — bypasses the ambient throttle on purpose
    mascotSay(mikuBoardReply(d.message ?? '', d.name), 6000, 10);
    lastAmbient = Date.now();
  };

  // idle chatter sometimes reads the wall
  let guestCache: GuestQuote[] = [];
  let guestFetchedAt = 0;
  const refreshGuests = async () => {
    if (Date.now() - guestFetchedAt < 300_000) return;
    guestFetchedAt = Date.now();
    try {
      const r = await fetch('/api/guestbook');
      const j = await r.json() as { data?: GuestQuote[] };
      if (Array.isArray(j.data)) guestCache = j.data.slice(0, 12);
    } catch { /* wall stays unread */ }
  };
  const idleTimer = setInterval(() => {
    if (!alive || quiet() || Math.random() > 0.4) return;
    if (guestCache.length && Math.random() < 0.35) {
      const g = pick(guestCache);
      const text = g.message.length > 34 ? `${g.message.slice(0, 34)}…` : g.message;
      ambient(`留言板上 ${g.name} 说:「${text}」`, 5200, 7);
    } else {
      ambient(pick(IDLE_LINES), 4200, 7);
      if (Math.random() < 0.4) playMotion('idle');
    }
    void refreshGuests();
  }, 48_000);
  void refreshGuests();

  // ── bottom-of-page nudge → the guestbook ──
  let nudgedAt = 0;
  const onScroll = () => {
    const el = document.documentElement;
    const ratio = (window.scrollY + window.innerHeight) / Math.max(1, el.scrollHeight);
    if (ratio > 0.97 && Date.now() - nudgedAt > 180_000) {
      nudgedAt = Date.now();
      ambient('看到底啦~ 在留言板写一句话再走嘛 ✎', 5200, 8);
    }
  };

  window.addEventListener('mousemove', onPetMove, { passive: true });
  window.addEventListener('mola:variant', onVariant);
  window.addEventListener('mola:now-playing', onNowPlaying);
  window.addEventListener('mola:time-update', onTime);
  window.addEventListener('mola:guest-posted', onGuestPosted);
  window.addEventListener('scroll', onScroll, { passive: true });

  return () => {
    alive = false;
    timers.forEach(clearTimeout);
    clearInterval(idleTimer);
    stopLipSync();
    window.removeEventListener('mousemove', onPetMove);
    window.removeEventListener('mola:variant', onVariant);
    window.removeEventListener('mola:now-playing', onNowPlaying);
    window.removeEventListener('mola:time-update', onTime);
    window.removeEventListener('mola:guest-posted', onGuestPosted);
    window.removeEventListener('scroll', onScroll);
  };
}
