// app/operations/retreats/page.tsx
// Retreats department analytics — 3 FIT programs (Harmony, Detox, Couples).
// FIT identification: OTA source (BookRetreats/Tripaneer) OR rate_plan contains
// program name OR folio has a retreat add-on product (Heart of Laos, Namkhan Balance, etc.)
// Group retreats (eVigeosport, Stone Throw, Fedex, etc.) → separate group page.

import { DashboardPage, Container, KpiTile, type DashboardTab } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '../_subpages';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NAMKHAN_PID = 260955;

// ── Program definitions ────────────────────────────────────────────────────────

const PROGRAMS = [
  {
    code: 'harmony_mindfulness' as const,
    name: 'Harmony & Mindfulness',
    pitch: 'Mindful escape · relaxation, cultural immersion, balanced wellness',
    pricingBasis: 'per person / night',
    minNights: 2, maxNights: 6,
    idealFor: 'Solo · Wellness · Spiritual seekers',
    essential: {
      pricePublic: 110, priceLpa: 94,
      inclusions: [
        'Half-board meals (plant-rich) — lunch or dinner',
        'Daily yoga, Qi Gong & meditation (join-in, 60 min)',
        'Holistic consultation',
        'Massages & spa rituals (60 min)',
        'Infinity pool, herbal sauna & ice bath',
      ],
    },
    immersion: {
      pricePublic: 190, priceLpa: 162,
      inclusions: [
        'Full-board meals (plant-rich) — lunch & dinner',
        'Daily yoga, Qi Gong & meditation (private, 60 min)',
        'Holistic consultation',
        'Massages & spa rituals (90 min)',
        'Cultural & nature activities',
        'Infinity pool, herbal sauna & ice bath',
      ],
    },
  },
  {
    code: 'detox' as const,
    name: 'Namkhan Detox',
    pitch: 'Complete body & mind reset · detox cuisine, restorative therapies',
    pricingBasis: 'per person / night',
    minNights: 2, maxNights: 6,
    idealFor: 'Detox seekers · Stress relief · Advanced wellness',
    essential: {
      pricePublic: 130, priceLpa: 111,
      inclusions: [
        'Full-board detox meals & herbal infusions',
        'Holistic consultation & wellness support',
        'Daily yoga, Qi Gong & meditation (join-in, 60 min)',
        'Spa therapies & healing rituals (60 min)',
        'Cultural & eco-farm workshops',
        'Herbal sauna, ice bath & infinity pool',
      ],
    },
    immersion: {
      pricePublic: 210, priceLpa: 179,
      inclusions: [
        'Full-board detox meals & herbal infusions',
        'Holistic consultation & wellness support',
        'Daily yoga, Qi Gong & meditation (private, 90 min)',
        'Spa therapies & healing rituals (90 min)',
        'Cultural & eco-farm workshops',
        'Herbal sauna, ice bath & infinity pool',
      ],
    },
  },
  {
    code: 'serene_couples' as const,
    name: 'Serene Couples',
    pitch: 'Romantic wellness escape · connection, relaxation, shared experiences',
    pricingBasis: 'per couple / night',
    minNights: 2, maxNights: 6,
    idealFor: 'Couples · Honeymooners · Anniversaries',
    essential: {
      pricePublic: 220, priceLpa: 187,
      inclusions: [
        'Half-board meals with riverside dining for two',
        'Couples spa rituals & private sessions (60 min)',
        'Daily yoga, meditation & Qi Gong (join-in, 60 min)',
        'Mindful workshops & cultural activities',
        'Infinity pool, herbal sauna & ice bath',
      ],
    },
    immersion: {
      pricePublic: 320, priceLpa: 272,
      inclusions: [
        'Full-board detox meals & herbal infusions',
        'Holistic consultation & wellness support',
        'Daily yoga, Qi Gong & meditation (private, 90 min)',
        'Spa therapies & healing rituals (90 min)',
        'Cultural & eco-farm workshops',
        'Herbal sauna, ice bath & infinity pool',
      ],
    },
  },
] as const;

type ProgramCode = typeof PROGRAMS[number]['code'];

// ── Retreat add-on product names (folio-level identification) ─────────────────
const RETREAT_ADDON_PATTERNS = [
  'heart of laos', 'namkhan balance', 'namkhan detox', 'namkhan harmony',
  'serene couples', 'retreat package',
];

// ── Sources ───────────────────────────────────────────────────────────────────
const FIT_OTA_SOURCES = ['BookRetreats', 'Book Yoga Retreats by Tripaneer'] as const;
const BROAD_SOURCES = [...FIT_OTA_SOURCES, 'Website/Booking Engine', 'Email'] as const;

function isFitRetreat(
  sourceName: string | null,
  ratePlan: string | null,
  addonIds: Set<string>,
  reservationId: string,
): boolean {
  if (FIT_OTA_SOURCES.includes(sourceName as typeof FIT_OTA_SOURCES[number])) return true;
  const rp = (ratePlan ?? '').toLowerCase();
  if (rp.includes('(essential)') || rp.includes('(immersion)')) return true;
  if (addonIds.has(reservationId)) return true;
  return false;
}

function getProgramCode(ratePlan: string | null): ProgramCode | null {
  const rp = (ratePlan ?? '').toLowerCase();
  if (rp.includes('harmony') || rp.includes('mindfulness')) return 'harmony_mindfulness';
  if (rp.includes('detox')) return 'detox';
  if (rp.includes('couples')) return 'serene_couples';
  return null;
}

function getTier(ratePlan: string | null): 'essential' | 'immersion' | null {
  const rp = (ratePlan ?? '').toLowerCase();
  if (rp.includes('essential')) return 'essential';
  if (rp.includes('immersion')) return 'immersion';
  return null;
}

function getPackageUpcharge(code: ProgramCode | null, tier: 'essential' | 'immersion' | null): number {
  if (!code || !tier) return 0;
  const p = PROGRAMS.find((prog) => prog.code === code);
  if (!p) return 0;
  return p[tier].pricePublic;
}

function getProgramName(ratePlan: string | null, sourceName: string | null): string {
  const code = getProgramCode(ratePlan);
  if (code) return PROGRAMS.find((p) => p.code === code)!.name;
  if (FIT_OTA_SOURCES.includes(sourceName as typeof FIT_OTA_SOURCES[number])) return 'OTA (unattributed)';
  return 'Add-on identified';
}

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Formatters ────────────────────────────────────────────────────────────────

const fmt$ = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const fmtN = (n: number, d = 1) => n.toFixed(d);

// ── Shared table styles (cockpit-native tokens — black on white) ──────────────

const INK   = 'var(--ink, #1B1B1B)';
const SOFT  = 'var(--ink-soft, #5A5A5A)';
const PAPER = 'var(--paper, #FFFFFF)';
const LINE  = 'var(--hairline, #E6DFCC)';
const LINE2 = 'var(--hairline-strong, #CCBFA0)';

const TH: React.CSSProperties = {
  textAlign: 'left', padding: '7px 10px',
  borderBottom: `1px solid ${LINE2}`,
  fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em',
  color: SOFT, whiteSpace: 'nowrap',
};
const THR: React.CSSProperties = { ...TH, textAlign: 'right' };
const TD: React.CSSProperties = {
  padding: '8px 10px', borderBottom: `1px solid ${LINE}`,
  fontSize: 13, color: INK, verticalAlign: 'top',
};
const TDR: React.CSSProperties = {
  ...TD, textAlign: 'right',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
};
const TABLE: React.CSSProperties = {
  width: '100%', borderCollapse: 'collapse', background: PAPER,
};

// ── Sub-components (module scope — avoids RSC digest crash) ───────────────────

function ProgramPanel({ p, last }: { p: typeof PROGRAMS[number]; last?: boolean }) {
  return (
    <div style={{
      flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10,
      paddingRight: last ? 0 : 20,
      borderRight: last ? 'none' : `1px solid ${LINE}`,
    }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 13, color: INK, marginBottom: 2 }}>{p.name}</div>
        <div style={{ fontSize: 11, color: SOFT, lineHeight: 1.5 }}>{p.pitch}</div>
        <div style={{ fontSize: 10, color: SOFT, marginTop: 3 }}>
          {p.idealFor} · {p.minNights}–{p.maxNights}n · {p.pricingBasis}
        </div>
      </div>

      <table style={{ ...TABLE, fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ ...TH, fontSize: 10 }}>Tier</th>
            <th style={{ ...THR, fontSize: 10 }}>Public</th>
            <th style={{ ...THR, fontSize: 10 }}>LPA</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ ...TD, fontSize: 12 }}>Essential</td>
            <td style={TDR}>{fmt$(p.essential.pricePublic)}</td>
            <td style={{ ...TDR, color: SOFT }}>{fmt$(p.essential.priceLpa)}</td>
          </tr>
          <tr>
            <td style={{ ...TD, fontSize: 12, borderBottom: 'none' }}>Immersion</td>
            <td style={{ ...TDR, borderBottom: 'none' }}>{fmt$(p.immersion.pricePublic)}</td>
            <td style={{ ...TDR, borderBottom: 'none', color: SOFT }}>{fmt$(p.immersion.priceLpa)}</td>
          </tr>
        </tbody>
      </table>

      <div>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: SOFT, marginBottom: 4 }}>Essential</div>
        <ul style={{ margin: 0, padding: '0 0 0 14px', fontSize: 11, color: INK, lineHeight: 1.7 }}>
          {p.essential.inclusions.map((inc, i) => <li key={i}>{inc}</li>)}
        </ul>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: SOFT, margin: '8px 0 4px' }}>Immersion</div>
        <ul style={{ margin: 0, padding: '0 0 0 14px', fontSize: 11, color: INK, lineHeight: 1.7 }}>
          {p.immersion.inclusions.map((inc, i) => <li key={i}>{inc}</li>)}
        </ul>
      </div>
    </div>
  );
}

function ProgramBreakdownTable({
  rows,
}: {
  rows: { code: ProgramCode | null; count: number; revenue: number; nights: number; cancelled: number }[];
}) {
  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--hairline, #E6DFCC)', borderRadius: 6 }}>
      <table style={TABLE}>
        <thead>
          <tr>
            <th style={TH}>Program</th>
            <th style={THR}>Stays</th>
            <th style={THR}>Revenue</th>
            <th style={THR}>ADR / night</th>
            <th style={THR}>Avg LOS</th>
            <th style={THR}>Canx</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const label = r.code ? PROGRAMS.find((p) => p.code === r.code)!.name : 'OTA / unattributed';
            return (
              <tr key={label}>
                <td style={TD}>{label}</td>
                <td style={TDR}>{r.count}</td>
                <td style={TDR}>{r.revenue > 0 ? fmt$(r.revenue) : '—'}</td>
                <td style={TDR}>{r.nights > 0 ? fmt$(r.revenue / r.nights) : '—'}</td>
                <td style={TDR}>{r.count > 0 ? fmtN(r.nights / r.count) : '—'}n</td>
                <td style={TDR}>{r.cancelled}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MonthlyBars({ data }: { data: { month: string; revenue: number; count: number }[] }) {
  if (data.length === 0) {
    return <div style={{ padding: 20, color: 'var(--ink-soft, #5A5A5A)', fontSize: 13 }}>No stays recorded yet.</div>;
  }
  const max = Math.max(...data.map((d) => d.revenue), 1);
  const barW = 48, gap = 14, chartH = 130, padT = 24, padB = 36;
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
              <rect x={x} y={y} width={barW} height={h} fill="#6B7B6E" rx={2} />
              <text x={x + barW / 2} y={padT + chartH + 14} textAnchor="middle" fontSize="10" fill="var(--ink-soft, #5A5A5A)">{lbl}</text>
              {d.count > 0 && (
                <text x={x + barW / 2} y={padT + chartH + 26} textAnchor="middle" fontSize="9" fill="var(--ink-soft, #5A5A5A)">{d.count}st</text>
              )}
              {d.revenue > 0 && (
                <text x={x + barW / 2} y={y - 5} textAnchor="middle" fontSize="9" fill="var(--ink, #1B1B1B)">{fmt$(d.revenue)}</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function BookingFeed({ rows }: { rows: ResRow[] }) {
  if (rows.length === 0) return (
    <div style={{ padding: 16, color: 'var(--ink-soft, #5A5A5A)', fontSize: 13 }}>No retreat bookings found.</div>
  );
  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--hairline, #E6DFCC)', borderRadius: 6 }}>
      <table style={TABLE}>
        <thead>
          <tr>
            <th style={TH}>Check-in</th>
            <th style={TH}>Guest</th>
            <th style={TH}>Program</th>
            <th style={TH}>Tier</th>
            <th style={THR}>Nights</th>
            <th style={TH}>Source</th>
            <th style={THR}>Value</th>
            <th style={TH}>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const tier = getTier(r.rate_plan);
            const cancelled = r.is_cancelled;
            const muteStyle: React.CSSProperties = cancelled
              ? { color: 'var(--ink-soft, #5A5A5A)', textDecoration: 'line-through' }
              : {};
            return (
              <tr key={r.reservation_id}>
                <td style={{ ...TD, ...muteStyle }}>{r.check_in_date}</td>
                <td style={{ ...TD, ...muteStyle }}>{r.guest_name ?? '—'}</td>
                <td style={{ ...TD, ...muteStyle }}>{getProgramName(r.rate_plan, r.source_name)}</td>
                <td style={{ ...TD, fontSize: 12, color: 'var(--ink-soft, #5A5A5A)', textTransform: 'capitalize' }}>
                  {tier ?? '—'}
                </td>
                <td style={{ ...TDR, ...muteStyle }}>{r.nights}</td>
                <td style={{ ...TD, fontSize: 12, color: 'var(--ink-soft, #5A5A5A)' }}>{r.source_name ?? '—'}</td>
                <td style={{ ...TDR, ...muteStyle }}>
                  {Number(r.total_amount ?? 0) > 0 ? fmt$(Number(r.total_amount)) : '—'}
                </td>
                <td style={{ ...TD, fontSize: 12, color: cancelled ? 'var(--ink-soft, #5A5A5A)' : 'var(--ink, #1B1B1B)' }}>
                  {cancelled ? 'Cancelled' : r.status_canonical ?? '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RevenueSplitTable({
  rows,
  totalPackage,
  totalRoom,
  totalExtra,
}: {
  rows: { label: string; stays: number; total: number; packageRev: number; roomRev: number; extraRev: number; nights: number }[];
  totalPackage: number;
  totalRoom: number;
  totalExtra: number;
}) {
  const grandTotal = totalPackage + totalRoom + totalExtra;
  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--hairline, #E6DFCC)', borderRadius: 6 }}>
      <table style={TABLE}>
        <thead>
          <tr>
            <th style={TH}>Program · Tier</th>
            <th style={THR}>Stays</th>
            <th style={THR}>Nights</th>
            <th style={THR}>Total revenue</th>
            <th style={THR}>Package (F&B + Spa)</th>
            <th style={THR}>Room</th>
            <th style={THR}>Extra spend</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td style={TD}>{r.label}</td>
              <td style={TDR}>{r.stays}</td>
              <td style={TDR}>{r.nights}</td>
              <td style={TDR}>{r.total > 0 ? fmt$(r.total) : '—'}</td>
              <td style={TDR}>{r.packageRev > 0 ? fmt$(r.packageRev) : '—'}</td>
              <td style={TDR}>{r.roomRev > 0 ? fmt$(r.roomRev) : '—'}</td>
              <td style={{ ...TDR, color: 'var(--ink-soft, #5A5A5A)' }}>{r.extraRev > 0 ? fmt$(r.extraRev) : '—'}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: '1px solid var(--hairline-strong, #CCBFA0)' }}>
            <td colSpan={3} style={{ ...TD, fontWeight: 600, fontSize: 12, borderBottom: 'none' }}>Total</td>
            <td style={{ ...TDR, fontWeight: 600, borderBottom: 'none' }}>{fmt$(grandTotal)}</td>
            <td style={{ ...TDR, fontWeight: 600, borderBottom: 'none' }}>
              {fmt$(totalPackage)}
              <span style={{ fontSize: 10, color: 'var(--ink-soft, #5A5A5A)', marginLeft: 4 }}>
                ({grandTotal > 0 ? Math.round((totalPackage / grandTotal) * 100) : 0}%)
              </span>
            </td>
            <td style={{ ...TDR, fontWeight: 600, borderBottom: 'none' }}>
              {fmt$(totalRoom)}
              <span style={{ fontSize: 10, color: 'var(--ink-soft, #5A5A5A)', marginLeft: 4 }}>
                ({grandTotal > 0 ? Math.round((totalRoom / grandTotal) * 100) : 0}%)
              </span>
            </td>
            <td style={{ ...TDR, fontWeight: 600, color: 'var(--ink-soft, #5A5A5A)', borderBottom: 'none' }}>
              {fmt$(totalExtra)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function AddOnTable({ rows }: { rows: { desc: string; count: number; total: number }[] }) {
  if (rows.length === 0) return (
    <div style={{ padding: 16, color: 'var(--ink-soft, #5A5A5A)', fontSize: 13 }}>No add-on charges on retreat folios.</div>
  );
  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--hairline, #E6DFCC)', borderRadius: 6 }}>
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

// ── Page ──────────────────────────────────────────────────────────────────────

interface Props {
  propertyId?: number;
}

export default async function RetreatsPage({ propertyId }: Props) {
  const pid = propertyId ?? NAMKHAN_PID;

  // Step 1: find reservation IDs identified by retreat add-on products on the folio
  const { data: addonTxData } = await supabase.schema('pms').from('v_transactions')
    .select('reservation_id, description')
    .eq('property_id', pid)
    .eq('transaction_type', 'debit')
    .gt('amount', 0)
    .gte('service_date', '2025-01-01');

  const addonReservationIds = new Set<string>(
    ((addonTxData ?? []) as { reservation_id: string; description: string | null }[])
      .filter((tx) => {
        const desc = (tx.description ?? '').toLowerCase();
        return RETREAT_ADDON_PATTERNS.some((p) => desc.includes(p));
      })
      .map((tx) => tx.reservation_id)
  );

  // Step 2: fetch reservations from known retreat sources + any add-on-identified ones
  const { data: resData } = await supabase.schema('pms').from('v_reservations')
    .select('reservation_id, guest_name, check_in_date, check_out_date, nights, status_canonical, is_cancelled, source_name, rate_plan, total_amount')
    .eq('property_id', pid)
    .in('source_name', [...BROAD_SOURCES])
    .gte('check_in_date', '2025-01-01')
    .order('check_in_date', { ascending: false });

  const fitAll = ((resData ?? []) as ResRow[]).filter((r) =>
    isFitRetreat(r.source_name, r.rate_plan, addonReservationIds, r.reservation_id)
  );
  const fitConfirmed = fitAll.filter((r) => !r.is_cancelled);
  const fitIds = fitAll.map((r) => r.reservation_id);

  // Step 3: add-on transactions for FIT folios (for spend breakdown)
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

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const fitRevenue = fitConfirmed.reduce((s, r) => s + Number(r.total_amount ?? 0), 0);
  const fitNights = fitConfirmed.reduce((s, r) => s + Number(r.nights ?? 0), 0);
  const fitAdr = fitNights > 0 ? fitRevenue / fitNights : 0;
  const fitAvgLos = fitConfirmed.length > 0 ? fitNights / fitConfirmed.length : 0;
  const fitCancelled = fitAll.filter((r) => r.is_cancelled).length;
  const fitCancRate = fitAll.length > 0 ? (fitCancelled / fitAll.length) * 100 : 0;
  const addOnTotal = addOns.reduce((s, tx) => s + Number(tx.amount ?? 0), 0);
  const addOnPerStay = fitConfirmed.length > 0 ? addOnTotal / fitConfirmed.length : 0;

  // ── Revenue split: room vs. retreat package ───────────────────────────────
  // Package upcharge per night = pricePublic from PROGRAMS constants.
  // Room component = total_amount - (upcharge × nights).
  // Extra spend = non-room folio charges (add-ons beyond the package).
  const splitKey = (code: ProgramCode | null, tier: 'essential' | 'immersion' | null) =>
    `${code ?? 'other'}::${tier ?? 'unknown'}`;

  const splitMap: Record<string, {
    label: string; stays: number; nights: number;
    total: number; packageRev: number; roomRev: number; extraRev: number;
  }> = {};

  const addOnByRes: Record<string, number> = {};
  for (const tx of addOns) {
    addOnByRes[tx.reservation_id] = (addOnByRes[tx.reservation_id] ?? 0) + Number(tx.amount ?? 0);
  }

  for (const r of fitConfirmed) {
    const code = getProgramCode(r.rate_plan);
    const tier = getTier(r.rate_plan);
    const key = splitKey(code, tier);
    const upcharge = getPackageUpcharge(code, tier);
    const nights = Number(r.nights ?? 0);
    const total = Number(r.total_amount ?? 0);
    const packageRev = upcharge * nights;
    const roomRev = Math.max(0, total - packageRev);
    const extraRev = addOnByRes[r.reservation_id] ?? 0;

    let label: string;
    if (code && tier) {
      label = `${PROGRAMS.find((p) => p.code === code)!.name} · ${tier.charAt(0).toUpperCase() + tier.slice(1)}`;
    } else if (code) {
      label = `${PROGRAMS.find((p) => p.code === code)!.name} · tier unknown`;
    } else {
      label = 'OTA / unattributed';
    }

    if (!splitMap[key]) splitMap[key] = { label, stays: 0, nights: 0, total: 0, packageRev: 0, roomRev: 0, extraRev: 0 };
    splitMap[key].stays += 1;
    splitMap[key].nights += nights;
    splitMap[key].total += total;
    splitMap[key].packageRev += packageRev;
    splitMap[key].roomRev += roomRev;
    splitMap[key].extraRev += extraRev;
  }

  // Order: known programs first in PROGRAMS order × tier, then other
  const splitRows = [
    ...PROGRAMS.flatMap((p) =>
      (['essential', 'immersion'] as const).map((tier) => splitMap[splitKey(p.code, tier)]).filter(Boolean)
    ),
    ...(splitMap[splitKey(null, null)] ? [splitMap[splitKey(null, null)]] : []),
  ];
  const totalPackageRev = splitRows.reduce((s, r) => s + r.packageRev, 0);
  const totalRoomRev = splitRows.reduce((s, r) => s + r.roomRev, 0);
  const totalExtraRev = splitRows.reduce((s, r) => s + r.extraRev, 0);

  // ── Program breakdown ─────────────────────────────────────────────────────
  const progMap: Record<string, { code: ProgramCode | null; count: number; revenue: number; nights: number; cancelled: number }> = {};
  for (const r of fitAll) {
    const code = getProgramCode(r.rate_plan);
    const key = code ?? '__other__';
    if (!progMap[key]) progMap[key] = { code, count: 0, revenue: 0, nights: 0, cancelled: 0 };
    if (r.is_cancelled) { progMap[key].cancelled += 1; continue; }
    progMap[key].count += 1;
    progMap[key].revenue += Number(r.total_amount ?? 0);
    progMap[key].nights += Number(r.nights ?? 0);
  }
  const progRows = [
    ...PROGRAMS.map((p) => progMap[p.code] ?? { code: p.code, count: 0, revenue: 0, nights: 0, cancelled: 0 }),
    ...(progMap['__other__'] ? [progMap['__other__']] : []),
  ];

  // ── Monthly trend ─────────────────────────────────────────────────────────
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

  // ── Add-on spend ──────────────────────────────────────────────────────────
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
      subtitle={`Operations · Departments · Retreats · ${fitConfirmed.length} confirmed stays · property_id=${pid}`}
      tabs={tabs}
    >
      {/* ── 3 programs in one row ── */}
      <Container
        title="FIT retreat programs"
        subtitle="Three programs, two tiers each · all rates per night incl. 10% SC + 10% VAT · peak season excluded"
        density="compact"
      >
        <div style={{ display: 'flex', flexDirection: 'row', gap: 0, width: '100%', alignItems: 'flex-start' }}>
          {PROGRAMS.map((p, i) => (
            <ProgramPanel key={p.code} p={p} last={i === PROGRAMS.length - 1} />
          ))}
        </div>
      </Container>

      {/* ── KPIs ── */}
      <Container
        title="FIT performance"
        subtitle={`All FIT retreat bookings · website, email & OTA · from 2025`}
        density="compact"
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 12 }}>
          <KpiTile label="FIT revenue" value={fitRevenue} currency="USD"
            footnote={`${fitConfirmed.length} confirmed stays`}
            status={fitRevenue > 0 ? 'green' : 'grey'} size="sm" />
          <KpiTile label="ADR / night" value={fitAdr} currency="USD"
            footnote="revenue ÷ room nights" status="grey" size="sm" />
          <KpiTile label="Avg LOS" value={`${fmtN(fitAvgLos)}n`}
            footnote="nights per stay" status="grey" size="sm" />
          <KpiTile label="Add-on / stay" value={addOnPerStay} currency="USD"
            footnote="non-room folio charges"
            status={addOnPerStay > 0 ? 'green' : 'grey'} size="sm" />
          <KpiTile label="Cancellation rate" value={`${fmtN(fitCancRate, 0)}%`}
            footnote={`${fitCancelled} canx of ${fitAll.length} total`}
            status={fitCancRate > 35 ? 'red' : 'grey'} size="sm" />
          <KpiTile label="Package revenue" value={totalPackageRev} currency="USD"
            footnote={`${fitRevenue > 0 ? Math.round((totalPackageRev / fitRevenue) * 100) : 0}% of total — F&B + Spa + Activities`}
            status={totalPackageRev > 0 ? 'green' : 'grey'} size="sm" />
          <KpiTile label="Room revenue (retreats)" value={totalRoomRev} currency="USD"
            footnote={`${fitRevenue > 0 ? Math.round((totalRoomRev / fitRevenue) * 100) : 0}% of total — accommodation only`}
            status="grey" size="sm" />
        </div>
      </Container>

      {/* ── Revenue split ── */}
      <Container
        title="Revenue split — room vs. retreat package"
        subtitle={`Package upcharge = program price from rate plan · currently all posts to Rooms in Cloudbeds · ${fmt$(totalPackageRev)} is overcrediting Rooms`}
        density="compact"
      >
        <RevenueSplitTable
          rows={splitRows}
          totalPackage={totalPackageRev}
          totalRoom={totalRoomRev}
          totalExtra={totalExtraRev}
        />
      </Container>

      {/* ── By program ── */}
      <Container
        title="By program"
        subtitle="Revenue and stays split by retreat program"
        density="compact"
      >
        <ProgramBreakdownTable rows={progRows} />
      </Container>

      {/* ── Monthly trend ── */}
      <Container title="Monthly revenue" subtitle="Confirmed FIT stays by check-in month · 2025 onwards" density="compact">
        <MonthlyBars data={monthlyData} />
      </Container>

      {/* ── Booking feed ── */}
      <Container
        title={`All retreat bookings — ${fitAll.length} total`}
        subtitle="Every booking identified by rate plan or folio add-on · cancelled shown struck-through"
        density="compact"
      >
        <BookingFeed rows={fitAll} />
      </Container>

      {/* ── Add-on spend ── */}
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
