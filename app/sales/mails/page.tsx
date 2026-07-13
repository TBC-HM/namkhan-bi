// app/sales/mails/page.tsx
// Sales · Mails — unified shared-mailbox inbox (filter mode).
// PBS 2026-07-13 pivot:
//   - Guard 1: user must be signed in.
//   - Guard 2: user must have connected their PERSONAL Gmail
//     (marketing.user_gmail_connections). If not → CREAM banner + Connect
//     Gmail link to /settings/gmail.
//   - Guard 3: at least one shared alias must be registered. If not →
//     CREAM banner + inline Add-alias form.
//   - When both are good → hydrate <UnifiedMailInbox/>.

import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import UnifiedMailInbox, { type Thread, type MailboxSummary } from '@/app/(cockpit)/_design/UnifiedMailInbox';
import { SALES_SUBPAGES } from '../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getCurrentAuthUser } from '@/lib/userGmail';
import { listActiveMailboxes, listSharedInbox } from '@/lib/sharedGmail';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface RowShape {
  id: string;
  mailbox_address: string;
  label: string;
  badge_color: string | null;
  sort_order: number | null;
  active: boolean;
}

const T = {
  WHITE: '#FFFFFF', HAIR: '#E6DFCC', INK: '#1B1B1B', INK_M: '#5A5A5A',
  FOREST: '#084838', CREAM: '#F5F0E1', RED: '#B03826',
};

const NEXT_HREF = '/sales/mails';
const CONNECT_GMAIL_HREF = '/settings/gmail?next=' + encodeURIComponent(NEXT_HREF);

export default async function SalesMailsPage({
  searchParams,
}: {
  searchParams?: { connected?: string; error?: string };
}) {
  const tabs = SALES_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/sales/mails',
  }));

  const user = await getCurrentAuthUser();

  // ---- guard 1: not signed in ----
  if (!user) {
    return (
      <DashboardPage title="Sales · Mails" tabs={tabs}>
        <div style={{ gridColumn: '1 / -1' }}>
          <Container title="Sign in required" density="compact">
            <div style={connectBannerStyle()}>
              <p style={{ margin: 0, fontSize: 13, color: T.INK }}>Sign in with your @thenamkhan.com Gmail to view the shared inboxes.</p>
              <a href={'/login?next=' + encodeURIComponent(NEXT_HREF)} style={forestBtn()}>Sign in →</a>
            </div>
          </Container>
        </div>
      </DashboardPage>
    );
  }

  // ---- guard 2: personal Gmail not connected ----
  const admin = getSupabaseAdmin();
  const { data: personalConn } = await admin
    .from('v_user_gmail_connections')
    .select('active')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!personalConn || !personalConn.active) {
    return (
      <DashboardPage title="Sales · Mails" tabs={tabs}>
        <div style={{ gridColumn: '1 / -1' }}>
          <Container title="Connect your Gmail" density="compact">
            <div style={connectBannerStyle()}>
              <p style={{ margin: 0, fontSize: 13, color: T.INK, lineHeight: 1.55 }}>
                Sales · Mails now uses your personal @thenamkhan.com Gmail token to read + send for the shared aliases
                (<strong>book</strong>, <strong>gm</strong>, <strong>reservations</strong>) via Gmail&apos;s <code>deliveredto:</code> filter and Send-As.
                Connect your Gmail once to unlock all three inboxes.
              </p>
              <a href={CONNECT_GMAIL_HREF} style={forestBtn()}>Connect Gmail →</a>
              <p style={{ margin: 0, fontSize: 11, color: T.INK_M }}>
                Also add each alias as a Send-As identity in your Gmail settings before you reply from it.
              </p>
            </div>
          </Container>
        </div>
      </DashboardPage>
    );
  }

  // ---- guard 3: no aliases registered ----
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

  if (mailboxes.length === 0) {
    return (
      <DashboardPage title="Sales · Mails" tabs={tabs}>
        <div style={{ gridColumn: '1 / -1' }}>
          <Container title="No mailbox aliases yet" density="compact">
            <div style={connectBannerStyle()}>
              <p style={{ margin: 0, fontSize: 13, color: T.INK, lineHeight: 1.55 }}>
                Register at least one shared alias (e.g. <code>book@thenamkhan.com</code>) to segment the unified inbox.
                Add it below or use the &quot;Manage aliases&quot; button on the inbox once one exists.
              </p>
              <AddAliasFormServer />
            </div>
          </Container>
        </div>
      </DashboardPage>
    );
  }

  // ---- all guards passed → hydrate the inbox ----
  let initialThreads: Thread[] = [];
  try {
    const list = await listActiveMailboxes();
    initialThreads = await listSharedInbox(user.id, list, { limit: 100 });
  } catch (e) {
    console.error('[sales/mails] initial hydrate failed', e);
  }

  return (
    <DashboardPage title="Sales · Mails" tabs={tabs}>
      {searchParams?.connected && (
        <div style={{ gridColumn: '1 / -1' }}>
          <Container title="Connected" density="compact">
            <div style={infoStripStyle(T.FOREST)}>Gmail connected · inbox will refresh momentarily.</div>
          </Container>
        </div>
      )}
      {searchParams?.error && (
        <div style={{ gridColumn: '1 / -1' }}>
          <Container title="Connect issue" density="compact">
            <div style={infoStripStyle(T.RED)}>Connect failed: {searchParams.error}</div>
          </Container>
        </div>
      )}
      <UnifiedMailInbox initialThreads={initialThreads} mailboxes={mailboxes} />
    </DashboardPage>
  );
}

// ---- helpers (server) ----------------------------------------------------

function connectBannerStyle(): React.CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    background: T.CREAM,
    border: '1px solid ' + T.HAIR,
    borderRadius: 8,
    padding: 16,
  };
}

function forestBtn(): React.CSSProperties {
  return {
    alignSelf: 'flex-start',
    background: T.FOREST,
    color: T.WHITE,
    padding: '8px 16px',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    textDecoration: 'none',
  };
}

function infoStripStyle(color: string): React.CSSProperties {
  return {
    background: T.CREAM,
    border: '1px solid ' + T.HAIR,
    borderRadius: 6,
    padding: 10,
    fontSize: 12,
    color,
  };
}

// Note: this is a server island. The actual form interactivity is delegated
// to a tiny client child (AddAliasFormClient) so we can keep the RSC boundary
// clean.
function AddAliasFormServer() {
  const AddAliasFormClient = require('./AddAliasForm').default;
  return <AddAliasFormClient />;
}
