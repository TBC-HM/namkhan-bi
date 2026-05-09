// app/finance/pos-transactions/page.tsx
// Finance · POS Transactions — F&B + Other Operated POS items only.
// Filters out Rooms (room rate), tax, fee, payment, void, adjustment lines.

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
const POS_DEPTS = ['F&B', 'Other Operated', 'Retail'];
const NON_POS_CATS = ['tax', 'fee', 'void', 'adjustment', 'payment', 'rate', 'refund'];

export default async function PosTransactionsPage({ searchParams }: Props) {
  const q       = (searchParams.q as string | undefined)?.trim() ?? '';
  const dept    = (searchParams.dept as string | undefined) ?? '';
  const since   = (searchParams.since as string | undefined) ??
                  new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const until   = (searchParams.until as string | undefined) ?? new Date().toISOString().slice(0, 10);
  const page    = Math.max(1, Number((searchParams.page as string | undefined) ?? '1'));
  const offset  = (page - 1) * PAGE_SIZE;

  // ---- KPI window scan (POS subset) ----
  const supabase = getSupabaseAdmin();
  const { data: kpiRows } = await supabase
    .from('transactions')
    .select('amount, item_category_name, usali_dept, fb_meal_period, fb_outlet, transaction_type, category')
    .eq('property_id', PROPERTY_ID)
    .in('usali_dept', POS_DEPTS)
    .not('category', 'in', `(${NON_POS_CATS.join(',')})`)
    .gte('transaction_date', since)
    .lte('transaction_date', until + 'T23:59:59')
    .limit(50000);

  const all = kpiRows ?? [];
  const totalCount  = all.length;
  const sumAmt = (xs: any[]) => xs.reduce((s, r) => s + Number(r.amount || 0), 0);
  const total$  = sumAmt(all);

  const fb     = all.filter((r: any) => r.usali_dept === 'F&B');
  const spa    = all.filter((r: any) => r.usali_dept === 'Other Operated' && (r.item_category_name === 'Spa'));
  const trans  = all.filter((r: any) => r.usali_dept === 'Other Operated' && (r.item_category_name === 'Transportation'));
  const retail = all.filter((r: any) => r.usali_dept === 'Retail');
  const otherOp = all.filter((r: any) => r.usali_dept === 'Other Operated' && !['Spa','Transportation'].includes(r.item_category_name));

  const avgTicket = totalCount > 0 ? total$ / totalCount : null;

  // Top 5 categories by $
  const byCat = new Map<string, number>();
  for (const r of all) {
    const k = r.item_category_name || 'Uncategorized';
    byCat.set(k, (byCat.get(k) || 0) + Number(r.amount || 0));
  }
  const topCats = Array.from(byCat.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // ---- Listing ----
  let listQ = supabase
    .from('transactions')
    .select('transaction_id, transaction_date, service_date, item_category_name, description, amount, currency, usali_dept, fb_meal_period, fb_outlet, user_name, reservation_id, quantity', { count: 'exact' })
    .eq('property_id', PROPERTY_ID)
    .in('usali_dept', POS_DEPTS)
    .not('category', 'in', `(${NON_POS_CATS.join(',')})`)
    .gte('transaction_date', since)
    .lte('transaction_date', until + 'T23:59:59')
    .order('transaction_date', { ascending: false });

  if (dept) listQ = listQ.eq('usali_dept', dept);
  if (q) {
    listQ = listQ.or(
      [`description.ilike.%${q}%`, `item_category_name.ilike.%${q}%`,
       `user_name.ilike.%${q}%`, `reservation_id.ilike.%${q}%`,
       `fb_outlet.ilike.%${q}%`].join(',')
    );
  }
  const { data: rows, count: rowCount } = await listQ.range(offset, offset + PAGE_SIZE - 1);
  const totalPages = Math.max(1, Math.ceil((rowCount ?? 0) / PAGE_SIZE));

  // Daily POS sales — wired from kpiRows
  const byDay = new Map<string, { count: number; amount: number }>();
  for (const r of all) {
    const d = String((r as any).transaction_date || '').slice(0, 10);
    if (!d) continue;
    if (!byDay.has(d)) byDay.set(d, { count: 0, amount: 0 });
    const slot = byDay.get(d)!;
    slot.count += 1;
    slot.amount += Number((r as any).amount || 0);
  }
  const dailyPos = Array.from(byDay.entries())
    .map(([d, v]) => ({ d, ...v }))
    .sort((a, b) => a.d.localeCompare(b.d));

  return (
    <Page
      eyebrow="Finance · POS"
      title={<>Point-of-sale <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>transactions</em> — F&B · Spa · Retail · Transport.</>}
      subPages={FINANCE_SUBPAGES}
    >

      <FinanceStatusHeader
        top={
          <>
            <StatusCell label="SOURCE">
              <StatusPill tone="active">transactions</StatusPill>
              <span style={metaDim}>· usali_dept ∈ {POS_DEPTS.join(' / ')}</span>
            </StatusCell>
            <StatusCell label="WINDOW">
              <span style={metaSm}>{since} → {until}</span>
            </StatusCell>
            <StatusCell label="ROWS">
              <span style={metaStrong}>{rowCount?.toLocaleString() ?? 0}</span>
              <span style={metaDim}>{dailyPos.length} days w/ activity</span>
            </StatusCell>
            <span style={{ flex: 1 }} />
          </>
        }
        bottom={
          <>
            <StatusCell label="F&B">
              <span style={metaSm}>{fmtMoney(sumAmt(fb), 'USD')}</span>
              <span style={metaDim}>{fb.length} txns</span>
            </StatusCell>
            <StatusCell label="SPA">
              <span style={metaSm}>{fmtMoney(sumAmt(spa), 'USD')}</span>
              <span style={metaDim}>{spa.length} txns</span>
            </StatusCell>
            <StatusCell label="TRANSPORT">
              <span style={metaSm}>{fmtMoney(sumAmt(trans), 'USD')}</span>
            </StatusCell>
            <StatusCell label="RETAIL">
              <span style={metaSm}>{fmtMoney(sumAmt(retail), 'USD')}</span>
            </StatusCell>
            <span style={{ flex: 1 }} />
            <span style={metaDim}>avg ticket {avgTicket != null ? fmtMoney(avgTicket, 'USD') : '—'}</span>
          </>
        }
      />

      {/* WIRED GRAPHS — daily POS sales + top categories */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: 12,
          marginTop: 14,
        }}
      >
        <PosDailyChart rows={dailyPos} />
        <TopCategoriesChart rows={topCats} />
      </div>


      <div className="card-grid-6" style={{ marginTop: 18 }}>
        <KpiBox label="POS Lines"      unit="count" value={totalCount} />
        <KpiBox label="POS Revenue"    unit="usd"   value={total$} />
        <KpiBox label="Avg Ticket"     unit="usd"   value={avgTicket} dp={2} />
        <KpiBox label="F&B Lines"      unit="count" value={fb.length}    tooltip={`$${(sumAmt(fb)).toFixed(0)}`} />
        <KpiBox label="Spa Lines"      unit="count" value={spa.length}   tooltip={`$${(sumAmt(spa)).toFixed(0)}`} />
        <KpiBox label="Transport Lines" unit="count" value={trans.length} tooltip={`$${(sumAmt(trans)).toFixed(0)}`} />
      </div>
      <div className="card-grid-3" style={{ marginTop: 12 }}>
        <KpiBox label="F&B $"    unit="usd" value={sumAmt(fb)} />
        <KpiBox label="Spa $"    unit="usd" value={sumAmt(spa)} />
        <KpiBox label="Other Op $" unit="usd" value={sumAmt(otherOp) + sumAmt(trans) + sumAmt(retail)} tooltip="Spa + Transport + Activities + Retail" />
      </div>

      {/* Top categories */}
      {topCats.length > 0 && (
        <div className="panel" style={{ padding: 14, marginTop: 14 }}>
          <div className="t-eyebrow" style={{ marginBottom: 8 }}>Top categories ({since} → {until})</div>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            {topCats.map(([cat, total]) => (
              <div key={cat} style={{ minWidth: 160 }}>
                <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'var(--t-xl)', color: 'var(--ink)' }}>
                  {fmtMoney(total, 'USD')}
                </div>
                <div className="t-eyebrow" style={{ marginTop: 2 }}>{cat}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter / search */}
      <form method="GET" className="panel" style={{ padding: 14, marginTop: 14 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ flex: '2 1 240px' }}>
            <span className="t-eyebrow" style={{ display: 'block', marginBottom: 4 }}>Search</span>
            <input
              type="search" name="q" defaultValue={q}
              placeholder="Item, description, guest, outlet, user…"
              style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--rule)', borderRadius: 4, font: 'inherit' }}
            />
          </label>
          <label>
            <span className="t-eyebrow" style={{ display: 'block', marginBottom: 4 }}>Dept</span>
            <select name="dept" defaultValue={dept} style={{ padding: '6px 10px', border: '1px solid var(--rule)', borderRadius: 4, font: 'inherit' }}>
              <option value="">All POS</option>
              <option value="F&B">F&amp;B only</option>
              <option value="Other Operated">Other Operated</option>
              <option value="Retail">Retail</option>
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
          <a href="/finance/pos-transactions" className="btn">Reset</a>
        </div>
      </form>

      <div className="panel" style={{ marginTop: 14, overflowX: 'auto' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Date</th>
              <th>Service</th>
              <th>Outlet</th>
              <th>Category</th>
              <th>Description</th>
              <th>Dept</th>
              <th>Reservation</th>
              <th className="num">Qty</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r: any) => {
              const amt = Number(r.amount || 0);
              return (
                <tr key={r.transaction_id}>
                  <td className="lbl text-mono">{(r.transaction_date || '').slice(0, 10)}</td>
                  <td className="lbl text-mute">{r.service_date || '—'}</td>
                  <td className="lbl">{r.fb_outlet || '—'}{r.fb_meal_period ? ` · ${r.fb_meal_period}` : ''}</td>
                  <td className="lbl text-mute">{r.item_category_name || '—'}</td>
                  <td className="lbl">{r.description || '—'}</td>
                  <td className="lbl text-mute">{r.usali_dept || '—'}</td>
                  <td className="lbl text-mono">{r.reservation_id ? r.reservation_id.slice(0, 12) : '—'}</td>
                  <td className="num">{r.quantity ?? '—'}</td>
                  <td className={`num ${amt < 0 ? 'var-amber' : ''}`}>{fmtMoney(amt, 'USD')}</td>
                </tr>
              );
            })}
            {(rows ?? []).length === 0 && (
              <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: 'var(--ink-mute)', fontStyle: 'italic' }}>No POS transactions match.</td></tr>
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: 8, padding: 12, justifyContent: 'center', alignItems: 'center', fontSize: 'var(--t-sm)' }}>
            {page > 1 && <a className="btn" href={buildUrl({ q, dept, since, until, page: page - 1 })}>← Prev</a>}
            <span className="text-mute">Page {page} / {totalPages} · {rowCount?.toLocaleString()} rows</span>
            {page < totalPages && <a className="btn" href={buildUrl({ q, dept, since, until, page: page + 1 })}>Next →</a>}
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
  return `/finance/pos-transactions?${sp.toString()}`;
}

function PosDailyChart({ rows }: { rows: { d: string; count: number; amount: number }[] }) {
  const card: React.CSSProperties = {
    background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)',
    borderRadius: 8, padding: '14px 16px', minHeight: 220,
  };
  if (rows.length === 0) {
    return (
      <div style={card}>
        <div style={{ fontSize: 'var(--t-md)', fontWeight: 600 }}>Daily POS sales</div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-loose)', color: 'var(--ink-mute)', textTransform: 'uppercase', marginBottom: 10 }}>
          USD per day · in window
        </div>
        <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-faint)', fontStyle: 'italic', fontSize: 'var(--t-sm)' }}>
          No POS transactions in window
        </div>
      </div>
    );
  }
  const w = 520, h = 200, padL = 36, padR = 12, padT = 16, padB = 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const max = Math.max(1, ...rows.map((r) => r.amount));
  const groupW = innerW / rows.length;
  const barW = Math.max(1, groupW - 1);

  return (
    <div style={card}>
      <div style={{ fontSize: 'var(--t-md)', fontWeight: 600 }}>Daily POS sales</div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-loose)', color: 'var(--ink-mute)', textTransform: 'uppercase', marginBottom: 10 }}>
        USD per day · in window
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 200 }}>
        <text x={4} y={padT + 6} style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--ink-mute)' }}>{fmtMoney(max, 'USD')}</text>
        <text x={4} y={padT + innerH} style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--ink-mute)' }}>$0</text>
        {rows.map((r, i) => {
          const bh = (r.amount / max) * innerH;
          const x = padL + i * groupW + 0.5;
          const y = padT + innerH - bh;
          return (
            <rect key={r.d} x={x} y={y} width={barW} height={bh} fill="var(--moss)">
              <title>{`${r.d} · ${fmtMoney(r.amount, 'USD')} · ${r.count} txns`}</title>
            </rect>
          );
        })}
        {rows.map((r, i) =>
          i % Math.max(1, Math.floor(rows.length / 6)) === 0 ? (
            <text key={`x-${r.d}`} x={padL + i * groupW + groupW / 2} y={h - 12} textAnchor="middle" style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--ink-mute)' }}>
              {r.d.slice(5)}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}

function TopCategoriesChart({ rows }: { rows: [string, number][] }) {
  const card: React.CSSProperties = {
    background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)',
    borderRadius: 8, padding: '14px 16px', minHeight: 220,
  };
  if (rows.length === 0) {
    return (
      <div style={card}>
        <div style={{ fontSize: 'var(--t-md)', fontWeight: 600 }}>Top POS categories</div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-loose)', color: 'var(--ink-mute)', textTransform: 'uppercase', marginBottom: 10 }}>
          By $ · in window
        </div>
        <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-faint)', fontStyle: 'italic', fontSize: 'var(--t-sm)' }}>
          No data
        </div>
      </div>
    );
  }
  const w = 320, lineH = 24, h = Math.max(180, rows.length * lineH + 12);
  const labelW = 120, valW = 80;
  const barMaxW = w - labelW - valW - 8;
  const max = rows[0][1];
  const total = rows.reduce((s, r) => s + r[1], 0);
  return (
    <div style={card}>
      <div style={{ fontSize: 'var(--t-md)', fontWeight: 600 }}>Top POS categories</div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-loose)', color: 'var(--ink-mute)', textTransform: 'uppercase', marginBottom: 10 }}>
        Top 5 by $ · share of total
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: h }}>
        {rows.map(([k, v], i) => {
          const y = 6 + i * lineH;
          const barW = (v / max) * barMaxW;
          const pct = total > 0 ? (v / total) * 100 : 0;
          return (
            <g key={k}>
              <text x={labelW - 4} y={y + 14} textAnchor="end" style={{ fontFamily: 'var(--mono)', fontSize: 10, fill: 'var(--ink)' }}>
                {String(k).slice(0, 16)}
              </text>
              <rect x={labelW} y={y + 4} width={barMaxW} height={14} fill="var(--paper-deep)" />
              <rect x={labelW} y={y + 4} width={barW} height={14} fill="var(--moss)">
                <title>{`${k} · ${fmtMoney(v, 'USD')} · ${pct.toFixed(0)}%`}</title>
              </rect>
              <text x={labelW + barMaxW + 4} y={y + 14} style={{ fontFamily: 'var(--mono)', fontSize: 10, fill: 'var(--ink-soft)' }}>
                {fmtMoney(v, 'USD')}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
