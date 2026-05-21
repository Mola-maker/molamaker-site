import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import NavWrapper from '@/components/nav-wrapper';
import Footer from '@/components/footer';
import ChatRoom from '@/components/chat/chat-room';

export const metadata: Metadata = { title: 'Chat — molamaker' };

export default async function ChatPage() {
  const t = await getTranslations('chat');

  return (
    <>
      <NavWrapper />
      <main>
        <section>
          <div className="label">{t('label')}</div>
          <h2>{t('title')}</h2>
          <p className="lead" style={{ marginBottom: 32 }}>
            {t('lead')}
          </p>
          <ChatRoom />
        </section>
      </main>
      <Footer />
    </>
  );
}
