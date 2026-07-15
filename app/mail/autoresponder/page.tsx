// app/mail/autoresponder/page.tsx
// Vacation / auto-responder toggle. Server-rendered shell + client form.
// Persists to marketing.mail_autoresponders via fn_autoresponder_upsert /
// fn_autoresponder_delete (SECURITY DEFINER, auth.uid()-scoped).
// Reads via public.v_mail_autoresponder bridge view.
//
// PBS 2026-07-15 task #186 · sibling to /mail/analytics + /mail/automations.

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentAuthUser } from '@/lib/userGmail';
import AutoresponderForm from './AutoresponderForm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WHITE = '#FFFFFF';
const HAIR  = '#E6DFCC';
const INK   = '#1B1B1B';
const INK_M = '#5A5A5A';
const FOREST = '#084838';

export default async function MailAutoresponderPage() {
  const user = await getCurrentAuthUser();
  if (!user) redirect('/login?next=/mail/autoresponder');

  return (
    <div style={{ minHeight: '100vh', background: WHITE, color: INK, padding: '32px 24px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link
            href="/mail"
            style={{ fontSize: 12, color: FOREST, textDecoration: 'none', border: '1px solid ' + HAIR, borderRadius: 4, padding: '4px 10px', background: WHITE }}
          >← Mail</Link>
          <div style={{ fontSize: 20, fontWeight: 700, color: INK }}>Auto-responder</div>
        </div>

        <div style={{ fontSize: 12, color: INK_M, lineHeight: 1.5 }}>
          Set a vacation reply that goes out to anyone who emails{' '}
          <strong style={{ color: INK }}>{user.email}</strong> while active.
          Settings persist per signed-in user. Empty body = disabled even if
          the toggle is on.
        </div>

        <AutoresponderForm />

        <div style={{ fontSize: 11, color: INK_M }}>
          Note: this stores the settings but does not itself intercept mail — a
          scheduled edge function reads these rows and sends replies via each
          user&apos;s Gmail token.
        </div>
      </div>
    </div>
  );
}
