// app/mail/page.tsx
// Full-screen mail client — server shell.
// PBS 2026-07-14: "i want a proffesionalfull screen mailbox not the pop up".
// Gmail/Superhuman-class 3-pane layout under /mail. If the user has not
// connected their Gmail yet, we render a centered CTA with the OAuth link.
// PBS 2026-07-16 · Item 3 — pass CurrentUser so MailClient can mount the
// top-right UserMenu overlay (Inbox/Settings/Sign-out/Analytics for admins).
import { redirect } from 'next/navigation';
import { getCurrentAuthUser, buildUserAuthUrl } from '@/lib/userGmail';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getCurrentUser } from '@/lib/currentUser';
import MailClient from './_client/MailClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const FOREST = '#084838';
const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const CREAM  = '#F5F0E1';

export default async function MailPage() {
  const user = await getCurrentAuthUser();
  if (!user) redirect('/login?next=/mail');

  const sb = getSupabaseAdmin();
  const { data: conn } = await sb
    .from('v_user_gmail_connections')
    .select('gmail_address,active')
    .eq('user_id', user.id)
    .eq('active', true)
    .maybeSingle();

  if (!conn || !conn.active) {
    const authUrl = await buildUserAuthUrl(user.id);
    return (
      <div style={{
        minHeight: '100vh', background: WHITE, color: INK,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}>
        <div style={{
          width: 480, background: WHITE, border: '1px solid ' + HAIR, borderRadius: 8,
          padding: 28, display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: INK }}>Connect your Gmail</div>
          <div style={{ fontSize: 13, color: INK_M, lineHeight: 1.55 }}>
            The full mailbox needs read + modify + send permission on your
            @thenamkhan.com Gmail account. You&apos;ll be redirected to Google
            to grant access, then bounced back here.
          </div>
          <a
            href={authUrl}
            style={{
              alignSelf: 'flex-start', background: FOREST, color: WHITE,
              padding: '10px 18px', borderRadius: 6, textDecoration: 'none',
              fontSize: 13, fontWeight: 600, letterSpacing: '.02em',
            }}
          >
            Connect Gmail
          </a>
          <div style={{ fontSize: 11, color: INK_M, background: CREAM, border: '1px solid ' + HAIR, borderRadius: 4, padding: 10 }}>
            Signed in as {user.email}
          </div>
        </div>
      </div>
    );
  }

  // Load CurrentUser (from cockpit_users / app_users) so MailClient can render
  // the top-right UserMenu overlay. Falls back to a derived shape on miss so
  // the mailbox never blocks on the lookup.
  let currentUser;
  try {
    currentUser = await getCurrentUser();
  } catch {
    const local = (user.email || 'user').split('@')[0];
    currentUser = {
      id: user.id,
      email: user.email,
      display_name: local,
      role: 'staff' as const,
      initials: local.slice(0, 2).toUpperCase(),
    };
  }

  return (
    <div style={{ height: '100vh', overflow: 'hidden', background: WHITE }}>
      <MailClient
        userId={user.id}
        userEmail={conn.gmail_address ?? user.email}
        currentUser={currentUser}
      />
    </div>
  );
}
