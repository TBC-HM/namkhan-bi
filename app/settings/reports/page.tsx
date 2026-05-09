// app/settings/reports/page.tsx — REDESIGN 2026-05-05 (recovery)
import Page from '@/components/page/Page';
import StatusPill from '@/components/ui/StatusPill';
import { getCurrentUser, canEdit, roleLabel } from '@/lib/currentUser';
import { supabase, PROPERTY_ID } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const user = await getCurrentUser();
  const canSee = canEdit(user.role, 'owner');

  if (!canSee) {
    return (
      <Page eyebrow="Settings · Reports" title={<>Scheduled <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>reports</em>.</>}>
        <div style={{ marginTop: 18, padding: 32, background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderLeft: '3px solid var(--st-bad)', borderRadius: 8 }}>
          <strong>Owner only.</strong> You're signed in as <strong>{roleLabel(user.role)}</strong>.
        </div>
      </Page>
    );
  }

  // Read live schedule rows from app_settings (key prefix `reports.`)
  // Schema:  reports.<slug>.{cadence,recipients,enabled,subject}
  const { data: settings } = await supabase
    .from('app_settings')
    .select('key, value')
    .eq('property_id', PROPERTY_ID)
    .like('key', 'reports.%');

  type Row = { slug: string; subject: string; cadence: string; recipients: string; enabled: boolean };
  const map = new Map<string, Partial<Row>>();
  for (const s of (settings ?? []) as any[]) {
    const parts = String(s.key).split('.');
    if (parts.length < 3) continue;
    const slug = parts[1];
    const field = parts.slice(2).join('.');
    const cur = map.get(slug) ?? { slug };
    if (field === 'subject') cur.subject = String(s.value ?? '');
    else if (field === 'cadence') cur.cadence = String(s.value ?? '');
    else if (field === 'recipients') cur.recipients = Array.isArray(s.value) ? s.value.join(', ') : String(s.value ?? '');
    else if (field === 'enabled') cur.enabled = s.value === true;
    map.set(slug, cur);
  }
  const rows: Row[] = Array.from(map.values()).map((r) => ({
    slug: r.slug ?? '—',
    subject: r.subject ?? '—',
    cadence: r.cadence ?? '—',
    recipients: r.recipients ?? '—',
    enabled: r.enabled === true,
  }));
  const onCount = rows.filter((r) => r.enabled).length;

  return (
    <Page eyebrow="Settings · Reports" title={<>Scheduled <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>reports</em>.</>}>
      <div style={{ marginTop: 14, padding: '10px 16px', display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 8 }}>
        <span className="t-eyebrow">SOURCE</span>
        <StatusPill tone="active">app_settings · reports.*</StatusPill>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>· builder + dispatcher pending</span>
      </div>
      <div style={{ marginTop: 18 }}>
        <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'var(--t-xl)', fontWeight: 500, marginBottom: 6 }}>
          Configured schedules
          <span style={{ marginLeft: 8, fontFamily: 'var(--mono)', fontStyle: 'normal', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)' }}>{rows.length}</span>
        </div>
        <div style={{ background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 8, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr>
              <th style={th}>Report</th>
              <th style={th}>Cadence</th>
              <th style={th}>Recipients</th>
              <th style={{ ...th, textAlign: 'center' }}>Status</th>
            </tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: 'var(--ink-mute)', fontStyle: 'italic' }}>No schedules configured. Insert into <code>app_settings</code> with key prefix <code>reports.&lt;slug&gt;.*</code>.</td></tr>}
              {rows.map((r) => (
                <tr key={r.slug}>
                  <td style={td}><strong>{r.subject}</strong><div style={{ color: 'var(--ink-mute)', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>{r.slug}</div></td>
                  <td style={{ ...td, color: 'var(--ink-mute)' }}>{r.cadence}</td>
                  <td style={{ ...td, color: 'var(--ink-mute)' }}>{r.recipients}</td>
                  <td style={{ ...td, textAlign: 'center' }}><StatusPill tone={r.enabled ? 'active' : 'inactive'}>{r.enabled ? 'ENABLED' : 'OFF'}</StatusPill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ marginTop: 18, padding: '10px 14px', background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderLeft: '3px solid var(--brass)', borderRadius: 6, fontSize: 'var(--t-sm)', color: 'var(--ink-soft)' }}>
        Reports belong as a top-level menu when the builder ships — they're listed under Settings for now since the schedule sits with property config.
      </div>
    </Page>
  );
}

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', background: 'var(--paper-deep)', borderBottom: '1px solid var(--paper-deep)', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)', fontWeight: 600 };
const td: React.CSSProperties = { padding: '6px 12px', borderBottom: '1px solid var(--paper-deep)', fontSize: 12, color: 'var(--ink)' };
