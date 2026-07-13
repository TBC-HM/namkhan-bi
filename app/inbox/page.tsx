// app/inbox/page.tsx
// PBS 2026-07-13 — Personal Gmail inbox page.
// Full-width UnifiedMailInbox primitive, single "personal" mailbox card representing
// the connected user's own inbox (pb@thenamkhan.com). Reuses the same primitive as
// /sales/mails but with a single mailbox row instead of aliases.
import { redirect } from 'next/navigation';
import { DashboardPage } from '@/app/(cockpit)/_design';
import UnifiedMailInbox, {
  type Thread,
  type MailboxSummary,
} from '@/app/(cockpit)/_design/UnifiedMailInbox';
import { getCurrentAuthUser, refreshIfExpired, listInboxMessages } from '@/lib/userGmail';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const FOREST = '#084838';
const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const CREAM  = '#F5F0E1';

export default async function InboxPage() {
  const user = await getCurrentAuthUser();
  if (!user) redirect('/login?next=/inbox');

  // Check connection state via bridge view (no tokens exposed).
  const sb = getSupabaseAdmin();
  const { data: conn } = await sb
    .from('v_user_gmail_connections')
    .select('gmail_address,active')
    .eq('user_id', user.id)
    .eq('active', true)
    .maybeSingle();

  if (!conn) {
    return (
      <DashboardPage title="Inbox" subtitle="Personal Gmail — connect first">
        <div style={{ gridColumn: '1 / -1', padding: 20, background: CREAM, border: `1px solid ${HAIR}`, borderRadius: 6 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: INK, marginBottom: 6 }}>Connect your Gmail first</div>
          <div style={{ fontSize: 12, color: INK_M, marginBottom: 14 }}>Only @thenamkhan.com accounts can connect.</div>
          <a href="/settings/gmail?next=/inbox" style={{ padding: '8px 14px', background: FOREST, color: WHITE, borderRadius: 4, fontSize: 12, fontWeight: 600, textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Connect Gmail →</a>
        </div>
      </DashboardPage>
    );
  }

  // Get a fresh access token + fetch last 30 messages (unread + read mixed).
  let threads: Thread[] = [];
  let fetchErr: string | null = null;
  try {
    const { access } = await refreshIfExpired(user.id);
    const msgs = await listInboxMessages(access, 'all', 30);
    threads = msgs.map((m) => ({
      mailbox_id:      'personal',
      mailbox_address: conn.gmail_address ?? user.email,
      label:           'Inbox',
      badge_color:     FOREST,
      id:              m.id,
      threadId:        m.threadId,
      from:            m.from ?? '',
      to:              conn.gmail_address ?? user.email,
      subject:         m.subject ?? '(no subject)',
      snippet:         m.snippet ?? '',
      date:            m.date ?? '',
      dateMs:          m.date ? (Date.parse(m.date) || 0) : 0,
      unread:          !!m.unread,
      starred:         false,
    }));
  } catch (e) {
    fetchErr = e instanceof Error ? e.message : 'inbox_fetch_failed';
  }

  const mailboxes: MailboxSummary[] = [
    { id: 'personal', mailbox_address: conn.gmail_address ?? user.email, label: 'Inbox', badge_color: FOREST, sort_order: 0, active: true },
  ];

  return (
    <DashboardPage title="Inbox" subtitle={conn.gmail_address ?? user.email}>
      {fetchErr && (
        <div style={{ gridColumn: '1 / -1', padding: '10px 14px', background: '#FBE8E4', border: '1px solid #E8B7AB', borderRadius: 4, fontSize: 12, color: '#B03826' }}>
          <strong>Inbox fetch failed:</strong> {fetchErr}
        </div>
      )}
      <UnifiedMailInbox initialThreads={threads} mailboxes={mailboxes} defaultMailboxId="personal" />
    </DashboardPage>
  );
}
