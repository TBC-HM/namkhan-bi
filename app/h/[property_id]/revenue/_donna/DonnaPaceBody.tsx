// app/h/[property_id]/revenue/_donna/DonnaPaceBody.tsx
// PBS 2026-05-16: live Donna Pace — OTB (future-looking) view from Mews data.

import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import KpiBox from '@/components/kpi/KpiBox';
import { REVENUE_SUBPAGES } from '@/app/revenue/_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';
import { getDonnaPaceKpis } from '@/lib/data-donna-mews';

interface Props {
  propertyId: number;
  win?: string;
  cmp?: string;
}

function resolvePaceWindow(win: string | undefined): { from: string; to: string; label: string } {
  const today = '2026-05-16';
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const todayD = new Date(today + 'T00:00:00Z');
  const fwd = (n: number) => { const d = new Date(todayD); d.setUTCDate(d.getUTCDate() + n); return fmt(d); };
  switch (win) {
    case 'next30':  return { from: today,        to: fwd(30),    label: 'OTB next 30d' };
    case 'next90':  return { from: today,        to: fwd(90),    label: 'OTB next 90d' };
    case 'next180': return { from: today,        to: fwd(180),   label: 'OTB next 180d' };
    case 'next365': return { from: today,        to: fwd(365),   label: 'OTB next 365d' };
    case 'rest_year': return { from: today,      to: '2026-12-31', label: 'OTB rest of 2026' };
    default:        return { from: today,        to: '2026-12-31', label: 'OTB rest of 2026' };
  }
}

export default async function DonnaPaceBody({ propertyId, win }: Props) {
  const period = resolvePaceWindow(win);
  const k = await getDonnaPaceKpis(period.from, period.to);
  const subPages = rewriteSubPagesForProperty(REVENUE_SUBPAGES, propertyId);

  return (
    <Page
      eyebrow={`Revenue · Pace · Donna · ${period.label} · ${k.otbReservations} rsvns · ${k.otbRn.toLocaleString('en-US')} RN`}
      title={<>Pace — <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>on the books</em></>}
      subPages={subPages}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <KpiBox value={k.otbRn} unit="count" label="OTB room-nights"
          tooltip={`Future-looking room-nights for non-cancelled reservations checking in ${period.from} → ${period.to}.`} />
        <KpiBox value={k.otbRevenueEur} unit="eur" dp={0} label="OTB revenue"
          tooltip={`Sum of total_amount across ${k.otbReservations} reservations.`} />
        <KpiBox value={k.otbAdrEur} unit="eur" label="OTB ADR"
          tooltip="OTB revenue ÷ OTB room-nights." />
        <KpiBox value={k.otbOccupancyPct} unit="pct" label="OTB occupancy"
          tooltip={`OTB room-nights ÷ (${66} rooms × ${k.numDays} nights).`} />
        <KpiBox value={k.cancelPctOnWindow} unit="pct" label="Cancel %"
          tooltip="Cancelled / total reservations in window." />
        <KpiBox value={k.alosNights} unit="nights" dp={1} label="ALOS"
          tooltip="Average length of stay." />
      </div>

      <div style={{ height: 14 }} />

      <Panel title={`Pace by month · ${period.label}`} eyebrow={`${k.byMonth.length} months`}>
        <div style={{ padding: 14, overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 'var(--t-sm)', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--tbl-border-strong, var(--paper-deep))' }}>
                <th style={th()}>Stay month</th>
                <th style={{ ...th(), textAlign: 'right' }}>Reservations</th>
                <th style={{ ...th(), textAlign: 'right' }}>OTB room-nights</th>
                <th style={{ ...th(), textAlign: 'right' }}>OTB revenue</th>
                <th style={{ ...th(), textAlign: 'right' }}>Implied ADR</th>
              </tr>
            </thead>
            <tbody>
              {k.byMonth.map((m) => (
                <tr key={m.month} style={{ borderBottom: '1px solid var(--tbl-border, var(--paper-deep))' }}>
                  <td style={td({ weight: 600 })}>{m.month}</td>
                  <td style={td({ mono: true, right: true })}>{m.reservations.toLocaleString('en-US')}</td>
                  <td style={td({ mono: true, right: true })}>{m.rn.toLocaleString('en-US')}</td>
                  <td style={td({ mono: true, right: true })}>€{m.revenue_eur.toLocaleString('en-US')}</td>
                  <td style={td({ mono: true, right: true })}>€{m.rn > 0 ? Math.round(m.revenue_eur / m.rn).toLocaleString('en-US') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div style={{ marginTop: 18, padding: '10px 12px', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', fontStyle: 'italic' }}>
        Source: <code>pms.reservations_mews</code> filtered by <code>check_in_date</code>. STLY comparison pending — needs prior-year alignment.
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
