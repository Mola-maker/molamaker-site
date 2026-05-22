import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import NavWrapper from '@/components/nav-wrapper';
import Footer from '@/components/footer';
import JourneyExperience from '@/components/journey/journey-experience';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'journey — molamaker',
    description: 'A scroll-driven timeline of my learning journey.',
  };
}

export default async function JourneyPage() {
  const t = await getTranslations();

  return (
    <>
      <NavWrapper />
      <main>
        <JourneyExperience />
      </main>
      <Footer />
    </>
  );
}
