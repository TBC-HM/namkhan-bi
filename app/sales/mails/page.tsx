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
// PBS 2026-07-14 addition: header link → /mail (full-screen mailbox).
// PBS 2026-07-14 (TASK 2): per-alias diagnostic chip strip. When an alias
//   returns 0 messages after successful load, show muted subtitle + a small
//   "?" info tooltip explaining the Workspace routing fix. Errored aliases
//   render "error — reconnect".

import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import UnifiedMailInbox, { type Thread, type MailboxSummary } from '@/app/(cockpit)/_design/UnifiedMailInbox';
import { SALES_SUBPAGES } from '../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getCurrentAuthUser } from '@/lib/userGmail';
import { listActiveMailboxes, listSharedInbox } from '@/lib/sharedGmail';
import AddAliasForm from './AddAliasForm';
// PBS 2026-07-14 (Sales CRM upgrade) — companion panel + lead lookup below.
import MailToLeadPanel from './MailToLeadPanel';

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
  MUTED: '#8B7355', ERR: '#B84A2C',
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
              <a href={'/login?next=' + encodeURIComponent(NEXT_HREF)} style={forestBtn()}>Sign in</a>
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
              <a href={CONNECT_GMAIL_HREF} style={forestBtn()}>Connect Gmail</a>
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
              <AddAliasForm />
            </div>
          </Container>
        </div>
      </DashboardPage>
    );
  }

  // ---- all guards passed → hydrate the inbox ----
  let initialThreads: Thread[] = [];
  let hydrateErr: string | null = null;
  try {
    const list = await listActiveMailboxes();
    initialThreads = await listSharedInbox(user.id, list, { limit: 100 });
  } catch (e) {
    hydrateErr = e instanceof Error ? e.message : String(e);
    console.error('[sales/mails] initial hydrate failed', e);
  }

  const firstAliasSlug = mailboxes[0]?.mailbox_address?.split('@')[0] ?? '';
  const fullMailHref = firstAliasSlug ? '/mail?account=' + encodeURIComponent(firstAliasSlug) : '/mail';

  // PBS 2026-07-14 (Sales CRM upgrade) — precompute which threads already
  // have a lead so the companion panel can render "Open lead #N" instead of
  // "Convert to Lead" for known threads. One query, no per-row roundtrips.
  const threadIdList = Array.from(new Set(initialThreads.map((t) => t.threadId))).slice(0, 100);
  const linkedLeadByThreadId: Record<string, number> = {};
  if (threadIdList.length > 0) {
    const { data: leadsForThreads } = await admin
      .from('v_leads_full')
      .select('id, email_thread_id')
      .in('email_thread_id', threadIdList);
    for (const row of (leadsForThreads ?? [])) {
      const tid = (row as { email_thread_id: string | null }).email_thread_id;
      if (tid) linkedLeadByThreadId[tid] = Number((row as { id: number }).id);
    }
  }

  // TASK 2 (2026-07-14): per-alias status from initialThreads count.
  // "0 msgs" chips get a muted subtitle + info tooltip; hydrate error → all
  // chips show "error — reconnect" (single failure point today = personal
  // Gmail token / shared alias listing).
  const perAlias: Array<{
    id: string; label: string; alias: string; badge_color: string;
    count: number; errored: boolean;
  }> = mailboxes.map((m) => {
    const alias = m.mailbox_address.split('@')[0];
    const count = initialThreads.filter((t) => t.mailbox_id === m.id).length;
    return { id: m.id, label: m.label, alias, badge_color: m.badge_color, count, errored: !!hydrateErr };
  });

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
      {hydrateErr && (
        <div style={{ gridColumn: '1 / -1', padding: '12px 16px', background: '#FBE8E4', border: '1px solid #E8B7AB', borderRadius: 4, fontSize: 12, color: T.RED, marginBottom: 8 }}>
          <strong>Inbox fetch failed:</strong> {hydrateErr}
        </div>
      )}

      {/* TASK 2 · per-alias diagnostic strip */}
      <div style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        {perAlias.map((a) => {
          const zeroCount = !a.errored && a.count === 0;
          const bg = a.errored ? '#FBE8E4' : (zeroCount ? T.CREAM : T.WHITE);
          const borderColor = a.errored ? '#E8B7AB' : T.HAIR;
          return (
            <div
              key={a.id}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '6px 10px',
                background: bg,
                border: '1px solid ' + borderColor,
                borderRadius: 6,
                minHeight: 40,
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  background: a.badge_color || T.FOREST,
                  color: T.WHITE,
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '.02em',
                }}
              >
                {a.label}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                <span style={{ fontSize: 12, color: T.INK, fontWeight: 600 }}>
                  {a.errored ? 'error' : (a.count + ' msg' + (a.count === 1 ? '' : 's'))}
                </span>
                {a.errored && (
                  <span style={{ fontSize: 11, color: T.ERR }}>error — reconnect</span>
                )}
                {zeroCount && (
                  <span style={{ fontSize: 11, color: T.MUTED }}>0 msgs — check Workspace routing</span>
                )}
              </div>
              {zeroCount && (
                <span
                  title={
                    'Mail sent to ' + a.alias + '@thenamkhan.com isn’t landing in your pb@ inbox. ' +
                    'Add it as an alias on your account at admin.google.com → Users → Add alternate email, ' +
                    'or set up a Gmail routing rule.'
                  }
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 18, height: 18, borderRadius: 9,
                    background: T.HAIR, color: T.MUTED,
                    fontSize: 11, fontWeight: 700, cursor: 'help',
                    userSelect: 'none',
                  }}
                  aria-label={'Why is ' + a.alias + ' showing 0 messages?'}
                >
                  ?
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ gridColumn: '1 / -1', padding: '8px 12px', background: T.CREAM, border: '1px solid ' + T.HAIR, borderRadius: 4, fontSize: 11, color: T.INK_M, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <span>Debug: {mailboxes.length} aliases · {initialThreads.length} threads · signed in as {user.email}</span>
        <a href={fullMailHref} style={{ color: T.FOREST, textDecoration: 'none', fontWeight: 600 }}>Open in full mailbox</a>
      </div>
      <UnifiedMailInbox initialThreads={initialThreads} mailboxes={mailboxes} />
      <MailToLeadPanel threads={initialThreads} linkedLeadByThreadId={linkedLeadByThreadId} />
    </DashboardPage>
  );
}

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
