import { createClient } from '@/lib/supabase/server';
import Nav from './nav';

/**
 * Server wrapper that checks if the current user is the site owner and
 * passes an `isOwner` prop to Nav so it can show the admin link.
 *
 * Auth check is fire-and-forget — if it fails, Nav renders without the
 * admin link (no redirect, no error boundary).
 */
export default async function NavWrapper() {
  let isOwner = false;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    isOwner = !!(user && user.email === process.env.OWNER_EMAIL);
  } catch {
    /* auth check is optional — silently degrade */
  }

  return <Nav isOwner={isOwner} />;
}
