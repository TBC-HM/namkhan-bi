// app/finance/transactions/page.tsx
// Finance · Transactions — full Cloudbeds + POS transactions with KPI grouping + search.

import Page from '@/components/page/Page';
import { FINANCE_SUBPAGES } from '../_subpages';
import KpiBox from '@/components/kpi/KpiBox';
import StatusPill from '@/components/ui/StatusPill';
// 2026-05-09: public.transactions has RLS blocking anon; use service role.
import { PROPERTY_ID } from '@/lib/supabase';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { fmtMoney } from '@/lib/format';
import {
  FinanceStatusHeader,
  StatusCell,
  metaSm,
  metaStrong,
  metaDim,
} from '../_components/FinanceShell';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface Props { searchParams: Record<string, string | string[] | undefined>; }

const PAGE_SIZE = 200;

export default async function TransactionsPage({ searchParams }: Props) {
  const q       = (searchParams.q as string | undefined)?.trim() ?? '';
  const dept    = (searchParams.dept as string | undefined) ?? '';
  const txnType = (searchParams.type as string | undefined) ?? '';
  const since   = (searchParams.since as string | undefined) ??
                  new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const until   = (searchParams.until as string | undefined) ?? new Date().toISOString().slice(0, 10);
  const page    = Math.max(1, Number((searchParams.page as string | undefined) ?? '1'));
  const offset  = (page - 1) * PAGE_SIZE;

  // ---- KPIs (window-scoped to the date filter) ----
  const supabase = getSupabaseAdmin();
  const { data: kpiRows } = await supabase
    .from('transactions')
    .select('amount, transaction_type, category, usali_dept')
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
    .select('transaction_id, transaction_date, transaction_type, category, item_category_name, description, amount, currency, usali_dept, user_name, reservation_id, method', { count: 'planned' })
    .eq('property_id', PROPERTY_ID)
    .gte('transaction_date', since)
    .lte('transaction_date', until + 'T23:59:59')
    .order('transaction_date', { ascending: false });

  if (dept)    listQ = listQ.eq('usali_dept', dept);
  if (txnType) listQ = listQ.eq('transaction_type', txnType);
  if (q) {
    listQ = listQ.or(
      [`description.ilike.%${q}%`, `item_category_name.ilike.%${q}%`,
       `user_name.ilike.%${q}%`, `reservation_id.ilike.%${q}%`].join(',')
    );
  }
  const { data: rows, count: rowCount } = await listQ.range(offset, offset + PAGE_SIZE - 1);
  const totalPages = Math.max(1, Math.ceil((rowCount ?? all.length) / PAGE_SIZE));

  // Daily volume series — wired from kpiRows by truncating transaction_date.
  const byDay = new Map<string, { count: number; sales: number }>();
  for (const r of all) {
    const d = String((r as any).transaction_date || '').slice(0, 10);
    if (!d) continue;
    if (!byDay.has(d)) byDay.set(d, { count: 0, sales: 0 });
    const slot = byDay.get(d)!;
    slot.count += 1;
    if (
      (r as any).transaction_type === 'debit' &&
      !['tax', 'fee', 'void', 'adjustment'].includes((r as any).category)
    ) {
      slot.sales += Number((r as any).amount || 0);
    }
  }
  const dailySeries = Array.from(byDay.entries())
    .map(([d, v]) => ({ d, ...v }))
    .sort((a, b) => a.d.localeCompare(b.d));

  return (
    <Page
      eyebrow="Finance · Transactions"
      title={<>All <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>transactions</em> · Cloudbeds + POS.</>}
      subPages={FINANCE_SUBPAGES}
    >

      <FinanceStatusHeader
        top={
          <>
            <StatusCell label="SOURCE">
              <StatusPill tone="active">transactions</StatusPill>
              <span style={metaDim}>· Cloudbeds + POS · property {PROPERTY_ID}</span>
            </StatusCell>
            <StatusCell label="WINDOW">
              <span style={metaSm}>{since} → {until}</span>
            </StatusCell>
            <StatusCell label="ROWS">
              <span style={metaStrong}>{rowCount?.toLocaleString() ?? 0}</span>
              <span style={metaDim}>matching · {dailySeries.length} days w/ activity</span>
            </StatusCell>
            <span style={{ flex: 1 }} />
          </>
        }
        bottom={
          <>
            <StatusCell label="DEBITS">
              <span style={metaSm}>{debits.length.toLocaleString()}</span>
            </StatusCell>
            <StatusCell label="CREDITS">
              <span style={metaSm}>{credits.length.toLocaleString()}</span>
            </StatusCell>
            <StatusCell label="SALES">
              <span style={metaSm}>{fmtMoney(sumAmt(sales), 'USD')}</span>
            </StatusCell>
            <span style={{ flex: 1 }} />
            <span style={metaDim}>{q ? `q="${q}"` : 'no search'} · dept={dept || 'all'} · type={txnType || 'all'}</span>
          </>
        }
      />

      {/* WIRED GRAPH — daily transaction volume + sales */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: 12,
          marginTop: 14,
        }}
      >
        <DailyVolumeChart rows={dailySeries} />
      </div>

      {/* KPI groupings */}
      <div className="card-grid-6" style={{ marginTop: 18 }}>
        <KpiBox label="Total Txns"    unit="count" value={totalCount} tooltip="All transactions in window" />
        <KpiBox label="Sales $"       unit="usd"   value={sumAmt(sales)}   tooltip="Debits ex tax/fee/void/adjustment" />
        <KpiBox label="Payments $"    unit="usd"   value={sumAmt(payments)}tooltip="Credits · category=payment" />
        <KpiBox label="Refunds $"     unit="usd"   value={sumAmt(refunds)} tooltip="Credits · category=refund" />
        <KpiBox label="Tax $"         unit="usd"   value={sumAmt(taxes)}   tooltip="Debits · category=tax (VAT, service charge)" />
        <KpiBox label="Adjustments $" unit="usd"   value={sumAmt(adjustments)} tooltip="Debits · category in (adjustment, void)" />
      </div>
      <div className="card-grid-3" style={{ marginTop: 12 }}>
        <KpiBox label="Rooms Sales $" unit="usd" value={roomsSales} tooltip="Sales tagged usali_dept=Rooms" />
        <KpiBox label="F&B Sales $"   unit="usd" value={fbSales}    tooltip={`${fbCount} F&B transactions`} />
        <KpiBox label="Other Op $"    unit="usd" value={otherSales} tooltip="Spa, Cruise, Activities, Transport" />
      </div>

      {/* Filter / search bar */}
      <form method="GET" className="panel" style={{ padding: 14, marginTop: 18 }}>
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

      {/* Listing */}
      <div className="panel" style={{ marginTop: 14, overflowX: 'auto' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Category</th>
              <th>Item / Description</th>
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
                  <td className="lbl text-mute">{r.usali_dept || '—'}</td>
                  <td className="lbl text-mono">{r.reservation_id ? r.reservation_id.slice(0, 12) : '—'}</td>
                  <td className="lbl text-mute">{r.user_name || '—'}</td>
                  <td className={`num ${negative ? 'var-amber' : ''}`}>{fmtMoney(amt, 'USD')}</td>
                </tr>
              );
            })}
            {(rows ?? []).length === 0 && (
              <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: 'var(--ink-mute)', fontStyle: 'italic' }}>No transactions match.</td></tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: 8, padding: 12, justifyContent: 'center', alignItems: 'center', fontSize: 'var(--t-sm)' }}>
            {page > 1 && (
              <a className="btn" href={buildUrl({ q, dept, type: txnType, since, until, page: page - 1 })}>← Prev</a>
            )}
            <span className="text-mute">Page {page} / {totalPages} · {rowCount?.toLocaleString()} rows</span>
            {page < totalPages && (
              <a className="btn" href={buildUrl({ q, dept, type: txnType, since, until, page: page + 1 })}>Next →</a>
            )}
          </div>
        )}
      </div>
    </Page>
  );
}

function buildUrl(p: Record<string, string | number>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) {
    if (v !== '' && v != null) sp.set(k, String(v));
  }
  return `/finance/transactions?${sp.toString()}`;
}

function DailyVolumeChart({ rows }: { rows: { d: string; count: number; sales: number }[] }) {
  const card: React.CSSProperties = {
    background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)',
    borderRadius: 8, padding: '14px 16px', minHeight: 220,
  };
  if (rows.length === 0) {
    return (
      <div style={card}>
        <div style={{ fontSize: 'var(--t-md)', fontWeight: 600, marginBottom: 2 }}>Daily transaction volume</div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-loose)', color: 'var(--ink-mute)', textTransform: 'uppercase', marginBottom: 10 }}>
          Count + sales · in window
        </div>
        <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-faint)', fontStyle: 'italic', fontSize: 'var(--t-sm)' }}>
          No transactions in window
        </div>
      </div>
    );
  }
  const w = 520, h = 200, padL = 36, padR = 12, padT = 16, padB = 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const maxCount = Math.max(1, ...rows.map((r) => r.count));
  const maxSales = Math.max(1, ...rows.map((r) => r.sales));
  const groupW = innerW / rows.length;
  const barW = Math.max(1, groupW - 1);

  const linePath = rows
    .map((r, i) => {
      const x = padL + i * groupW + groupW / 2;
      const y = padT + innerH - (r.sales / maxSales) * innerH;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div style={card}>
      <div style={{ fontSize: 'var(--t-md)', fontWeight: 600, marginBottom: 2 }}>Daily transaction volume</div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-loose)', color: 'var(--ink-mute)', textTransform: 'uppercase', marginBottom: 10 }}>
        Count (bars) + sales USD (line)
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 200 }}>
        <text x={4} y={padT + 6} style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--ink-mute)' }}>
          {maxCount}
        </text>
        <text x={4} y={padT + innerH} style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--ink-mute)' }}>
          0
        </text>
        {rows.map((r, i) => {
          const bh = (r.count / maxCount) * innerH;
          const x = padL + i * groupW + 0.5;
          const y = padT + innerH - bh;
          return (
            <rect key={r.d} x={x} y={y} width={barW} height={bh} fill="var(--moss)">
              <title>{`${r.d} · ${r.count} txns · ${fmtMoney(r.sales, 'USD')} sales · v_finance_transactions`}</title>
            </rect>
          );
        })}
        <path d={linePath} fill="none" stroke="var(--brass)" strokeWidth={1.5}>
          <title>{`Daily sales line · ${rows.length} days · max ${fmtMoney(maxSales, 'USD')} · v_finance_transactions`}</title>
        </path>
        {/* invisible hover dots for line points */}
        {rows.map((r, i) => {
          const cx = padL + i * groupW + groupW / 2;
          const cy = padT + innerH - (r.sales / maxSales) * innerH;
          return (
            <circle key={`pt-${r.d}`} cx={cx} cy={cy} r={6} fill="var(--brass)" opacity={0}>
              <title>{`${r.d} · sales ${fmtMoney(r.sales, 'USD')} · ${r.count} txns · v_finance_transactions`}</title>
            </circle>
          );
        })}
        {/* x labels — sparse */}
        {rows.map((r, i) =>
          i % Math.max(1, Math.floor(rows.length / 6)) === 0 ? (
            <text
              key={`x-${r.d}`}
              x={padL + i * groupW + groupW / 2}
              y={h - 12}
              textAnchor="middle"
              style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--ink-mute)' }}
            >
              {r.d.slice(5)}
            </text>
          ) : null,
        )}
        <g transform={`translate(${padL}, ${padT - 4})`} style={{ fontFamily: 'var(--mono)', fontSize: 9 }}>
          <rect x={0} y={-6} width={9} height={4} fill="var(--moss)" />
          <text x={12} y={-2} style={{ fill: 'var(--ink)' }}>Count</text>
          <line x1={50} y1={-4} x2={62} y2={-4} stroke="var(--brass)" strokeWidth={1.5} />
          <text x={66} y={-2} style={{ fill: 'var(--brass)' }}>Sales $</text>
        </g>
      </svg>
    </div>
  );
}
