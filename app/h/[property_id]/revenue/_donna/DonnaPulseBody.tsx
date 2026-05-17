// app/h/[property_id]/revenue/_donna/DonnaPulseBody.tsx
//
// PBS 2026-05-16: live Donna Pulse body — driven by Mews CSV import data.
// Same KPI band shape as Namkhan, EUR-native (Donna operating currency),
// capacity hardcoded 66 rooms until core.properties.room_count column lands.

import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import KpiBox from '@/components/kpi/KpiBox';
import { REVENUE_SUBPAGES } from '@/app/revenue/_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';
import { getDonnaPulseKpis } from '@/lib/data-donna-mews';

interface Props {
  propertyId: number;
  win?: string;
  cmp?: string;
}

function resolveWindow(win: string | undefined): { from: string; to: string; label: string } {
  const today = '2026-05-16';
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const todayD = new Date(today + 'T00:00:00Z');
  const back = (n: number) => { const d = new Date(todayD); d.setUTCDate(d.getUTCDate() - n); return fmt(d); };
  const fwd  = (n: number) => { const d = new Date(todayD); d.setUTCDate(d.getUTCDate() + n); return fmt(d); };

  switch (win) {
    case '7d':       return { from: back(7),   to: today,    label: 'Last 7d' };
    case '30d':      return { from: back(30),  to: today,    label: 'Last 30d' };
    case '90d':      return { from: back(90),  to: today,    label: 'Last 90d' };
    case 'next30':   return { from: today,     to: fwd(30),  label: 'Next 30d' };
    case 'next90':   return { from: today,     to: fwd(90),  label: 'Next 90d' };
    case 'ytd':      return { from: '2026-01-01', to: today, label: 'YTD 2026' };
    case 'l12m':     return { from: back(365), to: today,    label: 'Last 12 months' };
    case 'today':    return { from: today,     to: today,    label: 'Today' };
    default:         return { from: '2026-01-01', to: '2026-12-31', label: 'Full year 2026' };
  }
}

export default async function DonnaPulseBody({ propertyId, win }: Props) {
  const period = resolveWindow(win);
  const k = await getDonnaPulseKpis(period.from, period.to);
  const subPages = rewriteSubPagesForProperty(REVENUE_SUBPAGES, propertyId);
  const monthly = aggregateByMonth(k.daily);

  return (
    <Page
      eyebrow={`Revenue · Pulse · Donna · ${period.label} · ${k.rnSold.toLocaleString('en-US')} RN · €${Math.round(k.roomsRevenueEur).toLocaleString('en-US')}`}
      title={<>What's <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>open</em>, right now.</>}
      subPages={subPages}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <KpiBox value={k.occupancyPct} unit="pct" label="Occupancy"
          tooltip={`Rooms sold ÷ rooms available × 100. ${k.rnSold.toLocaleString('en-US')} sold of ${k.roomsAvailable.toLocaleString('en-US')} available (${k.rooms} rooms × ${k.numDays} nights). Source: pms.reservation_rooms_mews.`} />
        <KpiBox value={k.adrEur} unit="eur" label="ADR"
          tooltip={`Average daily rate = rooms revenue ÷ rooms sold. Window: ${period.label}. Mews per-night rates.`} />
        <KpiBox value={k.revparEur} unit="eur" label="RevPAR"
          tooltip={`Revenue per available room = rooms revenue ÷ rooms available. Window: ${period.label}.`} />
        <KpiBox value={k.trevparEur} unit="eur" label="TRevPAR"
          tooltip="Total RevPAR. F&B + spa + activities not yet in the Mews import; equals RevPAR until ancillary feed lands." />
        <KpiBox value={k.cancelPct} unit="pct" label="Cancel %"
          tooltip={`Cancelled reservations ÷ total reservations × 100. Window: ${period.label}.`} />
        <KpiBox value={k.leadTimeDays ?? 0} unit="nights" dp={0} label="Lead time (d)"
          tooltip="Mean days from booking_date to check_in_date in this window." />
        <KpiBox value={k.alosNights} unit="nights" dp={1} label="ALOS"
          tooltip="Average length of stay (room-nights ÷ stays) in this window." />
        <KpiBox value={k.roomsRevenueEur} unit="eur" dp={0} label="Rooms revenue"
          tooltip="Sum of nightly rates for non-cancelled reservations in window." />
      </div>

      <div style={{ height: 14 }} />

      <Panel
        title={`Monthly room-nights & revenue · ${period.label}`}
        eyebrow={`source: pms.reservation_rooms_mews · ${monthly.length} months`}
      >
        <MonthlyBars rows={monthly} />
      </Panel>

      <div style={{ marginTop: 18, padding: '10px 12px', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', fontStyle: 'italic' }}>
        Source: <code>pms.reservation_rooms_mews</code> joined with <code>pms.reservations_mews</code> (4,573 reservations · 15,619 nights imported from Mews CSV).
        Capacity assumed {k.rooms} rooms — derived from distinct room_ids; will swap to <code>core.properties.room_count</code> when that column lands.
        EUR-native (Donna operating currency). Pace · Channels · Rate plans coming next.
      </div>
    </Page>
  );
}

function aggregateByMonth(daily: { day: string; rn: number; revenue_eur: number }[]) {
  const m = new Map<string, { rn: number; revenue_eur: number }>();
  for (const d of daily) {
    const k = d.day.slice(0, 7);
    const cur = m.get(k) ?? { rn: 0, revenue_eur: 0 };
    cur.rn += d.rn;
    cur.revenue_eur += d.revenue_eur;
    m.set(k, cur);
  }
  return Array.from(m.entries())
    .map(([month, v]) => ({ month, rn: v.rn, revenue_eur: Math.round(v.revenue_eur) }))
    .sort((a, b) => (a.month < b.month ? -1 : 1));
}

function MonthlyBars({ rows }: { rows: { month: string; rn: number; revenue_eur: number }[] }) {
  if (rows.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-mute)', fontStyle: 'italic' }}>
        No room-nights in window.
      </div>
    );
  }
  const W = 760, H = 260;
  const padL = 50, padR = 50, padT = 16, padB = 40;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const maxRn = Math.max(1, ...rows.map((r) => r.rn));
  const maxRev = Math.max(1, ...rows.map((r) => r.revenue_eur));
  const step = innerW / rows.length;
  const barW = step * 0.6;

  const revPath = rows.map((r, i) => {
    const cx = padL + i * step + step / 2;
    const cy = padT + innerH - (r.revenue_eur / maxRev) * innerH;
    return `${i === 0 ? 'M' : 'L'}${cx.toFixed(1)},${cy.toFixed(1)}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 260 }}>
      <line x1={padL} y1={padT + innerH} x2={W - padR} y2={padT + innerH} stroke="#7d7565" />
      {rows.map((r, i) => {
        const x = padL + i * step + (step - barW) / 2;
        const hRn = (r.rn / maxRn) * innerH;
        const y = padT + innerH - hRn;
        return (
          <rect key={r.month} x={x} y={y} width={barW} height={hRn} fill="#a8854a" opacity={0.85}>
            <title>{`${r.month} · ${r.rn} room-nights · €${r.revenue_eur.toLocaleString('en-US')}`}</title>
          </rect>
        );
      })}
      <path d={revPath} fill="none" stroke="#1a2e21" strokeWidth={1.5} />
      {rows.map((r, i) => {
        const cx = padL + i * step + step / 2;
        const cy = padT + innerH - (r.revenue_eur / maxRev) * innerH;
        return (
          <circle key={`d-${r.month}`} cx={cx} cy={cy} r={4} fill="#1a2e21">
            <title>{`${r.month} · €${r.revenue_eur.toLocaleString('en-US')} rooms revenue · ${r.rn} RN`}</title>
          </circle>
        );
      })}
      {rows.map((r, i) => {
        const cx = padL + i * step + step / 2;
        return (
          <text key={`x-${r.month}`} x={cx} y={H - 8} textAnchor="middle" fontSize={10} fill="#4a443c">
            {r.month.slice(5)}
          </text>
        );
      })}
      <text x={padL} y={padT + 10} fontSize={9} fill="#a8854a">▮ Room-nights (max {maxRn})</text>
      <text x={W - padR - 140} y={padT + 10} fontSize={9} fill="#1a2e21">● Revenue € (max €{maxRev.toLocaleString('en-US')})</text>
    </svg>
  );
}
