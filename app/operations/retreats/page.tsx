// app/operations/retreats/page.tsx
// Retreats department analytics — 3 FIT programs + eVigeosport group channel.
// FIT: BookRetreats + Tripaneer (individual guests, Retreat Packages Base Rate).
// Group: eVigeosport (multi-room blocks, Group Rate — separate business model).
// Program catalog inlined: marketing.retreat_programs/pricing not PostgREST-exposed.

import { DashboardPage, Container, KpiTile, type DashboardTab } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '../_subpages';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NAMKHAN_PID = 260955;

// ── Program catalog (source: marketing.retreat_programs / marketing.retreat_pricing) ──

type ProgramTier = {
  label: string;
  inclusions: string[];
  pricePublic: number;
  priceLpa: number;
};

type Program = {
  code: string;
  name: string;
  pitch: string;
  minNights: number;
  maxNights: number;
  pricingBasis: string;
  idealFor: string[];
  essential: ProgramTier;
  immersion: ProgramTier;
};

const PROGRAMS: Program[] = [
  {
    code: 'harmony_mindfulness',
    name: 'Harmony & Mindfulness',
    pitch: 'A mindful escape blending relaxation, cultural immersion, and balanced wellness',
    minNights: 2, maxNights: 6,
    pricingBasis: 'per person / night',
    idealFor: ['Solo travelers', 'Wellness seekers', 'Spiritual seekers'],
    essential: {
      label: 'Essential',
      inclusions: [
        'Half-board meals (plant-rich, wellness-focused) — lunch or dinner',
        'Daily yoga, Qi Gong & meditation (join-in, 60 min)',
        'Holistic consultation with wellness team',
        'Massages & spa rituals (60 min)',
        'Infinity pool, herbal sauna & ice bath',
      ],
      pricePublic: 110, priceLpa: 94,
    },
    immersion: {
      label: 'Immersion',
      inclusions: [
        'Full-board meals (plant-rich, wellness-focused) — lunch & dinner',
        'Daily yoga, Qi Gong & meditation (private, 60 min)',
        'Holistic consultation with wellness team',
        'Massages & spa rituals (90 min)',
        'Cultural & nature-based activities (subject to availability)',
        'Infinity pool, herbal sauna & ice bath',
      ],
      pricePublic: 190, priceLpa: 162,
    },
  },
  {
    code: 'detox',
    name: 'Namkhan Detox',
    pitch: 'A complete reset for body and mind — detox cuisine, restorative therapies, holistic healing',
    minNights: 2, maxNights: 6,
    pricingBasis: 'per person / night',
    idealFor: ['Detox seekers', 'Stress relief', 'Advanced wellness'],
    essential: {
      label: 'Essential',
      inclusions: [
        'Full-board detox meals (lunch & dinner) & herbal infusions',
        'Holistic consultation & wellness support',
        'Daily yoga, Qi Gong & meditation (join-in, 60 min)',
        'Spa therapies & natural healing rituals (60 min)',
        'Cultural experiences & eco-farm workshops (subject to availability)',
        'Herbal sauna, ice bath & infinity pool',
      ],
      pricePublic: 130, priceLpa: 111,
    },
    immersion: {
      label: 'Immersion',
      inclusions: [
        'Full-board detox meals (lunch & dinner) & herbal infusions',
        'Holistic consultation & wellness support',
        'Daily yoga, Qi Gong & meditation (private, 90 min)',
        'Spa therapies & natural healing rituals (90 min)',
        'Cultural experiences & eco-farm workshops (subject to availability)',
        'Herbal sauna, ice bath & infinity pool',
      ],
      pricePublic: 210, priceLpa: 179,
    },
  },
  {
    code: 'serene_couples',
    name: 'Serene Couples',
    pitch: 'A romantic wellness escape for connection, relaxation, and shared experiences',
    minNights: 2, maxNights: 6,
    pricingBasis: 'per couple / night',
    idealFor: ['Couples', 'Honeymooners', 'Anniversary celebrants'],
    essential: {
      label: 'Essential',
      inclusions: [
        'Half-board meals with riverside dining for a couple',
        'Couples spa rituals & private sessions (60 min)',
        'Daily yoga, meditation & Qi Gong (join-in, 60 min)',
        'Mindful workshops & cultural activities',
        'Infinity pool, herbal sauna & ice bath',
        'Private time & shared moments in nature',
      ],
      pricePublic: 220, priceLpa: 187,
    },
    immersion: {
      label: 'Immersion',
      inclusions: [
        'Full-board detox meals (lunch & dinner) & herbal infusions',
        'Holistic consultation & wellness support',
        'Daily yoga, Qi Gong & meditation (private, 90 min)',
        'Spa therapies & natural healing rituals (90 min)',
        'Cultural experiences & eco-farm workshops (subject to availability)',
        'Herbal sauna, ice bath & infinity pool',
      ],
      pricePublic: 320, priceLpa: 272,
    },
  },
];

const FIT_SOURCES = ['BookRetreats', 'Book Yoga Retreats by Tripaneer'] as const;
const ALL_SOURCES = [...FIT_SOURCES] as const;

const SRC_SHORT: Record<string, string> = {
  BookRetreats: 'BookRetreats',
  'Book Yoga Retreats by Tripaneer': 'Tripaneer',
};

// ── Types ────────────────────────────────────────────────────────────────────

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
};

// ── Formatters ───────────────────────────────────────────────────────────────

const fmt$ = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const fmtN = (n: number, d = 1) => n.toFixed(d);

// ── Shared table styles ───────────────────────────────────────────────────────

const TH: React.CSSProperties = {
  textAlign: 'left', padding: '7px 10px',
  borderBottom: '1px solid var(--tbl-border-strong)',
  fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em',
  color: 'var(--tbl-fg-mute)', whiteSpace: 'nowrap',
};
const THR: React.CSSProperties = { ...TH, textAlign: 'right' };
const TD: React.CSSProperties = {
  padding: '8px 10px', borderBottom: '1px solid var(--tbl-border)',
  fontSize: 13, color: 'var(--tbl-fg)',
};
const TDR: React.CSSProperties = {
  ...TD, textAlign: 'right',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
};
const TABLE: React.CSSProperties = {
  width: '100%', borderCollapse: 'collapse', background: 'var(--tbl-bg)',
};

// ── Sub-components (module scope — avoids RSC digest crash) ──────────────────

function ProgramCard({ p }: { p: Program }) {
  return (
    <div style={{
      border: '1px solid var(--tbl-border)', borderRadius: 8,
      background: 'var(--tbl-bg)', overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--tbl-border)' }}>
        <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--tbl-fg)', marginBottom: 4 }}>
          {p.name}
        </div>
        <div style={{ fontSize: 12, color: 'var(--tbl-fg-mute)', marginBottom: 8 }}>{p.pitch}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={chip}>{p.minNights}–{p.maxNights} nights</span>
          <span style={chip}>{p.pricingBasis}</span>
          {p.idealFor.map((t) => <span key={t} style={chip}>{t}</span>)}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        {([p.essential, p.immersion] as ProgramTier[]).map((tier) => (
          <div key={tier.label} style={{
            padding: '12px 14px',
            borderRight: tier.label === 'Essential' ? '1px solid var(--tbl-border)' : 'none',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--tbl-fg-mute)', marginBottom: 8 }}>
              {tier.label}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--tbl-fg)', marginBottom: 2 }}>
              {fmt$(tier.pricePublic)}<span style={{ fontSize: 11, fontWeight: 400, color: 'var(--tbl-fg-mute)' }}> public</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--tbl-fg-mute)', marginBottom: 10 }}>
              {fmt$(tier.priceLpa)} LPA nett · incl. 10% SC + 10% VAT
            </div>
            <ul style={{ margin: 0, padding: '0 0 0 14px', fontSize: 12, color: 'var(--tbl-fg)', lineHeight: 1.6 }}>
              {tier.inclusions.map((inc, i) => <li key={i}>{inc}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

const chip: React.CSSProperties = {
  display: 'inline-block', padding: '2px 8px', borderRadius: 12,
  background: 'var(--tbl-bg-elev, var(--tbl-border))', fontSize: 11,
  color: 'var(--tbl-fg-mute)', border: '1px solid var(--tbl-border)',
};

function MonthlyBars({ data }: { data: { month: string; revenue: number; count: number }[] }) {
  if (data.length === 0) {
    return <div style={{ padding: 20, color: 'var(--tbl-fg-mute)', fontSize: 13 }}>No stays recorded yet.</div>;
  }
  const max = Math.max(...data.map((d) => d.revenue), 1);
  const barW = 52, gap = 18, chartH = 140, padT = 24, padB = 36;
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
                <text x={x + barW / 2} y={y - 5} textAnchor="middle" fontSize="9" fill="var(--tbl-fg)">{fmt$(d.revenue)}</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function SrcTable({ rows }: { rows: { label: string; count: number; revenue: number; nights: number; cancelled: number }[] }) {
  if (rows.length === 0) return <div style={{ padding: 16, color: 'var(--tbl-fg-mute)', fontSize: 13 }}>No bookings found.</div>;
  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--tbl-border)', borderRadius: 6 }}>
      <table style={TABLE}>
        <thead>
          <tr>
            <th style={TH}>Channel</th>
            <th style={THR}>Stays</th>
            <th style={THR}>Revenue</th>
            <th style={THR}>ADR / night</th>
            <th style={THR}>Avg LOS</th>
            <th style={THR}>Canx</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td style={TD}>{r.label}</td>
              <td style={TDR}>{r.count}</td>
              <td style={TDR}>{r.revenue > 0 ? fmt$(r.revenue) : '—'}</td>
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
            <th style={TH}>Channel</th>
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
              <td style={TD}>{SRC_SHORT[r.source_name ?? ''] ?? r.source_name ?? '—'}</td>
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
  if (rows.length === 0) return <div style={{ padding: 16, color: 'var(--tbl-fg-mute)', fontSize: 13 }}>No add-on charges on retreat folios.</div>;
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


// ── Page ─────────────────────────────────────────────────────────────────────

interface Props {
  propertyId?: number;
}

export default async function RetreatsPage({ propertyId }: Props) {
  const pid = propertyId ?? NAMKHAN_PID;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayIso = today.toISOString().slice(0, 10);

  // Fetch all retreat reservations — silver view
  const { data: resData } = await supabase.schema('pms').from('v_reservations')
    .select('reservation_id, guest_name, check_in_date, check_out_date, nights, status_canonical, is_cancelled, source_name, rate_plan, total_amount')
    .eq('property_id', pid)
    .in('source_name', [...ALL_SOURCES])
    .gte('check_in_date', '2025-01-01')
    .order('check_in_date', { ascending: false });

  const all = (resData ?? []) as ResRow[];

  const fitAll = all;
  const fitConfirmed = fitAll.filter((r) => !r.is_cancelled);

  // Fetch add-ons for FIT folios only (non-room charges)
  const fitIds = fitAll.map((r) => r.reservation_id);
  let addOns: TxRow[] = [];
  if (fitIds.length > 0) {
    const { data: txData } = await supabase.schema('pms').from('v_transactions')
      .select('reservation_id, description, amount')
      .eq('property_id', pid)
      .eq('transaction_type', 'debit')
      .gt('amount', 0)
      .in('reservation_id', fitIds);

    addOns = ((txData ?? []) as TxRow[]).filter(
      (tx) => !tx.description?.toLowerCase().startsWith('room rate'),
    );
  }

  // ── FIT KPIs ─────────────────────────────────────────────────────────────
  const fitRevenue = fitConfirmed.reduce((s, r) => s + Number(r.total_amount ?? 0), 0);
  const fitNights = fitConfirmed.reduce((s, r) => s + Number(r.nights ?? 0), 0);
  const fitAdr = fitNights > 0 ? fitRevenue / fitNights : 0;
  const fitAvgLos = fitConfirmed.length > 0 ? fitNights / fitConfirmed.length : 0;
  const fitCancelled = fitAll.filter((r) => r.is_cancelled).length;
  const fitCancRate = fitAll.length > 0 ? (fitCancelled / fitAll.length) * 100 : 0;
  const addOnTotal = addOns.reduce((s, tx) => s + Number(tx.amount ?? 0), 0);
  const addOnPerStay = fitConfirmed.length > 0 ? addOnTotal / fitConfirmed.length : 0;

  // ── Channel breakdown (FIT) ───────────────────────────────────────────────
  const fitSrcMap: Record<string, { count: number; revenue: number; nights: number; cancelled: number }> = {};
  for (const r of fitAll) {
    const k = r.source_name ?? 'Unknown';
    if (!fitSrcMap[k]) fitSrcMap[k] = { count: 0, revenue: 0, nights: 0, cancelled: 0 };
    if (r.is_cancelled) { fitSrcMap[k].cancelled += 1; continue; }
    fitSrcMap[k].count += 1;
    fitSrcMap[k].revenue += Number(r.total_amount ?? 0);
    fitSrcMap[k].nights += Number(r.nights ?? 0);
  }
  const fitSrcRows = Object.entries(fitSrcMap)
    .map(([k, v]) => ({ label: SRC_SHORT[k] ?? k, ...v }))
    .sort((a, b) => b.revenue - a.revenue);

  // ── Monthly trend (FIT confirmed) ─────────────────────────────────────────
  const moMap: Record<string, { revenue: number; count: number }> = {};
  for (const r of fitConfirmed) {
    const mo = r.check_in_date.slice(0, 7);
    if (!moMap[mo]) moMap[mo] = { revenue: 0, count: 0 };
    moMap[mo].revenue += Number(r.total_amount ?? 0);
    moMap[mo].count += 1;
  }
  const monthlyData = Object.entries(moMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, revenue: v.revenue, count: v.count }));

  // ── Add-on breakdown ──────────────────────────────────────────────────────
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

  // ── Pipeline (FIT upcoming) ───────────────────────────────────────────────
  const upcoming = fitConfirmed
    .filter((r) => r.check_in_date >= todayIso && r.status_canonical !== 'checked_out')
    .sort((a, b) => a.check_in_date.localeCompare(b.check_in_date))
    .slice(0, 12);

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const tabs: DashboardTab[] = OPERATIONS_SUBPAGES.map((s) => ({
    key: s.href,
    label: s.label,
    href: s.href,
    active: s.href.includes('/operations/retreats'),
  })) as DashboardTab[];

  return (
    <DashboardPage
      title="Retreats"
      subtitle={`Operations · Departments · Retreats · ${fitConfirmed.length} FIT stays · property_id=${pid}`}
      tabs={tabs}
    >
      {/* ── Program catalog ── */}
      <Container
        title="FIT retreat programs"
        subtitle="Three programs, two tiers each · sold via BookRetreats & Tripaneer · Namkhan property settings"
        density="compact"
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16, padding: '4px 0' }}>
          {PROGRAMS.map((p) => (
            <ProgramCard key={p.code} p={p} />
          ))}
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--tbl-fg-mute)', fontStyle: 'italic' }}>
          All pricing per night · includes 10% service charge + 10% VAT · high and green seasons share same rate (2026–27) · peak season excluded
        </div>
      </Container>

      {/* ── FIT KPIs ── */}
      <Container
        title="FIT performance"
        subtitle={`Individual retreat bookings · BookRetreats + Tripaneer · confirmed stays 2025 onwards`}
        density="compact"
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 12 }}>
          <KpiTile
            label="FIT revenue"
            value={fitRevenue}
            currency="USD"
            footnote={`${fitConfirmed.length} confirmed stays`}
            status={fitRevenue > 0 ? 'green' : 'grey'}
            size="sm"
          />
          <KpiTile
            label="ADR / night"
            value={fitAdr}
            currency="USD"
            footnote="revenue ÷ room nights"
            status="grey"
            size="sm"
          />
          <KpiTile
            label="Avg LOS"
            value={`${fmtN(fitAvgLos)}n`}
            footnote="nights per FIT stay"
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
            value={`${fmtN(fitCancRate, 0)}%`}
            footnote={`${fitCancelled} canx of ${fitAll.length} total`}
            status={fitCancRate > 35 ? 'red' : 'grey'}
            size="sm"
          />
        </div>
      </Container>

      {/* ── Monthly trend ── */}
      <Container
        title="Monthly revenue trend"
        subtitle="FIT confirmed stays by check-in month · BookRetreats + Tripaneer · 2025 onwards"
        density="compact"
      >
        <MonthlyBars data={monthlyData} />
      </Container>

      {/* ── Channel breakdown ── */}
      <Container
        title="FIT channel breakdown"
        subtitle="BookRetreats vs Tripaneer — individual retreat guests"
        density="compact"
      >
        <SrcTable rows={fitSrcRows} />
      </Container>

      {/* ── Upcoming pipeline ── */}
      <Container
        title={`Upcoming pipeline${upcoming.length > 0 ? ` — ${upcoming.length} FIT retreat${upcoming.length > 1 ? 's' : ''} confirmed` : ''}`}
        subtitle="Future FIT check-ins · confirmed · not yet checked out"
        density="compact"
      >
        <PipelineTable rows={upcoming} />
      </Container>

      {/* ── Add-on spend ── */}
      <Container
        title="Add-on spend"
        subtitle={`Non-room charges on FIT folios · total ${fmt$(addOnTotal)} · ${fmt$(addOnPerStay)}/stay`}
        density="compact"
      >
        <AddOnTable rows={addOnRows} />
      </Container>

    </DashboardPage>
  );
}
