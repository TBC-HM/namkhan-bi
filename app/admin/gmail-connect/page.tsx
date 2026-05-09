// /admin/gmail-connect — admin UI for hooking up Gmail OAuth + checking poller status.
// Direct access by URL (gated by CRON_SECRET on the underlying routes, not via UI auth).

import Page from '@/components/page/Page';
import { listGmailConnections } from '@/lib/gmail';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface RecentRun {
  id: number;
  email: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  messages_seen: number;
  messages_inserted: number;
  messages_skipped: number;
  error_message: string | null;
}

async function listRecentRuns(): Promise<RecentRun[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.schema('sales').from('gmail_poll_runs')
    .select('*').order('started_at', { ascending: false }).limit(20);
  return (data ?? []) as RecentRun[];
}

export default async function GmailConnectPage({ searchParams }: { searchParams: { connected?: string; err?: string; key?: string } }) {
  const [connections, runs] = await Promise.all([listGmailConnections(), listRecentRuns()]);
  const adminKey = searchParams.key ?? '';

  return (
    <Page eyebrow="Settings · Gmail OAuth" title={<>Gmail · poll <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>connections</em></>}>

      {searchParams.connected && (
        <div style={{ marginTop: 14, padding: 12, background: 'var(--st-good-bg)', border: '1px solid var(--st-good-bd)', borderRadius: 8 }}>
          ✅ Connected <strong>{searchParams.connected}</strong>. Refresh token saved. Cron will pick it up at next 5-min slot, or hit Run now below.
        </div>
      )}
      {searchParams.err && (
        <div style={{ marginTop: 14, padding: 12, background: 'var(--st-bad-bg)', border: '1px solid var(--st-bad-bd)', borderRadius: 8 }}>
          ❌ OAuth failed: <code>{searchParams.err}</code>
        </div>
      )}

      <section style={{ marginTop: 18 }}>
        <div className="t-eyebrow" style={{ marginBottom: 10 }}>Connect a new mailbox</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 12,
                      background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 8 }}>
          <a
            href={adminKey ? `/api/auth/gmail/start?key=${encodeURIComponent(adminKey)}&back=/admin/gmail-connect%3Fkey%3D${encodeURIComponent(adminKey)}` : '#'}
            style={{
              display: 'inline-block',
              padding: '8px 16px',
              background: 'var(--moss)',
              color: 'var(--paper-warm)',
              border: 0,
              borderRadius: 6,
              textDecoration: 'none',
              fontFamily: 'var(--mono)',
              fontSize: 'var(--t-sm)',
              fontWeight: 600,
              letterSpacing: 'var(--ls-loose)',
              textTransform: 'uppercase',
              opacity: adminKey ? 1 : 0.4,
              pointerEvents: adminKey ? 'auto' : 'none',
            }}
          >
            Connect Gmail account →
          </a>
          {!adminKey && (
            <span style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-mute)' }}>
              Append <code>?key=&lt;CRON_SECRET&gt;</code> to this URL to enable.
            </span>
          )}
        </div>
      </section>

      <section style={{ marginTop: 22 }}>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 'var(--t-xl)', fontWeight: 500, margin: '0 0 10px' }}>
          Connected <em style={{ color: 'var(--brass)' }}>mailboxes</em>
          <span style={{ marginLeft: 10, fontSize: 'var(--t-sm)', color: 'var(--ink-mute)' }}>{connections.length}</span>
        </h3>
        {connections.length === 0 ? (
          <div className="panel dashed" style={{ padding: 24, color: 'var(--ink-mute)' }}>
            No Gmail accounts connected yet. Click <strong>Connect Gmail account</strong> above.
          </div>
        ) : (
          <table style={{ width: '100%', background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 8, borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr style={{ background: 'var(--paper-deep)' }}>
                <th style={th}>EMAIL</th>
                <th style={th}>LAST SYNC</th>
                <th style={{ ...th, textAlign: 'right' }}>TOTAL SYNCED</th>
                <th style={{ ...th, textAlign: 'center' }}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {connections.map((c) => (
                <tr key={c.email} style={{ borderTop: '1px solid var(--line-soft)' }}>
                  <td style={td}>{c.email}</td>
                  <td style={td}>{c.last_synced_at ? new Date(c.last_synced_at).toLocaleString('en-CA') : 'never (first poll pending)'}</td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--mono)' }}>{c.total_synced.toLocaleString()}</td>
                  <td style={{ ...td, textAlign: 'center' }}>{c.paused ? '⏸ paused' : '▶ active'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {adminKey && (
          <p style={{ marginTop: 12, fontSize: 'var(--t-sm)', color: 'var(--ink-mute)' }}>
            Manual poll trigger:{' '}
            <a href={`/api/cron/poll-gmail?key=${encodeURIComponent(adminKey)}`} style={{ color: 'var(--brass)' }}>
              /api/cron/poll-gmail?key=…
            </a>
            {' · '}force one inbox + custom since:{' '}
            <code>?key=…&force_email=pb@thenamkhan.com&since=2026-01-01</code>
          </p>
        )}
      </section>

      <section style={{ marginTop: 22 }}>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 'var(--t-xl)', fontWeight: 500, margin: '0 0 10px' }}>
          Recent <em style={{ color: 'var(--brass)' }}>poll runs</em>
        </h3>
        {runs.length === 0 ? (
          <div className="panel dashed" style={{ padding: 24, color: 'var(--ink-mute)' }}>No runs yet.</div>
        ) : (
          <table style={{ width: '100%', background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 8, borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr style={{ background: 'var(--paper-deep)' }}>
                <th style={th}>STARTED</th>
                <th style={th}>EMAIL</th>
                <th style={th}>STATUS</th>
                <th style={{ ...th, textAlign: 'right' }}>SEEN</th>
                <th style={{ ...th, textAlign: 'right' }}>INSERTED</th>
                <th style={{ ...th, textAlign: 'right' }}>SKIPPED</th>
                <th style={th}>ERROR</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} style={{ borderTop: '1px solid var(--line-soft)' }}>
                  <td style={{ ...td, fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>{new Date(r.started_at).toLocaleString('en-CA')}</td>
                  <td style={td}>{r.email}</td>
                  <td style={{ ...td, color: r.status === 'error' ? 'var(--st-bad)' : r.status === 'success' ? 'var(--st-good)' : 'var(--ink)' }}>
                    {r.status}
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--mono)' }}>{r.messages_seen}</td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--mono)', color: r.messages_inserted > 0 ? 'var(--moss-glow)' : 'var(--ink-mute)' }}>{r.messages_inserted}</td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--mono)' }}>{r.messages_skipped}</td>
                  <td style={{ ...td, fontSize: 'var(--t-xs)', color: 'var(--st-bad)' }}>{r.error_message ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </Page>
  );
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-extra)',
  textTransform: 'uppercase',
  color: 'var(--brass)',
  fontWeight: 600,
};
const td: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 'var(--t-sm)',
};
