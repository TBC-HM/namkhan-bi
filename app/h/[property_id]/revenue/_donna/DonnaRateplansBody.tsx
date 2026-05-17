// app/h/[property_id]/revenue/_donna/DonnaRateplansBody.tsx
// PBS 2026-05-16: live Donna Rate plans — concentration, active vs sleeping.

import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import KpiBox from '@/components/kpi/KpiBox';
import { REVENUE_SUBPAGES } from '@/app/revenue/_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';
import { getDonnaRateplansKpis } from '@/lib/data-donna-mews';

interface Props {
  propertyId: number;
  win?: string;
  cmp?: string;
}

function resolveWin(win: string | undefined): { from: string; to: string; label: string } {
  switch (win) {
    case '30d':  return { from: '2026-04-16', to: '2026-05-16', label: 'Last 30d' };
    case '90d':  return { from: '2026-02-16', to: '2026-05-16', label: 'Last 90d' };
    case 'ytd':  return { from: '2026-01-01', to: '2026-05-16', label: 'YTD 2026' };
    default:     return { from: '2026-01-01', to: '2026-12-31', label: 'Full year 2026' };
  }
}

export default async function DonnaRateplansBody({ propertyId, win }: Props) {
  const period = resolveWin(win);
  const k = await getDonnaRateplansKpis(period.from, period.to);
  const subPages = rewriteSubPagesForProperty(REVENUE_SUBPAGES, propertyId);
  const totalRev = k.rows.reduce((s, r) => s + r.revenue_eur, 0);

  return (
    <Page
      eyebrow={`Revenue · Rate plans · Donna · ${period.label} · ${k.activePlans} active · ${k.sleepingPlans} sleeping`}
      title={<>Rate plans — <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>concentration</em></>}
      subPages={subPages}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <KpiBox value={k.activePlans} unit="count" label="Active plans"
          tooltip="Plans with at least 1 non-cancelled reservation in window." />
        <KpiBox value={k.sleepingPlans} unit="count" label="Sleeping plans"
          tooltip="Plans seeded in pms.rate_plans_mews but no bookings in window. Candidates for archival or activation." />
        <KpiBox value={k.top3ConcentrationPct} unit="pct" label="Top 3 concentration"
          tooltip="Share of total reservations going to the 3 most-booked plans." />
        <KpiBox value={totalRev} unit="eur" dp={0} label="Total revenue"
          tooltip="Sum across all active plans in window." />
      </div>

      <div style={{ height: 14 }} />

      <Panel title="Plan performance · top 12 by reservation count" eyebrow={`${k.rows.length} active plans`}>
        <div style={{ padding: 14, overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 'var(--t-sm)', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--tbl-border-strong, var(--paper-deep))' }}>
                <th style={th()}>Rate plan</th>
                <th style={{ ...th(), textAlign: 'right' }}>Rsvns</th>
                <th style={{ ...th(), textAlign: 'right' }}>RN</th>
                <th style={{ ...th(), textAlign: 'right' }}>Revenue</th>
                <th style={{ ...th(), textAlign: 'right' }}>ADR</th>
                <th style={{ ...th(), textAlign: 'right' }}>% of rsvns</th>
              </tr>
            </thead>
            <tbody>
              {k.rows.slice(0, 12).map((r) => {
                const totalRsv = k.rows.reduce((s, x) => s + x.reservations, 0);
                const pct = totalRsv > 0 ? (r.reservations / totalRsv) * 100 : 0;
                return (
                  <tr key={r.rate_plan} style={{ borderBottom: '1px solid var(--tbl-border, var(--paper-deep))' }}>
                    <td style={td({ weight: 600 })}>{r.rate_plan}</td>
                    <td style={td({ mono: true, right: true })}>{r.reservations.toLocaleString('en-US')}</td>
                    <td style={td({ mono: true, right: true })}>{r.rn.toLocaleString('en-US')}</td>
                    <td style={td({ mono: true, right: true })}>€{r.revenue_eur.toLocaleString('en-US')}</td>
                    <td style={td({ mono: true, right: true })}>€{r.adr_eur.toLocaleString('en-US')}</td>
                    <td style={td({ mono: true, right: true, mute: true })}>{pct.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <div style={{ marginTop: 18, padding: '10px 12px', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', fontStyle: 'italic' }}>
        Source: <code>pms.reservations_mews.rate_plan</code> grouped + joined against <code>pms.rate_plans_mews</code> for "sleeping" detection (seeded plans with 0 bookings in window).
      </div>
    </Page>
  );
}

function th(): React.CSSProperties {
  return { textAlign: 'left', padding: '8px 6px', color: 'var(--tbl-fg-mute, var(--ink-mute, #7d7565))', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', fontWeight: 600 };
}
function td(opts: { mono?: boolean; right?: boolean; mute?: boolean; weight?: number } = {}): React.CSSProperties {
  return {
    padding: '8px 6px',
    fontFamily: opts.mono ? 'var(--mono)' : 'inherit',
    textAlign: opts.right ? 'right' : 'left',
    color: opts.mute ? 'var(--tbl-fg-mute, var(--ink-mute, #7d7565))' : 'var(--tbl-fg, var(--ink, #1a1a1a))',
    fontWeight: opts.weight ?? 400,
  };
}
