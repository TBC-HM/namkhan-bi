// app/h/[property_id]/revenue/_donna/DonnaChannelsBody.tsx
// PBS 2026-05-16: live Donna Channels — distribution mix from Mews source_name.

import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import KpiBox from '@/components/kpi/KpiBox';
import { REVENUE_SUBPAGES } from '@/app/revenue/_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';
import { getDonnaChannelsKpis } from '@/lib/data-donna-mews';

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

export default async function DonnaChannelsBody({ propertyId, win }: Props) {
  const period = resolveWin(win);
  const k = await getDonnaChannelsKpis(period.from, period.to);
  const subPages = rewriteSubPagesForProperty(REVENUE_SUBPAGES, propertyId);

  return (
    <Page
      eyebrow={`Revenue · Channels · Donna · ${period.label} · ${k.rows.length} sources · €${k.totalRevenueEur.toLocaleString('en-US')}`}
      title={<>Channels — <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>distribution</em></>}
      subPages={subPages}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <KpiBox value={k.directPct} unit="pct" label="Direct mix"
          tooltip="Witbooking + Email + Telephone + In person + Website. Source: pms.reservations_mews.source_name." />
        <KpiBox value={k.otaPct} unit="pct" label="OTA mix"
          tooltip="Booking.com + Expedia family + Hotels.com + Agoda + Trip.com." />
        <KpiBox value={k.wholesalePct} unit="pct" label="Wholesale mix"
          tooltip="SunHotels + Hotelbeds + WebBeds + Tourico + others." />
        <KpiBox value={k.otherPct} unit="pct" label="Other mix"
          tooltip="Sources not yet classified." />
        <KpiBox value={k.avgLeadTimeDays ?? 0} unit="nights" dp={0} label="Avg lead time (d)"
          tooltip="Reservation-weighted average days from booking to arrival." />
        <KpiBox value={k.totalRevenueEur} unit="eur" dp={0} label="Total revenue"
          tooltip="Sum of total_amount across all non-cancelled reservations in window." />
      </div>

      <div style={{ height: 14 }} />

      <Panel title="Channel breakdown · top 15 by revenue" eyebrow={`${k.rows.length} sources total`}>
        <div style={{ padding: 14, overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 'var(--t-sm)', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--tbl-border-strong, var(--paper-deep))' }}>
                <th style={th()}>Source</th>
                <th style={th()}>Category</th>
                <th style={{ ...th(), textAlign: 'right' }}>Rsvns</th>
                <th style={{ ...th(), textAlign: 'right' }}>RN</th>
                <th style={{ ...th(), textAlign: 'right' }}>Revenue</th>
                <th style={{ ...th(), textAlign: 'right' }}>% of total</th>
                <th style={{ ...th(), textAlign: 'right' }}>Lead time</th>
              </tr>
            </thead>
            <tbody>
              {k.rows.slice(0, 15).map((r) => {
                const pct = k.totalRevenueEur > 0 ? (r.revenue_eur / k.totalRevenueEur) * 100 : 0;
                return (
                  <tr key={r.source_name} style={{ borderBottom: '1px solid var(--tbl-border, var(--paper-deep))' }}>
                    <td style={td({ weight: 600 })}>{r.source_name}</td>
                    <td style={td({ mute: true })}>{r.category}</td>
                    <td style={td({ mono: true, right: true })}>{r.reservations.toLocaleString('en-US')}</td>
                    <td style={td({ mono: true, right: true })}>{r.rn.toLocaleString('en-US')}</td>
                    <td style={td({ mono: true, right: true })}>€{r.revenue_eur.toLocaleString('en-US')}</td>
                    <td style={td({ mono: true, right: true })}>{pct.toFixed(1)}%</td>
                    <td style={td({ mono: true, right: true, mute: true })}>{r.avg_lead_time_days != null ? `${r.avg_lead_time_days}d` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <div style={{ marginTop: 18, padding: '10px 12px', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', fontStyle: 'italic' }}>
        Source: <code>pms.reservations_mews</code> grouped by <code>source_name</code>. Category mapping is regex-based (Direct / OTA / Wholesale / Other) — will move to a curated table in <code>pms.sources_mews</code> when Donna confirms the canonical buckets.
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
