// app/finance/transactions/page.tsx
// Finance · Transactions — full Cloudbeds + POS transactions with KPI grouping + search.

import { DashboardPage } from '@/app/(cockpit)/_design';
import { FINANCE_SUBPAGES } from '../_subpages';
import KpiBox from '@/components/kpi/KpiBox';
// 2026-05-09: public.transactions has RLS blocking anon; use service role.
import { PROPERTY_ID } from '@/lib/supabase';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { fmtMoney } from '@/lib/format';
import CloudbedsReservationLink from '@/components/cloudbeds/CloudbedsReservationLink';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface Props { searchParams: Record<string, string | string[] | undefined>; }

const PAGE_SIZE = 200;

export default async function TransactionsPage({ searchParams }: Props) {
  const q       = (searchParams.q as string | undefined)?.trim() ?? '';
  const dept    = (searchParams.dept as string | undefined) ?? '';
  const txnType = (searchParams.type as string | undefined) ?? '';
  const catFilter = (searchParams.cat as string | undefined) ?? '';
  const since   = (searchParams.since as string | undefined) ??
                  new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const until   = (searchParams.until as string | undefined) ?? new Date().toISOString().slice(0, 10);
  const page    = Math.max(1, Number((searchParams.page as string | undefined) ?? '1'));
  const offset  = (page - 1) * PAGE_SIZE;

  // ---- KPIs (window-scoped to the date filter) ----
  const supabase = getSupabaseAdmin();
  const { data: kpiRows } = await supabase
    .from('transactions')
    .select('amount, transaction_type, category, usali_dept, item_category_name, transaction_date')
    .eq('property_id', PROPERTY_ID)
    .gte('transaction_date', since)
    .lte('transaction_date', until + 'T23:59:59')
    .limit(50000);

  const all = kpiRows ?? [];
  const totalCount  = all.length;
  const debits      = all.filter((r: any) => r.transaction_type === 'debit');
  const credits     = all.filter((r: any) => r.transaction_type === 'credit');
  const sales       = debits.filter((r: any) => !['tax', 'fee', 'void', 'adjustment'].includes(r.category));
  const taxes       = debits.filter((r: any) => r.category === 'tax');
  const payments    = credits.filter((r: any) => r.category === 'payment');
  const refunds     = credits.filter((r: any) => r.category === 'refund');
  const adjustments = debits.filter((r: any) => r.category === 'adjustment' || r.category === 'void');

  const sumAmt = (xs: any[]) => xs.reduce((s, r) => s + Number(r.amount || 0), 0);

  const fbCount    = all.filter((r: any) => r.usali_dept === 'F&B').length;
  const fbSales    = sumAmt(all.filter((r: any) => r.usali_dept === 'F&B' && r.transaction_type === 'debit'
                                                   && !['tax','fee','void','adjustment'].includes(r.category)));
  const roomsSales = sumAmt(all.filter((r: any) => r.usali_dept === 'Rooms' && r.transaction_type === 'debit'
                                                   && !['tax','fee','void','adjustment'].includes(r.category)));
  const otherSales = sumAmt(all.filter((r: any) => r.usali_dept === 'Other Operated' && r.transaction_type === 'debit'
                                                   && !['tax','fee','void','adjustment'].includes(r.category)));

  // ---- Listing query (filtered + paginated) ----
  // Drop count:'exact' — it triggers a HEAD-style row count that PostgREST
  // serves with a stale `Content-Range: */0` for some views, making the
  // page render an empty table. Keep an estimated count via planner.
  let listQ = supabase
    .from('transactions')
    .select('transaction_id, transaction_date, transaction_type, category, item_category_name, description, amount, currency, usali_dept, user_name, reservation_id, method, notes', { count: 'planned' })
    .eq('property_id', PROPERTY_ID)
    .gte('transaction_date', since)
    .lte('transaction_date', until + 'T23:59:59')
    .order('transaction_date', { ascending: false });

  if (dept)      listQ = listQ.eq('usali_dept', dept);
  if (txnType)   listQ = listQ.eq('transaction_type', txnType);
  if (catFilter) listQ = listQ.eq('category', catFilter);
  if (q) {
    listQ = listQ.or(
      [`description.ilike.%${q}%`, `item_category_name.ilike.%${q}%`,
       `user_name.ilike.%${q}%`, `reservation_id.ilike.%${q}%`].join(',')
    );
  }
  const { data: rows, count: rowCount } = await listQ.range(offset, offset + PAGE_SIZE - 1);
  const totalPages = Math.max(1, Math.ceil((rowCount ?? all.length) / PAGE_SIZE));

  // ─── Three daily controller series (PBS 2026-05-15) ─────────────────
  // A: Sales by department (stacked) — mix shifts visible day-by-day.
  // B: Payments vs Sales — daily reconciliation line.
  // C: Audit anomalies — voids · refunds · adjustments daily.
  type Day = {
    d: string;
    rooms: number; fb: number; spa: number; other: number; retail: number;
    sales: number; payments: number;
    voids: number; refunds: number; adjustments: number;
  };
  const byDayMap = new Map<string, Day>();
  for (const r of all as Array<{ transaction_date?: string; transaction_type?: string; category?: string; usali_dept?: string; item_category_name?: string; amount?: number }>) {
    const d = String(r.transaction_date || '').slice(0, 10);
    if (!d) continue;
    if (!byDayMap.has(d)) byDayMap.set(d, {
      d, rooms: 0, fb: 0, spa: 0, other: 0, retail: 0,
      sales: 0, payments: 0, voids: 0, refunds: 0, adjustments: 0,
    });
    const slot = byDayMap.get(d)!;
    const amt = Number(r.amount || 0);
    const isSale = r.transaction_type === 'debit'
      && !['tax', 'fee', 'void', 'adjustment'].includes(r.category ?? '');
    if (isSale) {
      slot.sales += amt;
      if (r.usali_dept === 'Rooms')                                                slot.rooms  += amt;
      else if (r.usali_dept === 'F&B')                                             slot.fb     += amt;
      else if (r.usali_dept === 'Retail')                                          slot.retail += amt;
      else if (r.usali_dept === 'Other Operated' && r.item_category_name === 'Spa') slot.spa    += amt;
      else                                                                         slot.other  += amt;
    }
    if (r.transaction_type === 'credit' && r.category === 'payment') slot.payments    += amt;
    if (r.category === 'void')                                       slot.voids       += amt;
    if (r.transaction_type === 'credit' && r.category === 'refund')  slot.refunds     += amt;
    if (r.category === 'adjustment')                                 slot.adjustments += amt;
  }
  const dailySeries: Day[] = Array.from(byDayMap.values()).sort((a, b) => a.d.localeCompare(b.d));

  // ─── Controller-grade aggregates ──────────────────────────────────
  // PBS 2026-05-15 re-scope: this page is the Cloudbeds folio AUDIT LEDGER —
  // POS-specific work moved to /finance/pos. Five questions only this page
  // answers (and we lead the KPI band with them):
  //   1) Did payments equal sales this period? (variance)
  //   2) Tax collected (for filings)
  //   3) Refund count + $ (audit)
  //   4) Void count + $ (audit)
  //   5) Per-reservation folio drill (table search)
  const salesUsd     = sumAmt(sales);
  const paymentsUsd  = sumAmt(payments);
  const taxUsd       = sumAmt(taxes);
  const refundsUsd   = sumAmt(refunds);
  const voids        = all.filter((r: any) => r.category === 'void');
  const voidsUsd     = sumAmt(voids);
  const variance     = paymentsUsd - salesUsd;        // positive = guests pre-paid; negative = AR forming
  const variancePct  = salesUsd !== 0 ? (variance / salesUsd) * 100 : 0;

  const txnEyebrow = [
    'Finance · Folio audit',
    `${since} → ${until}`,
    `${rowCount?.toLocaleString() ?? 0} rows`,
    `Sales ${fmtMoney(salesUsd, 'USD')} · Payments ${fmtMoney(paymentsUsd, 'USD')}`,
    `Variance ${variance >= 0 ? '+' : ''}${fmtMoney(variance, 'USD')} (${variancePct.toFixed(0)}%)`,
    `Tax ${fmtMoney(taxUsd, 'USD')}`,
    voids.length > 0 ? `${voids.length} voids` : null,
    q ? `q="${q}"` : null,
    dept ? `dept=${dept}` : null,
    txnType ? `type=${txnType}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <DashboardPage
      title="Transactions · folio audit"
      subtitle={txnEyebrow}
      tabs={FINANCE_SUBPAGES.map(s => ({ key: s.href, label: s.label, href: s.href, active: s.href === '/finance/acc' }))}
    >
      <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{
        margin: '8px 0 4px', padding: '8px 12px',
        fontSize: 'var(--t-sm)', color: 'var(--ink-soft)',
        background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)',
        borderLeft: '3px solid var(--brass)', borderRadius: 6,
      }}>
        Every monetary movement on the PMS folio — sales · payments · tax · refunds · voids.
        This is the audit trail behind P&L and the per-reservation drill surface.
        POS-side reconciliation (Poster ↔ PMS) lives on the{' '}
        <strong>POS</strong> tab above.
      </div>

      {/* ─── 1. Controller KPI band — leads with audit questions ────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <KpiBox label="Sales $"        unit="usd" value={salesUsd}    tooltip="Debits ex tax/fee/void/adjustment — what the property earned in the window." />
        <KpiBox label="Payments collected" unit="usd" value={paymentsUsd} tooltip="Credits · category=payment — cash actually received from guests + OTAs in the window." />
        <KpiBox label="Variance"       unit="usd" value={variance}    tooltip={`Payments − Sales. Positive: guests pre-paid (deposits inflate). Negative: AR is forming. ${variancePct.toFixed(0)}% of sales.`} />
        <KpiBox label="Tax collected"  unit="usd" value={taxUsd}      tooltip="Debits · category=tax — VAT / service charge — feeds the quarterly filing." />
        <KpiBox label="Refunds"        unit="count" value={refunds.length} tooltip={`${fmtMoney(refundsUsd, 'USD')} · Credits · category=refund. Audit who, when, why.`} />
        <KpiBox label="Voids"          unit="count" value={voids.length}   tooltip={`${fmtMoney(voidsUsd, 'USD')} · category=void. Audit by user_name in the table below.`} />
        <KpiBox label="Rooms · sales $" unit="usd" value={roomsSales} tooltip="usali_dept=Rooms — room-night postings." />
        <KpiBox label="F&B · sales $"  unit="usd" value={fbSales}    tooltip={`${fbCount} F&B transactions. POS reconciliation lives on /finance/pos.`} />
        <KpiBox label="Other Op $"     unit="usd" value={otherSales} tooltip="Spa, Cruise, Activities, Transport." />
      </div>

      {/* ─── 2. Filter form (acts as selector/dropdown row) ─────────── */}
      <form method="GET" className="panel" style={{ padding: 14, marginTop: 14 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ flex: '2 1 240px' }}>
            <span className="t-eyebrow" style={{ display: 'block', marginBottom: 4 }}>Search</span>
            <input
              type="search" name="q" defaultValue={q}
              placeholder="Description, guest, reservation_id, user…"
              style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--rule)', borderRadius: 4, font: 'inherit' }}
            />
          </label>
          <label>
            <span className="t-eyebrow" style={{ display: 'block', marginBottom: 4 }}>Dept</span>
            <select name="dept" defaultValue={dept} style={{ padding: '6px 10px', border: '1px solid var(--rule)', borderRadius: 4, font: 'inherit' }}>
              <option value="">All</option>
              <option value="Rooms">Rooms</option>
              <option value="F&B">F&amp;B</option>
              <option value="Other Operated">Other Operated</option>
              <option value="Retail">Retail</option>
              <option value="Tax">Tax</option>
              <option value="Fee">Fee</option>
              <option value="Misc Income">Misc Income</option>
            </select>
          </label>
          <label>
            <span className="t-eyebrow" style={{ display: 'block', marginBottom: 4 }}>Type</span>
            <select name="type" defaultValue={txnType} style={{ padding: '6px 10px', border: '1px solid var(--rule)', borderRadius: 4, font: 'inherit' }}>
              <option value="">All</option>
              <option value="debit">Debit</option>
              <option value="credit">Credit</option>
            </select>
          </label>
          <label>
            <span className="t-eyebrow" style={{ display: 'block', marginBottom: 4 }}>Category</span>
            <select name="cat" defaultValue={catFilter} style={{ padding: '6px 10px', border: '1px solid var(--rule)', borderRadius: 4, font: 'inherit' }}>
              <option value="">All categories</option>
              <option value="rate">Rate (room postings)</option>
              <option value="custom_item">F&amp;B / POS</option>
              <option value="product">Product / retail</option>
              <option value="payment">Payment</option>
              <option value="refund">Refund</option>
              <option value="void">Void</option>
              <option value="adjustment">Adjustment</option>
              <option value="tax">Tax</option>
              <option value="fee">Fee</option>
            </select>
          </label>
          <label>
            <span className="t-eyebrow" style={{ display: 'block', marginBottom: 4 }}>From</span>
            <input type="date" name="since" defaultValue={since} style={{ padding: '6px 10px', border: '1px solid var(--rule)', borderRadius: 4, font: 'inherit' }} />
          </label>
          <label>
            <span className="t-eyebrow" style={{ display: 'block', marginBottom: 4 }}>To</span>
            <input type="date" name="until" defaultValue={until} style={{ padding: '6px 10px', border: '1px solid var(--rule)', borderRadius: 4, font: 'inherit' }} />
          </label>
          <button type="submit" className="btn primary" style={{ height: 32 }}>Filter</button>
          <a href="/finance/transactions" className="btn">Reset</a>
        </div>
      </form>

      {/* ─── 3. Three controller graphs — side-by-side ─────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 12,
          marginTop: 14,
        }}
      >
        <SalesByDeptChart rows={dailySeries} />
        <PaymentsVsSalesChart rows={dailySeries} />
        <AuditAnomaliesChart rows={dailySeries} />
      </div>

      {/* ─── 4. Tables ──────────────────────────────────────────────── */}
      <div className="panel" style={{ marginTop: 14, overflowX: 'auto' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Category</th>
              <th>Item / Description</th>
              <th>Notes / reason</th>
              <th>Dept</th>
              <th>Reservation</th>
              <th>User</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r: any) => {
              const amt = Number(r.amount || 0);
              const negative = (r.transaction_type === 'credit') || amt < 0;
              return (
                <tr key={r.transaction_id}>
                  <td className="lbl text-mono">{(r.transaction_date || '').slice(0, 10)}</td>
                  <td><span className={`pill ${r.transaction_type === 'credit' ? 'good' : ''}`}>{r.transaction_type}</span></td>
                  <td className="lbl text-mute">{r.category || '—'}</td>
                  <td className="lbl">{r.item_category_name || r.description || '—'}</td>
                  <td className="lbl text-mute" style={{ maxWidth: 260, whiteSpace: 'normal' }}>
                    {r.notes || '—'}
                  </td>
                  <td className="lbl text-mute">{r.usali_dept || '—'}</td>
                  <td className="lbl"><CloudbedsReservationLink reservationId={r.reservation_id} /></td>
                  <td className="lbl text-mute">{r.user_name || '—'}</td>
                  <td className={`num ${negative ? 'var-amber' : ''}`}>{fmtMoney(amt, 'USD')}</td>
                </tr>
              );
            })}
            {(rows ?? []).length === 0 && (
              <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: 'var(--ink-mute)', fontStyle: 'italic' }}>No transactions match.</td></tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: 8, padding: 12, justifyContent: 'center', alignItems: 'center', fontSize: 'var(--t-sm)' }}>
            {page > 1 && (
              <a className="btn" href={buildUrl({ q, dept, type: txnType, cat: catFilter, since, until, page: page - 1 })}>← Prev</a>
            )}
            <span className="text-mute">Page {page} / {totalPages} · {rowCount?.toLocaleString()} rows</span>
            {page < totalPages && (
              <a className="btn" href={buildUrl({ q, dept, type: txnType, since, until, page: page + 1 })}>Next →</a>
            )}
          </div>
        )}
      </div>
      </div>
    </DashboardPage>
  );
}

function buildUrl(p: Record<string, string | number>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) {
    if (v !== '' && v != null) sp.set(k, String(v));
  }
  return `/finance/transactions?${sp.toString()}`;
}

// ─── 3 controller charts ───────────────────────────────────────────
// PBS 2026-05-15: "daily transaction volume" was confusing (count + sales
// mashed together). Replaced with 3 small graphs that each answer one
// controller question.

type DayRow = {
  d: string;
  rooms: number; fb: number; spa: number; other: number; retail: number;
  sales: number; payments: number;
  voids: number; refunds: number; adjustments: number;
};

function pct(part: number, whole: number): string {
  if (!whole) return '0%';
  return `${((part / whole) * 100).toFixed(0)}%`;
}
function dayLabel(d: string): string {
  const dt = new Date(d + 'T00:00:00');
  const weekday = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dt.getUTCDay()];
  return `${weekday} ${d.slice(5)}`;
}

const CARD: React.CSSProperties = {
  background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)',
  borderRadius: 8, padding: '14px 16px', minHeight: 240,
};

function ChartHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <>
      <div style={{ fontSize: 'var(--t-md)', fontWeight: 600 }}>{title}</div>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
        letterSpacing: 'var(--ls-loose)', color: 'var(--ink-mute)',
        textTransform: 'uppercase', marginBottom: 10,
      }}>
        {sub}
      </div>
    </>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-faint)', fontStyle: 'italic', fontSize: 'var(--t-sm)' }}>
      {label}
    </div>
  );
}

// CHART 1 · Daily sales by dept (stacked bars) — where the money came from each day
function SalesByDeptChart({ rows }: { rows: DayRow[] }) {
  if (rows.length === 0) return (
    <div style={CARD}>
      <ChartHeader title="Sales by department · daily" sub="Stacked: Rooms · F&B · Spa · Other Op · Retail" />
      <EmptyChart label="No sales in window" />
    </div>
  );
  const w = 480, h = 200, padL = 38, padR = 10, padT = 16, padB = 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const totals = rows.map((r) => r.rooms + r.fb + r.spa + r.other + r.retail);
  const max = Math.max(1, ...totals);
  const groupW = innerW / rows.length;
  const barW = Math.max(1, groupW - 1);
  const COLORS = {
    rooms:  'var(--brass, #C28F2C)',
    fb:     'var(--moss, #2D6A4F)',
    spa:    'var(--lavender, #8B7BB8)',
    other:  'var(--paper-deep, #8B7355)',
    retail: 'var(--st-warn, #D4A574)',
  };
  // Aggregate totals for legend + tooltip context
  const sumRooms  = rows.reduce((s, r) => s + r.rooms, 0);
  const sumFb     = rows.reduce((s, r) => s + r.fb, 0);
  const sumSpa    = rows.reduce((s, r) => s + r.spa, 0);
  const sumOther  = rows.reduce((s, r) => s + r.other, 0);
  const sumRetail = rows.reduce((s, r) => s + r.retail, 0);
  const totalPeriod = sumRooms + sumFb + sumSpa + sumOther + sumRetail;
  return (
    <div style={CARD}>
      <ChartHeader title="Sales by department · daily" sub={`Stacked · period total ${fmtMoney(totalPeriod, 'USD')}`} />
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 200 }}>
        <text x={4} y={padT + 6} style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--ink-mute)' }}>{fmtMoney(max, 'USD')}</text>
        <text x={4} y={padT + innerH} style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--ink-mute)' }}>$0</text>
        {rows.map((r, i) => {
          const x = padL + i * groupW + 0.5;
          const dayTotal = r.rooms + r.fb + r.spa + r.other + r.retail;
          const tooltip = [
            `${dayLabel(r.d)} · total ${fmtMoney(dayTotal, 'USD')}`,
            r.rooms  > 0 ? `Rooms ${fmtMoney(r.rooms, 'USD')} (${pct(r.rooms, dayTotal)})`    : null,
            r.fb     > 0 ? `F&B ${fmtMoney(r.fb, 'USD')} (${pct(r.fb, dayTotal)})`            : null,
            r.spa    > 0 ? `Spa ${fmtMoney(r.spa, 'USD')} (${pct(r.spa, dayTotal)})`          : null,
            r.retail > 0 ? `Retail ${fmtMoney(r.retail, 'USD')} (${pct(r.retail, dayTotal)})` : null,
            r.other  > 0 ? `Other Op ${fmtMoney(r.other, 'USD')} (${pct(r.other, dayTotal)})` : null,
          ].filter(Boolean).join('\n');
          const segments = [
            { v: r.rooms,  color: COLORS.rooms,  label: 'Rooms' },
            { v: r.fb,     color: COLORS.fb,     label: 'F&B' },
            { v: r.spa,    color: COLORS.spa,    label: 'Spa' },
            { v: r.other,  color: COLORS.other,  label: 'Other Op' },
            { v: r.retail, color: COLORS.retail, label: 'Retail' },
          ];
          let yCursor = padT + innerH;
          return segments.map((s, k) => {
            if (s.v <= 0) return null;
            const sh = (s.v / max) * innerH;
            yCursor -= sh;
            return (
              <rect key={`${r.d}-${k}`} x={x} y={yCursor} width={barW} height={sh} fill={s.color}>
                <title>{tooltip}</title>
              </rect>
            );
          });
        })}
        {rows.map((r, i) =>
          i % Math.max(1, Math.floor(rows.length / 6)) === 0 ? (
            <text key={`x-${r.d}`} x={padL + i * groupW + groupW / 2} y={h - 10} textAnchor="middle" style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--ink-mute)' }}>
              {r.d.slice(5)}
            </text>
          ) : null,
        )}
      </svg>
      <div style={{ marginTop: 4, display: 'flex', gap: 10, fontSize: 'var(--t-xs)', color: 'var(--ink-soft)', flexWrap: 'wrap' }}>
        <span title={`${pct(sumRooms,  totalPeriod)} of period`}><span style={{ color: COLORS.rooms }}>■</span> Rooms · {fmtMoney(sumRooms, 'USD')}</span>
        <span title={`${pct(sumFb,     totalPeriod)} of period`}><span style={{ color: COLORS.fb }}>■</span> F&B · {fmtMoney(sumFb, 'USD')}</span>
        <span title={`${pct(sumSpa,    totalPeriod)} of period`}><span style={{ color: COLORS.spa }}>■</span> Spa · {fmtMoney(sumSpa, 'USD')}</span>
        <span title={`${pct(sumOther,  totalPeriod)} of period`}><span style={{ color: COLORS.other }}>■</span> Other Op · {fmtMoney(sumOther, 'USD')}</span>
        <span title={`${pct(sumRetail, totalPeriod)} of period`}><span style={{ color: COLORS.retail }}>■</span> Retail · {fmtMoney(sumRetail, 'USD')}</span>
      </div>
    </div>
  );
}

// CHART 2 · Payments vs Sales (two lines) — daily reconciliation
function PaymentsVsSalesChart({ rows }: { rows: DayRow[] }) {
  if (rows.length === 0) return (
    <div style={CARD}>
      <ChartHeader title="Payments vs Sales · daily" sub="If lines diverge, AR or deposits are moving" />
      <EmptyChart label="No transactions in window" />
    </div>
  );
  const w = 480, h = 200, padL = 38, padR = 10, padT = 16, padB = 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const max = Math.max(1, ...rows.map((r) => Math.max(r.sales, r.payments)));
  const x = (i: number) => padL + (rows.length === 1 ? innerW / 2 : (i / (rows.length - 1)) * innerW);
  const y = (v: number) => padT + innerH - (v / max) * innerH;
  const path = (key: 'sales' | 'payments') =>
    rows.map((r, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(r[key]).toFixed(1)}`).join(' ');
  return (
    <div style={CARD}>
      <ChartHeader title="Payments vs Sales · daily" sub="Reconciliation: lines should track together over time" />
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 200 }}>
        <text x={4} y={padT + 6} style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--ink-mute)' }}>{fmtMoney(max, 'USD')}</text>
        <text x={4} y={padT + innerH} style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--ink-mute)' }}>$0</text>
        <path d={path('sales')}    fill="none" stroke="var(--brass)" strokeWidth={1.5} />
        <path d={path('payments')} fill="none" stroke="var(--moss)"  strokeWidth={1.5} />
        {rows.map((r, i) => {
          const variance = r.payments - r.sales;
          const verdict = Math.abs(variance) < 1
            ? '✓ balanced'
            : variance > 0
            ? `+${fmtMoney(variance, 'USD')} pre-paid (deposits inflate)`
            : `${fmtMoney(variance, 'USD')} AR forming`;
          const tip = [
            `${dayLabel(r.d)}`,
            `Sales ${fmtMoney(r.sales, 'USD')}`,
            `Payments ${fmtMoney(r.payments, 'USD')}`,
            `Variance: ${verdict}`,
            r.sales > 0 ? `Collection: ${pct(r.payments, r.sales)}` : '',
          ].filter(Boolean).join('\n');
          // Single bigger invisible hit-circle covering both points so hover is reliable
          const cy = (y(r.sales) + y(r.payments)) / 2;
          return (
            <g key={r.d}>
              <circle cx={x(i)} cy={cy} r={Math.max(8, x(1) - x(0))} fill="transparent">
                <title>{tip}</title>
              </circle>
              <circle cx={x(i)} cy={y(r.sales)}    r={2.5} fill="var(--brass)" />
              <circle cx={x(i)} cy={y(r.payments)} r={2.5} fill="var(--moss)"  />
            </g>
          );
        })}
        {rows.map((r, i) =>
          i % Math.max(1, Math.floor(rows.length / 6)) === 0 ? (
            <text key={`x-${r.d}`} x={x(i)} y={h - 10} textAnchor="middle" style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--ink-mute)' }}>
              {r.d.slice(5)}
            </text>
          ) : null,
        )}
      </svg>
      <div style={{ marginTop: 4, display: 'flex', gap: 12, fontSize: 'var(--t-xs)', color: 'var(--ink-soft)' }}>
        <span><span style={{ color: 'var(--brass)' }}>━</span> Sales</span>
        <span><span style={{ color: 'var(--moss)' }}>━</span> Payments collected</span>
      </div>
    </div>
  );
}

// CHART 3 · Audit anomalies (voids + refunds + adjustments daily)
function AuditAnomaliesChart({ rows }: { rows: DayRow[] }) {
  if (rows.length === 0) return (
    <div style={CARD}>
      <ChartHeader title="Audit anomalies · daily" sub="Voids · refunds · adjustments — spikes flag attention" />
      <EmptyChart label="No transactions in window" />
    </div>
  );
  const w = 480, h = 200, padL = 38, padR = 10, padT = 16, padB = 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  // All three buckets carry $ that's effectively negative for the property:
  // voids zero out sales, refunds return cash, adjustments correct errors.
  // We plot absolute $ so spikes pop regardless of sign.
  const dailyMag = rows.map((r) => Math.abs(r.voids) + Math.abs(r.refunds) + Math.abs(r.adjustments));
  const max = Math.max(1, ...dailyMag);
  const groupW = innerW / rows.length;
  const barW = Math.max(1, groupW - 1);
  return (
    <div style={CARD}>
      <ChartHeader title="Audit anomalies · daily" sub="Voids · refunds · adjustments — spikes flag attention" />
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 200 }}>
        <text x={4} y={padT + 6} style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--ink-mute)' }}>{fmtMoney(max, 'USD')}</text>
        <text x={4} y={padT + innerH} style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--ink-mute)' }}>$0</text>
        {rows.map((r, i) => {
          const x = padL + i * groupW + 0.5;
          const dayTotal = Math.abs(r.voids) + Math.abs(r.refunds) + Math.abs(r.adjustments);
          const tip = [
            `${dayLabel(r.d)} · anomaly $${dayTotal.toFixed(0)}`,
            Math.abs(r.voids) > 0       ? `Voids ${fmtMoney(Math.abs(r.voids), 'USD')} (${pct(Math.abs(r.voids), dayTotal)})`             : null,
            Math.abs(r.refunds) > 0     ? `Refunds ${fmtMoney(Math.abs(r.refunds), 'USD')} (${pct(Math.abs(r.refunds), dayTotal)})`       : null,
            Math.abs(r.adjustments) > 0 ? `Adjustments ${fmtMoney(Math.abs(r.adjustments), 'USD')} (${pct(Math.abs(r.adjustments), dayTotal)})` : null,
            r.sales > 0
              ? `Anomaly rate: ${pct(dayTotal, r.sales)} of sales`
              : null,
          ].filter(Boolean).join('\n');
          const segs = [
            { v: Math.abs(r.voids),       color: 'var(--st-bad, #B23B3B)',  label: 'Voids' },
            { v: Math.abs(r.refunds),     color: 'var(--st-warn, #C28F2C)', label: 'Refunds' },
            { v: Math.abs(r.adjustments), color: 'var(--ink-soft, #8B7355)', label: 'Adjustments' },
          ];
          let yCursor = padT + innerH;
          return segs.map((s, k) => {
            if (s.v <= 0) return null;
            const sh = (s.v / max) * innerH;
            yCursor -= sh;
            return (
              <rect key={`${r.d}-${k}`} x={x} y={yCursor} width={barW} height={sh} fill={s.color}>
                <title>{tip}</title>
              </rect>
            );
          });
        })}
        {rows.map((r, i) =>
          i % Math.max(1, Math.floor(rows.length / 6)) === 0 ? (
            <text key={`x-${r.d}`} x={padL + i * groupW + groupW / 2} y={h - 10} textAnchor="middle" style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--ink-mute)' }}>
              {r.d.slice(5)}
            </text>
          ) : null,
        )}
      </svg>
      <div style={{ marginTop: 4, display: 'flex', gap: 10, fontSize: 'var(--t-xs)', color: 'var(--ink-soft)', flexWrap: 'wrap' }}>
        <span><span style={{ color: 'var(--st-bad, #B23B3B)' }}>■</span> Voids</span>
        <span><span style={{ color: 'var(--st-warn, #C28F2C)' }}>■</span> Refunds</span>
        <span><span style={{ color: 'var(--ink-soft, #8B7355)' }}>■</span> Adjustments</span>
      </div>
    </div>
  );
}
