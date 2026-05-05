// app/knowledge/alerts/page.tsx
// Standalone alerts overview — read-only list grouped by severity.
// Data computed daily by /api/cron/alerts. Click a doc to open it.

import Banner from '@/components/nav/Banner';
import SubNav from '@/components/nav/SubNav';
import { RAIL_SUBNAV, PILLAR_HEADER } from '@/components/nav/subnavConfig';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SEV_COLOR: Record<string, { bg: string; bd: string; tx: string; label: string }> = {
  critical: { bg: 'var(--st-bad-bg)',  bd: 'var(--st-bad-bd)',  tx: 'var(--st-bad)',  label: 'CRITICAL' },
  high:     { bg: '#fde7d3',            bd: '#f3b87a',           tx: '#92400e',         label: 'HIGH' },
  medium:   { bg: 'var(--st-warn-bg)',  bd: 'var(--st-warn-bd)', tx: 'var(--st-warn)', label: 'MEDIUM' },
  low:      { bg: 'var(--paper-warm)',  bd: 'var(--line-soft)',  tx: 'var(--ink-mute)',label: 'LOW' },
};

export default async function AlertsPage() {
  const h = PILLAR_HEADER.knowledge;
  const admin = getSupabaseAdmin();

  const { data } = await admin
    .from('v_alerts_open')
    .select('*')
    .limit(500);
  const alerts = (data ?? []) as any[];

  // Group by severity, then kind
  const bySeverity: Record<string, any[]> = { critical: [], high: [], medium: [], low: [] };
  for (const a of alerts) {
    const sev = a.severity in bySeverity ? a.severity : 'low';
    bySeverity[sev].push(a);
  }
  const totals = Object.entries(bySeverity).reduce((acc, [sev, arr]) => {
    acc[sev] = arr.length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <>
      <Banner
        eyebrow={h.eyebrow}
        title="Alerts"
        titleEmphasis="& expiries"
        meta={<><strong>{alerts.length}</strong> open</>}
      />
      <SubNav items={RAIL_SUBNAV.knowledge} />
      <div className="panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Severity counters */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {(['critical','high','medium','low'] as const).map(sev => {
            const c = SEV_COLOR[sev];
            return (
              <div key={sev} style={{
                background: c.bg, border: `1px solid ${c.bd}`, borderRadius: 4,
                padding: '10px 16px', minWidth: 110,
              }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                              letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
                              color: c.tx }}>{c.label}</div>
                <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic',
                              fontSize: 'var(--t-2xl)', color: c.tx }}>
                  {totals[sev]}
                </div>
              </div>
            );
          })}
        </div>

        {alerts.length === 0 && (
          <div style={{
            border: '1px solid var(--st-good-bd)', background: 'var(--st-good-bg)',
            borderRadius: 4, padding: 16,
            fontFamily: 'var(--sans)', fontSize: 'var(--t-md)', color: 'var(--st-good)',
          }}>
            ✓ No open alerts. Run <code>GET /api/cron/alerts</code> to refresh.
          </div>
        )}

        {/* Grouped lists */}
        {(['critical','high','medium','low'] as const).map(sev => {
          const arr = bySeverity[sev];
          if (arr.length === 0) return null;
          const c = SEV_COLOR[sev];
          return (
            <div key={sev} style={{
              border: `1px solid ${c.bd}`, background: 'var(--paper-pure)',
              borderRadius: 4,
            }}>
              <div style={{
                background: c.bg, padding: '8px 16px',
                fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
                color: c.tx, borderBottom: `1px solid ${c.bd}`,
              }}>
                {c.label} · {arr.length}
              </div>
              <div>
                {arr.map((a: any) => (
                  <div key={a.alert_id} style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--line-soft)',
                    display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start',
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'var(--sans)', fontSize: 'var(--t-md)', color: 'var(--ink)' }}>
                        {a.message}
                      </div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                                    color: 'var(--ink-mute)' }}>
                        {[a.alert_kind, a.doc_type, a.external_party,
                          a.valid_until ? `expires ${a.valid_until}` : null,
                          a.importance].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                      color: 'var(--ink-mute)', textAlign: 'right' }}>
          Refreshed daily by /api/cron/alerts at 06:00 UTC ·
          {' '}Manual refresh:{' '}
          <a href="/api/cron/alerts" target="_blank" style={{ color: 'var(--moss)' }}>
            run now
          </a>
        </div>
      </div>
    </>
  );
}
