// app/mail/automations/page.tsx
// PBS 2026-07-15: placeholder for the mail-automations page (rules engine).
// The full mailbox rewrite (#186) surfaces the entry point in the left-rail
// Settings section. Building out a real rules engine is out-of-scope for v1
// of the modern-mailbox task; this stub tells the user what's coming and
// links back to /mail.
//
// Design tokens hardcoded per Namkhan paper-white palette (var(--paper-warm)
// resolves to invisible dark on this tenant — see feedback_namkhan_token_ladder_paper_warm_dark.md).

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentAuthUser } from '@/lib/userGmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FOREST = '#084838';
const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const CREAM  = '#F5F0E1';

export default async function MailAutomationsPage() {
  const user = await getCurrentAuthUser();
  if (!user) redirect('/login?next=/mail/automations');

  return (
    <div style={{ minHeight: '100vh', background: WHITE, color: INK, padding: '32px 24px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link
            href="/mail"
            style={{ fontSize: 12, color: FOREST, textDecoration: 'none', border: '1px solid ' + HAIR, borderRadius: 4, padding: '4px 10px', background: WHITE }}
          >← Mail</Link>
          <div style={{ fontSize: 20, fontWeight: 700, color: INK }}>Automations</div>
        </div>

        <div style={{ background: WHITE, border: '1px solid ' + HAIR, borderRadius: 8, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: INK }}>Coming soon — rules engine</div>
          <div style={{ fontSize: 13, color: INK_M, lineHeight: 1.55 }}>
            Auto-label / auto-archive / auto-forward rules based on sender,
            subject, or List-Unsubscribe header are on the way. Until then,
            use Gmail&apos;s built-in filters at{' '}
            <a href="https://mail.google.com/mail/u/0/#settings/filters" target="_blank" rel="noopener noreferrer" style={{ color: FOREST, textDecoration: 'underline' }}>
              mail.google.com → Settings → Filters
            </a>. They apply the same way once your Gmail is connected here.
          </div>

          <div style={{ background: CREAM, border: '1px solid ' + HAIR, borderRadius: 6, padding: 12, fontSize: 12, color: INK_M, lineHeight: 1.5 }}>
            <strong style={{ color: INK }}>Planned v2 features:</strong>
            <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
              <li>Rule builder: WHEN sender/subject/header matches THEN label/archive/forward</li>
              <li>Bulk-apply rules to existing mail</li>
              <li>Sender allow-list / block-list</li>
              <li>Auto-reply templates by keyword</li>
            </ul>
          </div>
        </div>

        <div style={{ fontSize: 11, color: INK_M }}>Signed in as {user.email}</div>
      </div>
    </div>
  );
}
