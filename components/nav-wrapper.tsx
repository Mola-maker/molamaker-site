import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import Nav from './nav';

const getIsOwner = cache(async () => {
  try {
    const supabase = await createClient();
    if (!supabase) return false;
    const { data: { user } } = await supabase.auth.getUser();
    return !!(user && user.email === process.env.OWNER_EMAIL);
  } catch {
    return false;
  }
});

export default async function NavWrapper() {
  const isOwner = await getIsOwner();
  return <Nav isOwner={isOwner} />;
}
