'use client';

// Root — orchestrates variants, locale, tweaks. Ported from root.jsx.
// Mounted by app/[locale]/page.tsx as a single client component beneath
// the next-intl locale layout.

import { useEffect, useLayoutEffect, useState } from 'react';
import { useRouter, usePathname } from '@/i18n/routing';
import { molaData, type Locale, type Post, type Guest, type Repo } from './data';
import { assetUrl } from '@/lib/asset-url';
import { Cursor } from './cursor';
import { Opening2, MikuTransition } from './opening';
import { TopNav, VariantRail, Footer, Marquee, BrandChatModal } from './chrome';
import { VTerminal } from './v-terminal';
import { VMagazine } from './v-magazine';
import { VAtlas } from './v-atlas';
import { VStream } from './v-stream';
import { VWorkplace } from './v-workplace';
import { VNotebook } from './v-notebook';
import { MusicPlayer } from './music-player';
import { MikuHub } from './miku-hub';
import { MikuFairy } from './miku-fairy';
import { MikuStage } from './miku-stage';
import { MikuRhythm } from './miku-rhythm';
import { Live2DChat } from './live2d-chat';
import {
  TweaksPanel,
  TweakSection,
  TweakRadio,
  TweakSelect,
  TweakColor,
  TweakSlider,
  TweakToggle,
  TweakButton,
  useTweaks,
} from './tweaks';

type Variant = 'terminal' | 'magazine' | 'atlas' | 'stream' | 'workplace' | 'notebook';

type Tweaks = {
  variant: Variant;
  locale: Locale;
  accent: string;
  cursor: boolean;
  opening: boolean;
  displayFont: string;
  monoFont: string;
  grain: boolean;
  atlasBg: string;
  atlasBgOpacity: number;
  dynamicWords: boolean;
  backdropBg: string;
  backdropOpacity: number;
  darkMode: boolean;
  mikuFairy: boolean;
};

const TWEAK_DEFAULTS: Tweaks = {
  variant: 'terminal',
  locale: 'en',
  accent: '#C96442',
  cursor: true,
  opening: true,
  displayFont: 'Newsreader',
  monoFont: 'JetBrains Mono',
  grain: true,
  atlasBg: assetUrl('/redesign/miku-bg-orbit.gif'),
  atlasBgOpacity: 0.2,
  dynamicWords: true,
  backdropBg: assetUrl('/redesign/miku-bg-2.gif'),
  backdropOpacity: 0.14,
  darkMode: false,
  mikuFairy: true,
};

function variantLabel(v: string) {
  return ({ terminal: 'no. 01', magazine: 'no. 02', atlas: 'no. 03', stream: 'no. 04', workplace: 'no. 05', notebook: 'no. 06' } as Record<string, string>)[v] || v;
}

type RootProps = { initialLocale: Locale };

export default function RedesignRoot({ initialLocale }: RootProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [tweaks, setTweak] = useTweaks<Tweaks>({ ...TWEAK_DEFAULTS, locale: initialLocale });
  // Both server and client start with the same value to avoid hydration mismatch.
  // useLayoutEffect then checks sessionStorage before the first browser paint,
  // so return visitors never see the opening scene flash.
  const [opened, setOpened] = useState(!tweaks.opening);
  useLayoutEffect(() => {
    if (!tweaks.opening) return;
    try {
      if (sessionStorage.getItem('mola:opened') === '1') setOpened(true);
    } catch { /* ignore */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [variant, setVariant] = useState<Variant>(tweaks.variant || 'terminal');
  const [locale, setLocale] = useState<Locale>(tweaks.locale || initialLocale);
  // WeChat OAuth (and shareable deep links) redirect back to `/?variant=workplace`.
  // Honor that hint once on mount so the dashboard opens directly.
  useLayoutEffect(() => {
    try {
      const v = new URLSearchParams(window.location.search).get('variant');
      const valid: Variant[] = ['terminal', 'magazine', 'atlas', 'stream', 'workplace', 'notebook'];
      if (v && valid.includes(v as Variant) && v !== tweaks.variant) {
        setVariant(v as Variant);
        setTweak('variant', v as Variant);
      }
    } catch { /* ignore */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [transitionFor, setTransitionFor] = useState<Variant | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [localeFlashing, setLocaleFlashing] = useState(false);
  const [livePosts, setLivePosts] = useState<Post[] | null>(null);
  const [liveGuests, setLiveGuests] = useState<Guest[] | null>(null);
  const [liveRepos, setLiveRepos] = useState<Repo[] | null>(null);
  const i18n = molaData.i18n[locale];

  useEffect(() => {
    fetch('/api/posts').then((r) => r.json()).then((j) => j.data && setLivePosts(j.data)).catch(() => {});
    fetch('/api/guestbook').then((r) => r.json()).then((j) => j.data && setLiveGuests(j.data)).catch(() => {});
    fetch('/api/github').then((r) => r.json()).then((j) => j.data && setLiveRepos(j.data)).catch(() => {});
  }, []);

  useEffect(() => {
    document.body.classList.add('redesign-on');
    return () => document.body.classList.remove('redesign-on');
  }, []);

  useEffect(() => {
    if (tweaks.variant && tweaks.variant !== variant) setVariant(tweaks.variant);
    if (tweaks.locale && tweaks.locale !== locale) setLocale(tweaks.locale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tweaks.variant, tweaks.locale]);

  const changeVariant = (v: string) => {
    const next = v as Variant;
    if (next === variant) return;
    setTransitioning(true);
    setTransitionFor(next);
    setTimeout(() => {
      setVariant(next);
      setTweak('variant', next);
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }, 550);
    setTimeout(() => {
      setTransitioning(false);
      setTransitionFor(null);
    }, 1200);
  };

  const changeLocale = (l: string) => {
    const next = l as Locale;
    setLocale(next);
    setTweak('locale', next);
    setLocaleFlashing(true);
    setTimeout(() => setLocaleFlashing(false), 600);
    router.replace(pathname, { locale: next });
  };

  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--accent', tweaks.accent);
    r.style.setProperty('--font-display', `'${tweaks.displayFont}', 'Fraunces', Georgia, serif`);
    r.style.setProperty('--font-mono', `'${tweaks.monoFont}', 'SF Mono', Menlo, monospace`);
    r.style.setProperty('--miku-bg', `url("${tweaks.backdropBg}")`);
    r.style.setProperty('--miku-bg-opacity', String(tweaks.backdropOpacity));
    document.body.style.cursor = tweaks.cursor ? 'none' : 'auto';
    document.body.dataset.grain = tweaks.grain ? '1' : '0';
    document.body.dataset.dyn = tweaks.dynamicWords ? '1' : '0';
    if (tweaks.darkMode) {
      document.body.classList.add('ink-mode');
    } else {
      document.body.classList.remove('ink-mode');
    }
  }, [
    tweaks.accent,
    tweaks.displayFont,
    tweaks.monoFont,
    tweaks.cursor,
    tweaks.grain,
    tweaks.dynamicWords,
    tweaks.backdropBg,
    tweaks.backdropOpacity,
    tweaks.darkMode,
  ]);

  return (
    <>
      {tweaks.opening && !opened && <Opening2 onDone={() => { try { sessionStorage.setItem('mola:opened', '1'); } catch { /* storage disabled */ } setOpened(true); }} />}
      {tweaks.cursor && <Cursor />}

      <TopNav locale={locale} onLocale={changeLocale} t={i18n} />
      <BrandChatModal locale={locale} t={i18n} />

      <div className={`variant-stage ${transitioning ? 'is-out' : 'is-in'}${localeFlashing ? ' locale-flash' : ''}`}>
        {variant === 'terminal' && <VTerminal t={i18n} locale={locale} posts={livePosts ?? undefined} repos={liveRepos ?? undefined} guestbook={liveGuests ?? undefined} />}
        {variant === 'magazine' && <VMagazine t={i18n} locale={locale} posts={livePosts ?? undefined} />}
        {variant === 'atlas' && (
          <VAtlas t={i18n} locale={locale} bgOpacity={tweaks.atlasBgOpacity} bgSrc={tweaks.atlasBg}
            posts={livePosts ?? undefined} guestbook={liveGuests ?? undefined} repos={liveRepos ?? undefined} />
        )}
        {variant === 'stream' && <VStream t={i18n} locale={locale} />}
        {variant === 'workplace' && <VWorkplace />}
        {variant === 'notebook' && <VNotebook t={i18n} locale={locale} posts={livePosts ?? undefined} guestbook={liveGuests ?? undefined} />}
      </div>

      {transitionFor && <MikuTransition variant={transitionFor} label={variantLabel(transitionFor)} />}

      <Marquee
        items={[
          'orchestrating agents',
          'cuda · kernel notes',
          'guestbook open',
          'now playing: Polite Conversation',
          `visitor #${molaData.visitor.toLocaleString()}`,
          'hangzhou · 23° · light haze',
          'newsreader / jetbrains mono',
          'made by hand on a quiet desk',
        ]}
      />

      <Footer t={i18n} />

      <VariantRail value={variant} onChange={changeVariant} />

      {/* Unified bottom-right control hub: one Miku button → chat; hover springs
          out tweak · music · 看板娘 satellites. Panels below listen for events. */}
      <MusicPlayer hideTrigger />
      {/* The Live2D 看板娘 is the lead performer — load on every variant so
          chat reactions, lip-sync and stage scenes always have their star. */}
      <Live2DChat autoLoad />
      <MikuHub />
      {/* Wandering chibi Miku — walks the bars, hides behind headlines, swims
          the blank zones, and acts out [miku:…] stage directions from chat. */}
      {opened && <MikuFairy enabled={tweaks.mikuFairy} />}
      {/* Fullscreen cinematic scenes (concert / fireworks / sakura / stars /
          snow / confetti) directed by the LLM or typed commands. */}
      {opened && <MikuStage />}
      {opened && <MikuRhythm />}

      <TweaksPanel title="Tweaks">
        <TweakSection label="Composition">
          <TweakRadio
            label="Variant"
            value={variant}
            onChange={changeVariant}
            options={[
              { value: 'terminal', label: 'Terminal' },
              { value: 'magazine', label: 'Magazine' },
              { value: 'atlas', label: 'Atlas' },
              { value: 'stream', label: 'Stream' },
              { value: 'workplace', label: 'Workplace' },
              { value: 'notebook', label: 'Notebook' },
            ]}
          />
          <TweakRadio
            label="Language"
            value={locale}
            onChange={changeLocale}
            options={[
              { value: 'en', label: 'English' },
              { value: 'zh', label: '中文' },
            ]}
          />
        </TweakSection>
        <TweakSection label="Type">
          <TweakSelect
            label="Display"
            value={tweaks.displayFont}
            onChange={(v) => setTweak('displayFont', v)}
            options={[
              { value: 'Newsreader', label: 'Newsreader' },
              { value: 'Fraunces', label: 'Fraunces' },
              { value: 'Instrument Serif', label: 'Instrument Serif' },
              { value: 'EB Garamond', label: 'EB Garamond' },
              { value: 'Source Serif 4', label: 'Source Serif 4' },
            ]}
          />
          <TweakSelect
            label="Mono"
            value={tweaks.monoFont}
            onChange={(v) => setTweak('monoFont', v)}
            options={[
              { value: 'JetBrains Mono', label: 'JetBrains Mono' },
              { value: 'Fira Code', label: 'Fira Code' },
              { value: 'IBM Plex Mono', label: 'IBM Plex Mono' },
              { value: 'Geist Mono', label: 'Geist Mono' },
              { value: 'Space Mono', label: 'Space Mono' },
            ]}
          />
        </TweakSection>
        <TweakSection label="Color">
          <TweakColor
            label="Accent"
            value={tweaks.accent}
            onChange={(v) => setTweak('accent', v)}
            options={['#C96442', '#A04E30', '#3E7C5F', '#5E6B8C', '#8A5A3B', '#B43E3E']}
          />
        </TweakSection>
        <TweakSection label="Quick links">
          <TweakButton label="AstrBot · open web UI ↗" onClick={() => window.open('https://astrbot.app/', '_blank')} />
          <TweakButton
            label="GitHub: AstrBot ↗"
            onClick={() => window.open('https://github.com/Soulter/AstrBot', '_blank')}
          />
          <TweakButton label="▶ Replay opening" onClick={() => { sessionStorage.removeItem('mola:opened'); setOpened(false); }} />
          <TweakButton label="↺ Reset atlas zones" onClick={() => window.dispatchEvent(new CustomEvent('atlas:reset'))} />
          <TweakButton label="🎲 Shuffle Miku gestures" onClick={() => window.dispatchEvent(new CustomEvent('miku:shuffle'))} />
          <TweakButton label="🎤 Miku · stage live!" onClick={() => window.dispatchEvent(new CustomEvent('miku:scene', { detail: { scene: 'concert' } }))} />
        </TweakSection>
        <TweakSection label="Atlas">
          <TweakSelect
            label="Background"
            value={tweaks.atlasBg}
            onChange={(v) => setTweak('atlasBg', v)}
            options={[
              { value: assetUrl('/redesign/miku-bg-orbit.gif'), label: 'Miku · orbit' },
              { value: assetUrl('/redesign/miku-bg-2.gif'), label: 'Miku · neon' },
              { value: assetUrl('/redesign/miku-bg-3.gif'), label: 'Miku · summer' },
              { value: assetUrl('/redesign/miku-dance.gif'), label: 'Miku · dance' },
              { value: '', label: 'None' },
            ]}
          />
          <TweakSlider
            label="BG transparency"
            value={tweaks.atlasBgOpacity}
            min={0}
            max={0.85}
            step={0.05}
            onChange={(v) => setTweak('atlasBgOpacity', v)}
          />
        </TweakSection>
        <TweakSection label="Shared backdrop">
          <TweakSelect
            label="Page backdrop"
            value={tweaks.backdropBg}
            onChange={(v) => setTweak('backdropBg', v)}
            options={[
              { value: assetUrl('/redesign/miku-bg-orbit.gif'), label: 'Miku · orbit' },
              { value: assetUrl('/redesign/miku-bg-2.gif'), label: 'Miku · neon' },
              { value: assetUrl('/redesign/miku-bg-3.gif'), label: 'Miku · summer' },
              { value: assetUrl('/redesign/miku-dance.gif'), label: 'Miku · dance' },
              { value: assetUrl('/redesign/miku-redial-cover.jpg'), label: 'Miku · redial' },
              { value: '', label: 'None' },
            ]}
          />
          <TweakSlider
            label="Backdrop opacity"
            value={tweaks.backdropOpacity}
            min={0}
            max={0.6}
            step={0.02}
            onChange={(v) => setTweak('backdropOpacity', v)}
          />
        </TweakSection>
        <TweakSection label="Dynamic words">
          <TweakToggle label="Hover-animated text" value={tweaks.dynamicWords} onChange={(v) => setTweak('dynamicWords', v)} />
        </TweakSection>
        <TweakSection label="Motion">
          <TweakToggle label="Miku fairy companion" value={tweaks.mikuFairy} onChange={(v) => setTweak('mikuFairy', v)} />
          <TweakToggle label="Custom cursor" value={tweaks.cursor} onChange={(v) => setTweak('cursor', v)} />
          <TweakToggle label="Opening sequence" value={tweaks.opening} onChange={(v) => setTweak('opening', v)} />
          <TweakToggle label="Paper grain" value={tweaks.grain} onChange={(v) => setTweak('grain', v)} />
        </TweakSection>
        <TweakSection label="Theme">
          <TweakToggle label="Ink (dark) mode" value={tweaks.darkMode} onChange={(v) => setTweak('darkMode', v)} />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}
