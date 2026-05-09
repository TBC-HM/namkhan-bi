// app/settings/notifications/page.tsx — REDESIGN 2026-05-05 (recovery)
import Page from '@/components/page/Page';
import StatusPill from '@/components/ui/StatusPill';
import { getCurrentUser } from '@/lib/currentUser';
import { supabase, PROPERTY_ID } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface ToggleRow {
  key: string;
  label: string;
  desc: string;
}

const TOGGLES: ToggleRow[] = [
  { key: 'notifications.daily_digest_email', label: 'Daily digest', desc: "Yesterday's KPIs · arrivals tonight · open action cards" },
  { key: 'notifications.review_alerts_email', label: 'Review alerts', desc: 'New review under 4.0 stars or response SLA breach' },
  { key: 'notifications.dq_alerts_email', label: 'DQ alerts', desc: 'New high-severity data quality issue detected' },
  { key: 'notifications.parity_breach_email', label: 'Parity breaches', desc: 'BDC parity violation detected by parity_agent' },
  { key: 'notifications.variance_email', label: 'P&L variance', desc: 'Monthly close variance over threshold from variance_agent' },
];

export default async function NotificationsPage() {
  const user = await getCurrentUser();

  const { data: settings } = await supabase
    .from('app_settings')
    .select('key, value')
    .eq('property_id', PROPERTY_ID)
    .like('key', 'notifications.%');
  const map = new Map<string, any>();
  for (const s of (settings ?? []) as any[]) map.set(s.key, s.value);
  const isOn = (k: string) => map.get(k) === true;
  const onCount = TOGGLES.filter((t) => isOn(t.key)).length;

  return (
    <Page eyebrow="Settings · Notifications" title={<>Tell me when <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>it matters</em>.</>}>
      <div style={{ marginTop: 14, padding: '10px 16px', display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 8 }}>
        <span className="t-eyebrow">SOURCE</span>
        <StatusPill tone="active">app_settings</StatusPill>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', letterSpacing: 'var(--ls-loose)' }}>· per-property toggles · dispatch via cron + email service (not wired)</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>{onCount} on · {TOGGLES.length - onCount} off</span>
      </div>
      <div style={{ marginTop: 18 }}>
        <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'var(--t-xl)', fontWeight: 500, marginBottom: 6 }}>
          Email notifications
          <span style={{ marginLeft: 8, fontFamily: 'var(--mono)', fontStyle: 'normal', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)' }}>{TOGGLES.length} channels</span>
        </div>
        <div style={{ background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 8, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr>
              <th style={th}>Channel</th>
              <th style={th}>Description</th>
              <th style={{ ...th, textAlign: 'center' }}>Status</th>
            </tr></thead>
            <tbody>
              {TOGGLES.map((t) => {
                const on = isOn(t.key);
                return (
                  <tr key={t.key}>
                    <td style={td}><strong>{t.label}</strong></td>
                    <td style={{ ...td, color: 'var(--ink-mute)' }}>{t.desc}</td>
                    <td style={{ ...td, textAlign: 'center' }}><StatusPill tone={on ? 'active' : 'inactive'}>{on ? 'ON' : 'OFF'}</StatusPill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ marginTop: 18, padding: '10px 14px', background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderLeft: '3px solid var(--brass)', borderRadius: 6, fontSize: 'var(--t-sm)', color: 'var(--ink-soft)' }}>
        Toggles are stored today; emails dispatch once SendGrid or Resend is wired. No live cron consuming this table yet.
      </div>
    </Page>
  );
}

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', background: 'var(--paper-deep)', borderBottom: '1px solid var(--paper-deep)', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)', fontWeight: 600 };
const td: React.CSSProperties = { padding: '6px 12px', borderBottom: '1px solid var(--paper-deep)', fontSize: 12, color: 'var(--ink)' };
