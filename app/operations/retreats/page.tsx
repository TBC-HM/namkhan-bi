// app/operations/retreats/page.tsx
// PBS 2026-09-06 — Retreats department analytics.
// Retreat guests are identified by booking source (three retreat OTA channels).
// Two models: wholesale (Retreat Reseller, group blocks at group ADR) and
// individual (BookRetreats, Tripaneer, using Retreat Packages Base Rate plans).
// Property ID is always Namkhan (260955); /h/ wrapper redirects here.

import { DashboardPage, Container, KpiTile, type DashboardTab } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '../_subpages';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props {
  propertyId?: number;
}

const NAMKHAN_PID = 260955;

const RETREAT_SOURCES = [
  'Retreat Reseller (f.eVigeosport)',
  'BookRetreats',
  'Book Yoga Retreats by Tripaneer',
] as const;

const SRC_LABEL: Record<string, string> = {
  'Retreat Reseller (f.eVigeosport)': 'Retreat Reseller',
  BookRetreats: 'BookRetreats',
  'Book Yoga Retreats by Tripaneer': 'Tripaneer',
};

type ResRow = {
  reservation_id: string;
  guest_name: string | null;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  status_canonical: string | null;
  is_cancelled: boolean;
  source_name: string | null;
  rate_plan: string | null;
  total_amount: number | null;
};

type TxRow = {
  reservation_id: string;
  description: string | null;
  amount: number | null;
  service_date: string | null;
};

const fmt$ = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const fmtN = (n: number, d = 1) => n.toFixed(d);

function MonthlyBars({ data }: { data: { month: string; revenue: number; count: number }[] }) {
  if (data.length === 0) {
    return <div style={{ padding: 20, color: 'var(--tbl-fg-mute)', fontSize: 13 }}>No stays recorded yet.</div>;
  }
  const max = Math.max(...data.map((d) => d.revenue), 1);
  const barW = 52, gap = 18, chartH = 160, padT = 24, padB = 38;
  const w = data.length * (barW + gap) + gap;
  return (
    <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
      <svg width={w} height={chartH + padT + padB} style={{ display: 'block' }}>
        {data.map((d, i) => {
          const x = gap + i * (barW + gap);
          const h = Math.max((d.revenue / max) * chartH, 2);
          const y = padT + chartH - h;
          const [yr, mo] = d.month.split('-').map(Number);
          const lbl = new Date(Date.UTC(yr, mo - 1)).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
          return (
            <g key={d.month}>
              <rect x={x} y={y} width={barW} height={h} fill="var(--tbl-border-strong, #6B7B6E)" rx={2} />
              <text x={x + barW / 2} y={padT + chartH + 14} textAnchor="middle" fontSize="10" fill="var(--tbl-fg-mute, #666)">{lbl}</text>
              {d.count > 0 && (
                <text x={x + barW / 2} y={padT + chartH + 26} textAnchor="middle" fontSize="9" fill="var(--tbl-fg-mute, #888)">{d.count}st</text>
              )}
              {d.revenue > 0 && (
                <text x={x + barW / 2} y={y - 5} textAnchor="middle" fontSize="9" fill="var(--tbl-fg, #000)">{fmt$(d.revenue)}</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const TH: React.CSSProperties = {
  textAlign: 'left', padding: '7px 10px', borderBottom: '1px solid var(--tbl-border-strong)',
  fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--tbl-fg-mute)',
  whiteSpace: 'nowrap',
};
const THR: React.CSSProperties = { ...TH, textAlign: 'right' };
const TD: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid var(--tbl-border)', fontSize: 13, color: 'var(--tbl-fg)' };
const TDR: React.CSSProperties = { ...TD, textAlign: 'right', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' };
const TABLE: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', background: 'var(--tbl-bg)' };

function SrcTable({ rows }: { rows: { label: string; count: number; revenue: number; nights: number; cancelled: number }[] }) {
  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--tbl-border)', borderRadius: 6 }}>
      <table style={TABLE}>
        <thead>
          <tr>
            <th style={TH}>Source</th>
            <th style={THR}>Stays</th>
            <th style={THR}>Revenue</th>
            <th style={THR}>ADR/night</th>
            <th style={THR}>Avg LOS</th>
            <th style={THR}>Canx</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td style={TD}>{r.label}</td>
              <td style={TDR}>{r.count}</td>
              <td style={TDR}>{fmt$(r.revenue)}</td>
              <td style={TDR}>{r.nights > 0 ? fmt$(r.revenue / r.nights) : '—'}</td>
              <td style={TDR}>{r.count > 0 ? fmtN(r.nights / r.count) : '—'}n</td>
              <td style={TDR}>{r.cancelled}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PipelineTable({ rows }: { rows: ResRow[] }) {
  if (rows.length === 0) return <div style={{ padding: 16, color: 'var(--tbl-fg-mute)', fontSize: 13 }}>No upcoming retreats confirmed.</div>;
  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--tbl-border)', borderRadius: 6 }}>
      <table style={TABLE}>
        <thead>
          <tr>
            <th style={TH}>Check-in</th>
            <th style={TH}>Check-out</th>
            <th style={THR}>Nights</th>
            <th style={TH}>Source</th>
            <th style={TH}>Guest</th>
            <th style={THR}>Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.reservation_id}>
              <td style={TD}>{r.check_in_date}</td>
              <td style={TD}>{r.check_out_date}</td>
              <td style={TDR}>{r.nights}</td>
              <td style={TD}>{SRC_LABEL[r.source_name ?? ''] ?? r.source_name ?? '—'}</td>
              <td style={TD}>{r.guest_name ?? '—'}</td>
              <td style={TDR}>{fmt$(Number(r.total_amount ?? 0))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AddOnTable({ rows }: { rows: { desc: string; count: number; total: number }[] }) {
  if (rows.length === 0) return <div style={{ padding: 16, color: 'var(--tbl-fg-mute)', fontSize: 13 }}>No add-on charges found on retreat folios.</div>;
  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--tbl-border)', borderRadius: 6 }}>
      <table style={TABLE}>
        <thead>
          <tr>
            <th style={TH}>Item</th>
            <th style={THR}>Events</th>
            <th style={THR}>Total</th>
            <th style={THR}>Avg / event</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.desc}>
              <td style={TD}>{r.desc}</td>
              <td style={TDR}>{r.count}</td>
              <td style={TDR}>{fmt$(r.total)}</td>
              <td style={TDR}>{r.count > 0 ? fmt$(r.total / r.count) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function RetreatsPage({ propertyId }: Props) {
  const pid = propertyId ?? NAMKHAN_PID;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayIso = today.toISOString().slice(0, 10);

  // Fetch all retreat reservations from 2025 onwards (silver view)
  const { data: resData } = await supabase.schema('pms').from('v_reservations')
    .select('reservation_id, guest_name, check_in_date, check_out_date, nights, status_canonical, is_cancelled, source_name, rate_plan, total_amount')
    .eq('property_id', pid)
    .in('source_name', [...RETREAT_SOURCES])
    .gte('check_in_date', '2025-01-01')
    .order('check_in_date', { ascending: false });

  const all = (resData ?? []) as ResRow[];
  const confirmed = all.filter((r) => !r.is_cancelled);
  const retreatIds = all.map((r) => r.reservation_id);

  // Fetch add-on transactions for retreat folios (silver view)
  let addOns: TxRow[] = [];
  if (retreatIds.length > 0) {
    const { data: txData } = await supabase.schema('pms').from('v_transactions')
      .select('reservation_id, description, amount, service_date')
      .eq('property_id', pid)
      .eq('transaction_type', 'debit')
      .gt('amount', 0)
      .in('reservation_id', retreatIds);

    addOns = ((txData ?? []) as TxRow[]).filter(
      (tx) => !tx.description?.toLowerCase().startsWith('room rate'),
    );
  }

  // ── KPI computation ─────────────────────────────────────────────
  const ytdRevenue = confirmed.reduce((s, r) => s + Number(r.total_amount ?? 0), 0);
  const ytdNights = confirmed.reduce((s, r) => s + Number(r.nights ?? 0), 0);
  const ytdAdr = ytdNights > 0 ? ytdRevenue / ytdNights : 0;
  const avgLos = confirmed.length > 0 ? ytdNights / confirmed.length : 0;
  const cancelledCount = all.filter((r) => r.is_cancelled).length;
  const cancellationRate = all.length > 0 ? (cancelledCount / all.length) * 100 : 0;

  const addOnTotal = addOns.reduce((s, tx) => s + Number(tx.amount ?? 0), 0);
  const addOnPerStay = confirmed.length > 0 ? addOnTotal / confirmed.length : 0;

  // ── Source breakdown ─────────────────────────────────────────────
  const srcMap: Record<string, { count: number; revenue: number; nights: number; cancelled: number }> = {};
  for (const r of all) {
    const k = r.source_name ?? 'Unknown';
    if (!srcMap[k]) srcMap[k] = { count: 0, revenue: 0, nights: 0, cancelled: 0 };
    if (r.is_cancelled) { srcMap[k].cancelled += 1; continue; }
    srcMap[k].count += 1;
    srcMap[k].revenue += Number(r.total_amount ?? 0);
    srcMap[k].nights += Number(r.nights ?? 0);
  }
  const srcRows = Object.entries(srcMap)
    .map(([k, v]) => ({ label: SRC_LABEL[k] ?? k, ...v }))
    .sort((a, b) => b.revenue - a.revenue);

  // ── Monthly trend ────────────────────────────────────────────────
  const moMap: Record<string, { revenue: number; count: number }> = {};
  for (const r of confirmed) {
    const mo = r.check_in_date.slice(0, 7);
    if (!moMap[mo]) moMap[mo] = { revenue: 0, count: 0 };
    moMap[mo].revenue += Number(r.total_amount ?? 0);
    moMap[mo].count += 1;
  }
  const monthlyData = Object.entries(moMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, revenue: v.revenue, count: v.count }));

  // ── Add-on breakdown ─────────────────────────────────────────────
  const addOnMap: Record<string, { count: number; total: number }> = {};
  for (const tx of addOns) {
    const k = (tx.description ?? 'Unknown').trim();
    if (!addOnMap[k]) addOnMap[k] = { count: 0, total: 0 };
    addOnMap[k].count += 1;
    addOnMap[k].total += Number(tx.amount ?? 0);
  }
  const addOnRows = Object.entries(addOnMap)
    .map(([desc, v]) => ({ desc, ...v }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 15);

  // ── Pipeline ─────────────────────────────────────────────────────
  const upcoming = confirmed
    .filter((r) => r.check_in_date >= todayIso && r.status_canonical !== 'checked_out')
    .sort((a, b) => a.check_in_date.localeCompare(b.check_in_date))
    .slice(0, 12);

  // ── Tabs ─────────────────────────────────────────────────────────
  const tabs: DashboardTab[] = OPERATIONS_SUBPAGES.map((s) => ({
    key: s.href,
    label: s.label,
    href: s.href,
    active: s.href.includes('/operations/rooms'),
  })) as DashboardTab[];

  return (
    <DashboardPage
      title="Retreats"
      subtitle={`Operations · Departments · Retreats · ${confirmed.length} confirmed stays · property_id=${pid}`}
      tabs={tabs}
    >
      {/* KPI strip */}
      <Container title="Performance snapshot" subtitle="Retreat-channel bookings from 2025 · confirmed stays only" density="compact">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 12 }}>
          <KpiTile
            label="Revenue (all-time)"
            value={ytdRevenue}
            currency="USD"
            footnote={`${confirmed.length} stays confirmed`}
            status={ytdRevenue > 0 ? 'green' : 'grey'}
            size="sm"
          />
          <KpiTile
            label="Retreat ADR"
            value={ytdAdr}
            currency="USD"
            footnote="revenue ÷ room nights"
            status="grey"
            size="sm"
          />
          <KpiTile
            label="Avg LOS"
            value={`${fmtN(avgLos)}n`}
            footnote="nights per booking"
            status="grey"
            size="sm"
          />
          <KpiTile
            label="Add-on / stay"
            value={addOnPerStay}
            currency="USD"
            footnote="non-room folio charges"
            status={addOnPerStay > 0 ? 'green' : 'grey'}
            size="sm"
          />
          <KpiTile
            label="Cancellation rate"
            value={`${fmtN(cancellationRate, 0)}%`}
            footnote={`${cancelledCount} cancelled of ${all.length} total`}
            status={cancellationRate > 35 ? 'red' : 'grey'}
            size="sm"
          />
        </div>
      </Container>

      {/* Monthly trend */}
      <Container
        title="Monthly revenue trend"
        subtitle="Confirmed retreat stays by check-in month · 2025 onwards"
        density="compact"
      >
        <MonthlyBars data={monthlyData} />
      </Container>

      {/* Source breakdown */}
      <Container
        title="By booking channel"
        subtitle="Retreat Reseller = wholesale group packages · BookRetreats + Tripaneer = individual guests"
        density="compact"
      >
        <SrcTable rows={srcRows} />
      </Container>

      {/* Upcoming pipeline */}
      <Container
        title={`Upcoming pipeline${upcoming.length > 0 ? ` — ${upcoming.length} retreat${upcoming.length > 1 ? 's' : ''} confirmed` : ''}`}
        subtitle="Future check-ins · confirmed status · not yet checked out"
        density="compact"
      >
        <PipelineTable rows={upcoming} />
      </Container>

      {/* Add-on spend */}
      <Container
        title="Add-on spend"
        subtitle={`Non-room charges on retreat folios · total ${fmt$(addOnTotal)} · ${fmt$(addOnPerStay)}/stay`}
        density="compact"
      >
        <AddOnTable rows={addOnRows} />
      </Container>
    </DashboardPage>
  );
}
