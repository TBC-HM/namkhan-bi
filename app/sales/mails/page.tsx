// app/sales/mails/page.tsx
// Sales · Mails — unified shared-mailbox inbox.
// Server component. Hydrates <UnifiedMailInbox/> with the first 100 threads
// across every active shared mailbox. Renders a connect banner when no
// mailboxes are wired yet.

import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import UnifiedMailInbox, { type Thread, type MailboxSummary } from '@/app/(cockpit)/_design/UnifiedMailInbox';
import { SALES_SUBPAGES } from '../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { listInboxAcross } from '@/lib/sharedGmail';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Suggested mailboxes to pre-fill the connect banner. PBS can add more.
const SUGGESTED = [
  { addr: 'book@thenamkhan.com',         label: 'Booking',      color: '#084838' },
  { addr: 'gm@thenamkhan.com',           label: 'GM office',    color: '#3A3A3A' },
  { addr: 'reservations@thenamkhan.com', label: 'Reservations', color: '#B48A3A' },
];

interface RowShape {
  id: string;
  mailbox_address: string;
  label: string;
  badge_color: string | null;
  sort_order: number | null;
  active: boolean;
}

export default async function SalesMailsPage({
  searchParams,
}: {
  searchParams?: { connected?: string; error?: string };
}) {
  const admin = getSupabaseAdmin();

  const { data: rowsRaw } = await admin
    .from('v_shared_mailbox_connections')
    .select('id, mailbox_address, label, badge_color, sort_order, active')
    .eq('active', true)
    .order('sort_order', { ascending: true });

  const rows = (rowsRaw ?? []) as RowShape[];
  const mailboxes: MailboxSummary[] = rows.map((r) => ({
    id: r.id,
    mailbox_address: r.mailbox_address,
    label: r.label,
    badge_color: r.badge_color || '#084838',
    sort_order: r.sort_order ?? 100,
    active: r.active,
  }));

  const tabs = SALES_SUBPAGES.map((s) => ({
    key: s.href,
    label: s.label,
    href: s.href,
    active: s.href === '/sales/mails',
  }));

  // ---- N = 0 · empty state ----
  if (mailboxes.length === 0) {
    return (
      <DashboardPage title="Sales · Mails" tabs={tabs}>
        <div style={{ gridColumn: '1 / -1' }}>
          <Container title="No shared mailboxes connected yet" density="compact">
            <div style={{ background: '#F5F0E1', border: '1px solid #E6DFCC', borderRadius: 8, padding: 16 }}>
              <p style={{ margin: '0 0 12px 0', fontSize: 13, color: '#1B1B1B', lineHeight: 1.55 }}>
                The Sales · Mails cockpit unifies the shared inboxes for
                <strong> book@thenamkhan.com</strong>, <strong>gm@thenamkhan.com</strong>,
                <strong> reservations@thenamkhan.com</strong> and any other <em>@thenamkhan.com</em> shared mailboxes.
                Connect one below to get started.
              </p>
              {searchParams?.error && (
                <p style={{ margin: '0 0 12px 0', fontSize: 12, color: '#B03826' }}>
                  Connect failed: {searchParams.error}
                </p>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {SUGGESTED.map((s) => (
                  <a
                    key={s.addr}
                    href={'/api/sales/mails/connect?mailbox=' + encodeURIComponent(s.addr) + '&label=' + encodeURIComponent(s.label)}
                    style={{
                      background: s.color,
                      color: '#FFFFFF',
                      padding: '8px 14px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      textDecoration: 'none',
                    }}
                  >
                    Connect {s.label}
                  </a>
                ))}
              </div>
              <p style={{ margin: '12px 0 0 0', fontSize: 11, color: '#5A5A5A' }}>
                Only <code>@thenamkhan.com</code> addresses are accepted. Sign in as the shared mailbox on Google to grant access.
              </p>
            </div>
          </Container>
        </div>
      </DashboardPage>
    );
  }

  // ---- N > 0 · hydrate the inbox ----
  let initialThreads: Thread[] = [];
  try {
    initialThreads = await listInboxAcross({ limit: 100 });
  } catch (e) {
    console.error('[sales/mails] initial hydrate failed', e);
  }

  const connectHref = '/api/sales/mails/connect?mailbox=' +
    encodeURIComponent('book@thenamkhan.com') + '&label=' + encodeURIComponent('Booking');

  return (
    <DashboardPage title="Sales · Mails" tabs={tabs}>
      {searchParams?.connected && (
        <div style={{ gridColumn: '1 / -1' }}>
          <Container title="Mailbox connected" density="compact">
            <div style={{ background: '#F5F0E1', border: '1px solid #E6DFCC', borderRadius: 6, padding: 10, fontSize: 12, color: '#084838' }}>
              Connected {searchParams.connected} · inbox will refresh momentarily.
            </div>
          </Container>
        </div>
      )}
      {searchParams?.error && (
        <div style={{ gridColumn: '1 / -1' }}>
          <Container title="Connect issue" density="compact">
            <div style={{ background: '#F5F0E1', border: '1px solid #E6DFCC', borderRadius: 6, padding: 10, fontSize: 12, color: '#B03826' }}>
              Connect failed: {searchParams.error}
            </div>
          </Container>
        </div>
      )}
      <UnifiedMailInbox
        initialThreads={initialThreads}
        mailboxes={mailboxes}
        connectHref={connectHref}
      />
    </DashboardPage>
  );
}
