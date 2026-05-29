import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import RedesignRoot from '@/components/redesign/root';

// Redesign CSS — order matters: tokens first, then animations/opening/tweaks
// overlays, then per-variant rules. Body-scoped via the `redesign-on` class
// applied by RedesignRoot on mount so other routes are unaffected.
import '../redesign-styles/01-base.css';
import '../redesign-styles/02-animations.css';
import '../redesign-styles/03-opening.css';
import '../redesign-styles/04-customer-tweaks.css';
import '../redesign-styles/05-v-terminal.css';
import '../redesign-styles/06-v-magazine.css';
import '../redesign-styles/07-v-atlas.css';
import '../redesign-styles/08-v-stream.css';
import '../redesign-styles/09-astrbot.css';
import '../redesign-styles/10-v-workplace.css';
import '../redesign-styles/11-v-notebook.css';

export const dynamic = 'force-dynamic';

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as 'en' | 'zh')) notFound();
  return <RedesignRoot initialLocale={locale as 'en' | 'zh'} />;
}
