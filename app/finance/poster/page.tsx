// app/finance/poster/page.tsx
// Finance · Poster POS — analytics + searchable receipts ledger.
// Builds on the F&B / Spa / Activities page pattern: slim hero · 2 KpiStrips
// · 3 explainer cards · top-bucket tables · searchable raw receipts.
//
// Data: pos.poster_receipts (loaded 2026-05-04 via pg_net.http_get from a
// one-shot Vercel-hosted JSON). 18,122 receipts, May 2023 → May 2026.
//
// TODO (next pass): Cloudbeds folio reconciliation — match every
// 'Charge Room / to Folio' receipt against mv_classified_transactions by
// (client name, close_at date) → green ✓ if amount matches within $0.50.

import Link from 'next/link';
import FilterStrip from '@/components/nav/FilterStrip';
import Page from '@/components/page/Page';
import { FINANCE_SUBPAGES } from '../_subpages';
import StatusPill from '@/components/ui/StatusPill';
import KpiStrip, { type KpiStripItem } from '@/components/kpi/KpiStrip';
import PosterReceiptsTable from '@/components/poster/PosterReceiptsTable';
import { resolvePeriod } from '@/lib/period';
import {
  FinanceStatusHeader,
  StatusCell,
  metaSm,
  metaStrong,
  metaDim,
} from '../_components/FinanceShell';
import { fmtMoney } from '@/lib/format';
import {
  getPosterPeriodTotals,
  getPosterByMethod,
  getPosterTopSources,
  getPosterTopWaiters,
  getPosterTopAreas,
  getPosterReceiptsRaw,
  getPosterReconcileSummary,
} from '@/lib/data-poster';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface Props { searchParams: Record<string, string | string[] | undefined>; }

export default async function PosterPage({ searchParams }: Props) {
  // Use the canonical FilterStrip + resolvePeriod so the page respects the
  // same 7d/30d/90d/YTD/L12M windows as the rest of the portal.
  const period = resolvePeriod(searchParams);
  const from = period.from;
  const to   = period.to;
  const periodLabel = period.label;

  const [totals, byMethod, topSrc, topWaiters, topAreas, raw, recon]: [
    Awaited<ReturnType<typeof getPosterPeriodTotals>>,
    Awaited<ReturnType<typeof getPosterByMethod>>,
    Awaited<ReturnType<typeof getPosterTopSources>>,
    Awaited<ReturnType<typeof getPosterTopWaiters>>,
    Awaited<ReturnType<typeof getPosterTopAreas>>,
    Awaited<ReturnType<typeof getPosterReceiptsRaw>>,
    Awaited<ReturnType<typeof getPosterReconcileSummary>>,
  ] = await Promise.all([
    getPosterPeriodTotals(from, to),
    getPosterByMethod(from, to),
    getPosterTopSources(from, to, 10),
    getPosterTopWaiters(from, to, 10),
    getPosterTopAreas(from, to, 10),
    getPosterReceiptsRaw(from, to, 2000),
    getPosterReconcileSummary(from, to),
  ]);
  const greenPct = recon.charge_room_n > 0 ? (recon.matched_green_n / recon.charge_room_n) * 100 : 0;
  const matchPct = recon.charge_room_n > 0 ? ((recon.matched_green_n + recon.matched_amber_n) / recon.charge_room_n) * 100 : 0;

  // Pull-out specific payment buckets (always render so page is stable across windows)
  const pick = (name: string) => byMethod.find((m) => m.payment_method === name)
    ?? { payment_method: name, closed_n: 0, open_n: 0, deleted_n: 0, order_usd: 0, paid_usd: 0 };
  const room   = pick('Charge Room / to Folio');
  const card   = pick('Card');
  const cash   = pick('Cash');
  const wire   = pick('Bank Transfer');
  const intl   = pick('Internal  (Bfast,Mgmt/Staff,IMekong)');
  const free   = pick('Without payment');
  const office = pick('Payment through Office');
  const house  = pick('House Acccount Charge');

  const orderClosed = totals.order_usd;
  const paidClosed  = totals.paid_usd;
  const sumPmCheck  = card.order_usd + cash.order_usd + wire.order_usd + room.order_usd + intl.order_usd + free.order_usd + office.order_usd + house.order_usd;
  const tipsDelta   = paidClosed - orderClosed;        // service charge / tips collected on top of orders

  return (
    <Page
      eyebrow="Finance · Poster POS"
      title={<>Every <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>receipt</em> — and where it lands.</>}
      subPages={FINANCE_SUBPAGES}
    >

      <FinanceStatusHeader
        top={
          <>
            <StatusCell label="SOURCE">
              <StatusPill tone="active">pos.poster_receipts</StatusPill>
              <span style={metaDim}>· static export · 18,122 rows · May 2023 → May 2026</span>
            </StatusCell>
            <StatusCell label="WINDOW">
              <span style={metaSm}>{periodLabel}</span>
              <span style={metaDim}>· {period.rangeLabel}</span>
            </StatusCell>
            <StatusCell label="RECEIPTS">
              <span style={metaStrong}>{totals.receipts_total.toLocaleString()}</span>
              <span style={metaDim}>{totals.closed_n} closed · {totals.open_n} open</span>
            </StatusCell>
            <span style={{ flex: 1 }} />
          </>
        }
        bottom={
          <>
            <StatusCell label="ORDER">
              <span style={metaSm}>{fmtMoney(orderClosed, 'USD')}</span>
            </StatusCell>
            <StatusCell label="PAID">
              <span style={metaSm}>{fmtMoney(paidClosed, 'USD')}</span>
              <span style={metaDim}>Δ {tipsDelta >= 0 ? '+' : ''}{fmtMoney(tipsDelta, 'USD')} tips/sc</span>
            </StatusCell>
            <StatusCell label="ROOM RECON">
              <StatusPill tone={greenPct >= 80 ? 'active' : greenPct >= 50 ? 'pending' : 'expired'}>
                {greenPct.toFixed(0)}%
              </StatusPill>
              <span style={metaDim}>{recon.matched_green_n} of {recon.charge_room_n} green · {matchPct.toFixed(0)}% any match</span>
            </StatusCell>
            <span style={{ flex: 1 }} />
            <span style={metaDim}>
              {totals.deleted_n} deleted · service charge {fmtMoney(totals.service_charge_usd, 'USD')}
            </span>
          </>
        }
      />

      <FilterStrip
        showForward={false}
        showCompare={false}
        showSegment={false}
        liveSource="Poster · static export"
      />

      {/* Report → action queue */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -6, marginBottom: 8 }}>
        <Link
          href="/finance/poster/report"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            background: 'var(--moss)',
            color: 'var(--paper-warm)',
            borderRadius: 4,
            border: '1px solid var(--moss)',
            textDecoration: 'none',
            fontFamily: 'var(--mono)',
            fontSize: 'var(--t-xs)',
            letterSpacing: 'var(--ls-extra)',
            textTransform: 'uppercase',
          }}
        >
          Report · {recon.charge_room_n - recon.matched_green_n} findings →
        </Link>
      </div>

      {/* Strip 1 — Period totals */}
      <KpiStrip
        items={[
          { label: 'Receipts',     value: totals.receipts_total, kind: 'count', hint: `closed ${totals.closed_n}` },
          { label: 'Order $',      value: orderClosed, kind: 'money', tone: 'pos' },
          { label: 'Paid $',       value: paidClosed,  kind: 'money', tone: 'pos', hint: `Δ ${tipsDelta >= 0 ? '+' : ''}$${Math.round(tipsDelta).toLocaleString()} tips/sc` },
          { label: 'Service charge', value: totals.service_charge_usd, kind: 'money' },
          { label: 'Open',         value: totals.open_n, kind: 'count', tone: totals.open_n > 0 ? 'warn' : 'pos', hint: 'never closed — hygiene fix' },
          { label: 'Deleted',      value: totals.deleted_n, kind: 'count', tone: totals.deleted_n > 50 ? 'warn' : 'neutral' },
        ] satisfies KpiStripItem[]}
      />

      {/* Strip 2 — Payment-method breakdown */}
      <KpiStrip
        items={[
          { label: 'Charge to room',   value: room.order_usd, kind: 'money', tone: 'pos', hint: `${room.closed_n} receipts → reconcile vs Cloudbeds` },
          { label: 'Card',             value: card.order_usd, kind: 'money', hint: `${card.closed_n} receipts` },
          { label: 'Cash',             value: cash.order_usd, kind: 'money', hint: `${cash.closed_n} receipts` },
          { label: 'Bank transfer',    value: wire.order_usd, kind: 'money', hint: `${wire.closed_n} receipts` },
          { label: 'Internal / staff', value: intl.order_usd, kind: 'money', tone: 'warn', hint: `${intl.closed_n} comped/staff` },
          { label: 'Without payment',  value: free.order_usd, kind: 'money', tone: free.order_usd > 5000 ? 'neg' : 'warn', hint: `${free.closed_n} closed · audit` },
        ] satisfies KpiStripItem[]}
      />

      {/* 3 explainer cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: 10,
        marginTop: 12,
      }}>
        {/* — Charge to Room reconciliation — */}
        <div style={{ background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 8, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)' }}>Charge to Room · reconciliation</div>
          <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'var(--t-lg)', lineHeight: 1.15 }}>
            {greenPct.toFixed(1)}% <span style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-soft)', fontStyle: 'normal' }}>· landed clean on the folio</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto auto auto', gap: '4px 12px', fontSize: 'var(--t-sm)', fontVariantNumeric: 'tabular-nums' }}>
            <span style={{ color: 'var(--good, #2c7a4b)' }}>✓ exact match</span>
            <span style={{ textAlign: 'right' }}>{recon.matched_green_n}</span>
            <span style={{ textAlign: 'right', color: 'var(--ink-soft)' }}>${Math.round(recon.matched_green_order_usd).toLocaleString()}</span>

            <span style={{ color: 'var(--brass)' }}>⚠ amount close (±5%)</span>
            <span style={{ textAlign: 'right' }}>{recon.matched_amber_n}</span>
            <span style={{ textAlign: 'right', color: 'var(--ink-soft)' }}>—</span>

            <span style={{ color: 'var(--bad, #b53a2a)' }}>✗ amount mismatch</span>
            <span style={{ textAlign: 'right' }}>{recon.amount_mismatch_n}</span>
            <span style={{ textAlign: 'right', color: 'var(--ink-soft)' }}>—</span>

            <span style={{ color: 'var(--bad)' }}>✗ no CB folio line</span>
            <span style={{ textAlign: 'right' }}>{recon.no_cb_lines_n}</span>
            <span style={{ textAlign: 'right', color: 'var(--ink-soft)' }}>—</span>

            <span style={{ color: 'var(--ink-soft)' }}>? ambiguous room</span>
            <span style={{ textAlign: 'right' }}>{recon.ambiguous_room_n}</span>
            <span style={{ textAlign: 'right', color: 'var(--ink-soft)' }}>multi-occupant</span>

            <span style={{ color: 'var(--ink-soft)' }}>? no match</span>
            <span style={{ textAlign: 'right' }}>{recon.no_match_n}</span>
            <span style={{ textAlign: 'right', color: 'var(--ink-soft)' }}>client mystery</span>
          </div>
          <div style={{
            fontSize: 'var(--t-xs)',
            color: greenPct > 80 ? 'var(--good)' : greenPct > 40 ? 'var(--brass)' : 'var(--bad)',
            background: greenPct > 80 ? 'rgba(44, 122, 75, 0.08)' : greenPct > 40 ? 'rgba(180, 130, 40, 0.08)' : 'rgba(181, 58, 42, 0.08)',
            padding: '6px 8px',
            borderLeft: `2px solid ${greenPct > 80 ? 'var(--good)' : greenPct > 40 ? 'var(--brass)' : 'var(--bad)'}`,
            marginTop: 'auto',
          }}>
            <strong>{greenPct > 80 ? 'Healthy:' : greenPct > 40 ? 'Watch:' : 'Broken:'}</strong>{' '}
            Only {greenPct.toFixed(1)}% of charge-to-room receipts match a CB folio line exactly. Manager is typing room-type names in the &quot;client&quot; field instead of guest names — fix in <code style={{ fontFamily: 'var(--mono)' }}>pos.poster_room_type_alias</code> + train manager.
          </div>
        </div>

        {/* — Open receipts hygiene — */}
        <div style={{ background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 8, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)' }}>Open receipts hygiene</div>
          <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'var(--t-lg)', lineHeight: 1.15 }}>
            {totals.open_n.toLocaleString()} <span style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-soft)', fontStyle: 'normal' }}>· receipts never closed</span>
          </div>
          <div style={{ fontSize: 'var(--t-sm)', color: 'var(--ink)', lineHeight: 1.4 }}>
            Poster status = &quot;Open&quot; means the table was opened but never settled. Could be a phantom (waiter forgot to close) or a real un-paid bill. Either way: lost revenue if it sits there.
          </div>
          <div style={{
            fontSize: 'var(--t-xs)',
            color: totals.open_n > 100 ? 'var(--bad, #b53a2a)' : totals.open_n > 20 ? 'var(--brass)' : 'var(--good, #2c7a4b)',
            background: totals.open_n > 100 ? 'rgba(181, 58, 42, 0.08)' : totals.open_n > 20 ? 'rgba(180, 130, 40, 0.08)' : 'rgba(44, 122, 75, 0.08)',
            padding: '6px 8px',
            borderLeft: `2px solid ${totals.open_n > 100 ? 'var(--bad)' : totals.open_n > 20 ? 'var(--brass)' : 'var(--good)'}`,
            marginTop: 'auto',
          }}>
            <strong>{totals.open_n > 100 ? 'Watch:' : totals.open_n > 20 ? 'Monitor:' : 'Healthy:'}</strong>{' '}
            Filter the table below by Status = Open and chase each. Pareto: 90% of dollars usually live in the top 20 oldest.
          </div>
        </div>

        {/* — Without-payment audit — */}
        <div style={{ background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 8, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)' }}>Without-payment audit</div>
          <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'var(--t-lg)', lineHeight: 1.15 }}>
            ${Math.round(free.order_usd).toLocaleString()} <span style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-soft)', fontStyle: 'normal' }}>· {free.closed_n} closed · {free.paid_usd === 0 ? '$0 paid' : `$${Math.round(free.paid_usd).toLocaleString()} paid`}</span>
          </div>
          <div style={{ fontSize: 'var(--t-sm)', color: 'var(--ink)', lineHeight: 1.4 }}>
            Receipts closed with payment_method = &quot;Without payment&quot; — i.e. the bill was zeroed out without any money moving. Comps, voids, owner meals all land here.
          </div>
          <div style={{ fontSize: 'var(--t-xs)', color: 'var(--bad)', background: 'rgba(181, 58, 42, 0.08)', padding: '6px 8px', borderLeft: '2px solid var(--bad)', marginTop: 'auto' }}>
            <strong>Action:</strong> these should be on a separate &quot;Comp&quot; method with a reason field, not a default. Talk to the manager about Poster config.
          </div>
        </div>
      </div>

      {/* Top-bucket tables */}
      <section style={{ marginTop: 22, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        {[
          { title: 'Top order sources', rows: topSrc },
          { title: 'Top waiters',       rows: topWaiters },
          { title: 'Top floor areas',   rows: topAreas },
        ].map((g) => (
          <div key={g.title} style={{ background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)', marginBottom: 8 }}>{g.title}</div>
            {g.rows.length === 0 ? (
              <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-soft)', fontStyle: 'italic' }}>No data in window.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--t-sm)' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left',  padding: '4px 8px', color: 'var(--ink-soft)', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', fontWeight: 500 }}>Bucket</th>
                    <th style={{ textAlign: 'right', padding: '4px 8px', color: 'var(--ink-soft)', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', fontWeight: 500 }}>Receipts</th>
                    <th style={{ textAlign: 'right', padding: '4px 8px', color: 'var(--ink-soft)', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', fontWeight: 500 }}>Order $</th>
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((r) => (
                    <tr key={r.bucket}>
                      <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--rule, #e3dfd3)' }}>{r.bucket}</td>
                      <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--rule, #e3dfd3)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.receipts.toLocaleString()}</td>
                      <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--rule, #e3dfd3)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>${Math.round(r.order_usd).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </section>

      {/* Searchable raw receipts */}
      <details style={{ marginTop: 24 }} open>
        <summary style={{
          cursor: 'pointer',
          fontFamily: 'var(--mono)',
          fontSize: 'var(--t-xs)',
          letterSpacing: 'var(--ls-extra)',
          textTransform: 'uppercase',
          color: 'var(--brass)',
          padding: '8px 0',
        }}>
          Receipts ledger · search &amp; filter ▾  <span style={{ color: 'var(--ink-soft)', textTransform: 'none', letterSpacing: 'normal' }}>({raw.length} most-recent)</span>
        </summary>
        <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-soft)', marginTop: 10, marginBottom: 10 }}>
          Most-recent {raw.length} receipts from <code style={{ fontFamily: 'var(--mono)' }}>pos.poster_receipts</code>.
          Search by receipt # / client / waiter / table / date. Filter by payment method or status.
          <strong> Open</strong> rows highlighted brass · <strong>Delete</strong> red.
        </div>
        <PosterReceiptsTable data={raw} pageSize={200} />
      </details>
    </Page>
  );
}
