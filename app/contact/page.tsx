import type { Metadata } from 'next';
import Nav from '@/components/nav';
import Footer from '@/components/footer';
import Contact from '@/components/contact';

export const metadata: Metadata = { title: 'Contact — molamaker' };

export default function ContactPage() {
  return (
    <>
      <Nav />
      <main>
        <Contact />
      </main>
      <Footer />
    </>
  );
}
