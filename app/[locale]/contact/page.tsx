import type { Metadata } from 'next';
import NavWrapper from '@/components/nav-wrapper';
import Footer from '@/components/footer';
import Contact from '@/components/contact';

export const metadata: Metadata = { title: 'Contact — molamaker' };

export default function ContactPage() {
  return (
    <>
      <NavWrapper />
      <main>
        <Contact />
      </main>
      <Footer />
    </>
  );
}
