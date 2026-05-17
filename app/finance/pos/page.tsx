// app/finance/pos/page.tsx
//
// Finance · POS — single controller-grade reconciliation surface.
// Replaces the two prior tabs (/finance/poster + /finance/pos-transactions)
// per PBS rule 2026-05-15: "bring the two tabs together · the main purpose
// is to reconcile Poster → Cloudbeds · second goal: find tickets on top
// (paid in restaurant) · third goal: identify house-account transactions".
//
// Controller mindset baked in:
//   1) Top KPI band leads with the reconciliation number, not totals.
//   2) Three buckets (matched · partial · unmatched) sit ABOVE the period
//      breakdown so the gap is the first thing you see.
//   3) Tickets-on-top + House-Account get their own panels so they can't
//      hide inside the totals.
//   4) Monthly Poster-vs-Cloudbeds delta line surfaces drift over time.
//   5) Raw receipts table at the bottom for drill-down (kept from /poster).
//
// Data: every aggregation is a Postgres RPC (poster_*). The page reads
// only what it renders; no client-side aggregation of receipt lines.

import Link from 'next/link';
import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import KpiBox from '@/components/kpi/KpiBox';
import FilterStrip from '@/components/nav/FilterStrip';
import PosterReceiptsTable from '@/components/poster/PosterReceiptsTable';
import { FINANCE_SUBPAGES } from '../_subpages';
import TabStrip, { ACC_TABS } from '../_components/TabStrip';
import { resolvePeriod } from '@/lib/period';
import { fmtMoney } from '@/lib/format';
import {
  getPosterPeriodTotals,
  getPosterByMethod,
  getPosterReconcileSummary,
  getPosterReportFindings,
  getPosterReceiptsRaw,
  getPosterVsCbMonthly,
} from '@/lib/data-poster';
import { getPosUnmatchedChargeRoom } from '@/lib/data-pos-unmatched';
import UnmatchedReceiptsTable from './_components/UnmatchedReceiptsTable';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface Props { searchParams: Record<string, string | string[] | undefined>; }

// Bucket totals → "tickets on top" rollup
function rollupTicketsOnTop(rows: { payment_method: string; closed_n: number; order_usd: number }[]) {
  const pick = (name: string) =>
    rows.find((m) => m.payment_method === name) ?? { payment_method: name, closed_n: 0, order_usd: 0 };
  const direct = ['Card', 'Cash', 'Bank Transfer', 'Payment through Office', 'Combined'];
  const flagged = ['Internal  (Bfast,Mgmt/Staff,IMekong)', 'Without payment', 'Free Breakfast'];
  return {
    direct: direct.map(pick).map((r) => ({ label: r.payment_method, n: r.closed_n, usd: r.order_usd })),
    flagged: flagged.map(pick).map((r) => ({ label: r.payment_method, n: r.closed_n, usd: r.order_usd })),
    sumDirect: direct.reduce((s, k) => s + (pick(k).order_usd || 0), 0),
    sumFlagged: flagged.reduce((s, k) => s + (pick(k).order_usd || 0), 0),
    nDirect: direct.reduce((s, k) => s + (pick(k).closed_n || 0), 0),
    nFlagged: flagged.reduce((s, k) => s + (pick(k).closed_n || 0), 0),
  };
}

export default async function PosControllerPage({ searchParams }: Props) {
  const period = resolvePeriod(searchParams);
  const { from, to, label: periodLabel, rangeLabel } = period;

  const [totals, byMethod, recon, findings, unmatched, raw, vsCb] = await Promise.all([
    getPosterPeriodTotals(from, to),
    getPosterByMethod(from, to),
    getPosterReconcileSummary(from, to),
    getPosterReportFindings(),
    getPosUnmatchedChargeRoom(2000),  // full ledger — UI handles month + search client-side
    getPosterReceiptsRaw(from, to, 1000),
    getPosterVsCbMonthly(),
  ]);

  // ─── derived reconciliation health ────────────────────────────────
  const chargeRoomTotal = recon.charge_room_n;
  const chargeRoomGreen = recon.matched_green_n;
  const chargeRoomAmber = recon.matched_amber_n + recon.amount_mismatch_n + recon.ambiguous_room_n;
  const chargeRoomRed   = recon.no_match_n + recon.no_cb_lines_n;
  const matchPct = chargeRoomTotal > 0 ? (chargeRoomGreen / chargeRoomTotal) * 100 : 0;
  const unmatchedUsd =
    Math.max(0, recon.charge_room_order_usd - recon.matched_green_order_usd);

  // ─── tickets on top ───────────────────────────────────────────────
  const tickets = rollupTicketsOnTop(byMethod);

  // ─── house account ────────────────────────────────────────────────
  const house = byMethod.find((m) => m.payment_method === 'House Acccount Charge')
    ?? { payment_method: 'House Acccount Charge', closed_n: 0, order_usd: 0, open_n: 0, deleted_n: 0, paid_usd: 0 };

  // Match-rate tone
  const matchTone = matchPct >= 90 ? 'pos' : matchPct >= 70 ? 'warn' : 'neg';

  const eyebrow = [
    'Finance · POS',
    `${periodLabel} · ${rangeLabel}`,
    `${totals.receipts_total.toLocaleString()} receipts (${totals.closed_n} closed)`,
    `Order ${fmtMoney(totals.order_usd, 'USD')}`,
    `Charge-Room ${fmtMoney(recon.charge_room_order_usd, 'USD')} · match ${matchPct.toFixed(0)}%`,
    `Unmatched ${fmtMoney(unmatchedUsd, 'USD')}`,
  ].filter(Boolean).join(' · ');

  return (
    <Page
      eyebrow={eyebrow}
      title={
        <>
          POS · <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>reconcile</em> · Poster ↔ PMS
        </>
      }
      subPages={FINANCE_SUBPAGES}
    >
      <TabStrip tabs={ACC_TABS} activeKey="pos" />
      {/* ─── 1. Controller KPIs (lead with the reconciliation health) ─ */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          margin: '12px 0',
        }}
      >
        <KpiBox
          label="Match rate · charge-room"
          value={Math.round(matchPct)}
          unit="pct"
          tooltip={`${chargeRoomGreen} of ${chargeRoomTotal} Charge-Room receipts have a confirmed PMS counterpart.`}
        />
        <KpiBox
          label="Unmatched €/$ at risk"
          value={unmatchedUsd}
          unit="usd"
          tooltip="Charge-Room receipts with no matching PMS posting (or amount mismatch). Investigate before period close."
        />
        <KpiBox
          label="Charge-room receipts"
          value={chargeRoomTotal}
          unit="count"
          tooltip={`Closed receipts in period with payment_method='Charge Room / to Folio'. Total ${fmtMoney(recon.charge_room_order_usd, 'USD')}.`}
        />
        <KpiBox
          label="Tickets on top"
          value={tickets.nDirect}
          unit="count"
          tooltip={`Restaurant-paid receipts (Card/Cash/BankTransfer/Office). Not posted to a room — invitations, walk-ins, deposits. Total ${fmtMoney(tickets.sumDirect, 'USD')}.`}
        />
        <KpiBox
          label="House-account receipts"
          value={house.closed_n}
          unit="count"
          tooltip={`payment_method='House Acccount Charge' — non-guest folio (vendor/management). Total ${fmtMoney(house.order_usd, 'USD')}.`}
        />
        <KpiBox
          label="Flagged · comp / internal"
          value={tickets.nFlagged}
          unit="count"
          tooltip={`Internal/staff/comp meals — audit weekly. Total ${fmtMoney(tickets.sumFlagged, 'USD')}.`}
        />
      </div>

      <FilterStrip />

      {/* ─── 2. Charge-Room reconciliation: three buckets ──────────── */}
      <Panel
        title="Charge-to-room reconciliation"
        eyebrow={`Poster room postings vs PMS folio · last sync ${recon.reconciled_at?.slice(0, 16).replace('T', ' ') ?? '(never)'}`}
        expandable={false}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12,
            padding: 12,
          }}
        >
          <ReconBucket
            tone="green"
            title="Matched"
            count={chargeRoomGreen}
            usd={recon.matched_green_order_usd}
            note="Same client + date + amount. Auto-reconciled."
          />
          <ReconBucket
            tone="amber"
            title="Partial / ambiguous"
            count={chargeRoomAmber}
            usd={Math.max(0, recon.charge_room_order_usd - recon.matched_green_order_usd - unmatchedUsd)}
            note={`${recon.amount_mismatch_n} amount-mismatch · ${recon.ambiguous_room_n} ambiguous (client matched 2+ reservations).`}
          />
          <ReconBucket
            tone="red"
            title="Unmatched"
            count={chargeRoomRed}
            usd={unmatchedUsd}
            note={`${recon.no_match_n} no client match · ${recon.no_cb_lines_n} no PMS line on that date.`}
          />
        </div>
      </Panel>

      {/* Unmatched detail table — month dropdown + name search + bucket toggle */}
      {unmatched.length > 0 && (
        <Panel
          title={`Charge-to-room receipts that need investigation · ${unmatched.length} surfaced`}
          eyebrow="filter by month or search by client / waiter / receipt # · delta column explains the gap"
          expandable
        >
          <UnmatchedReceiptsTable rows={unmatched} />
        </Panel>
      )}

      {/* ─── 3. Tickets on top (paid in restaurant) ─────────────────── */}
      <Panel
        title="Tickets on top · paid in the restaurant"
        eyebrow="Receipts that did NOT post to a guest room — invitations · walk-ins · staff · deposits"
        expandable={false}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, padding: 12 }}>
          {tickets.direct.map((b) => (
            <MethodTile key={b.label} label={prettifyMethod(b.label)} n={b.n} usd={b.usd} tone="neutral" />
          ))}
          {tickets.flagged.map((b) => (
            <MethodTile key={b.label} label={prettifyMethod(b.label)} n={b.n} usd={b.usd} tone="warn" />
          ))}
        </div>
      </Panel>

      {/* ─── 4. House-account ──────────────────────────────────────── */}
      <Panel
        title={`House-account transactions · ${house.closed_n} receipt${house.closed_n === 1 ? '' : 's'} · ${fmtMoney(house.order_usd, 'USD')}`}
        eyebrow="payment_method='House Acccount Charge' — non-guest folio (vendor / management / barter)"
        expandable
      >
        <HouseAccountTable rows={raw.filter((r) => r.payment_method === 'House Acccount Charge')} />
      </Panel>

      {/* ─── 5. Monthly Poster vs Cloudbeds delta ──────────────────── */}
      {vsCb.length > 0 && (
        <Panel
          title="Poster room postings vs PMS F&B · monthly"
          eyebrow="If the line drifts apart, Poster posted to room and PMS did NOT receive it — controller alert"
          expandable
        >
          <VsCloudbedsChart rows={vsCb.slice(-12)} />
        </Panel>
      )}

      {/* ─── 6. Raw Poster receipts (drill-down) ───────────────────── */}
      <Panel
        title={`All receipts in period · ${raw.length}`}
        eyebrow="raw drill — search by client, table, waiter, amount"
        expandable
      >
        <PosterReceiptsTable data={raw} />
      </Panel>

      <div style={{ marginTop: 16, fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', textAlign: 'right' }}>
        Legacy tabs deprecated:{' '}
        <Link href="/finance/pos?win=last30d" style={{ color: 'var(--brass)' }}>POS · PMS</Link>{' '}
        +{' '}
        <Link href="/finance/pos?win=last30d" style={{ color: 'var(--brass)' }}>POS · Poster</Link>{' '}
        merged into this page (PBS 2026-05-15).
      </div>
    </Page>
  );
}

// ─── building blocks ──────────────────────────────────────────────────

function ReconBucket({
  tone, title, count, usd, note,
}: { tone: 'green' | 'amber' | 'red'; title: string; count: number; usd: number; note: string }) {
  const colors = {
    green: { border: 'var(--st-good, #2D6A4F)', dot: '🟢' },
    amber: { border: 'var(--st-warn, #C28F2C)', dot: '🟡' },
    red:   { border: 'var(--st-bad, #B23B3B)',  dot: '🔴' },
  }[tone];
  return (
    <div
      style={{
        background: 'var(--paper-warm)',
        border: '1px solid var(--paper-deep)',
        borderLeft: `4px solid ${colors.border}`,
        borderRadius: 8,
        padding: 14,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
          letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
          color: colors.border, fontWeight: 700,
        }}
      >
        {colors.dot} {title}
      </div>
      <div style={{ marginTop: 6, display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontFamily: 'var(--serif)', fontSize: 'var(--t-2xl)', fontWeight: 500 }}>
          {count.toLocaleString()}
        </span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-sm)', color: 'var(--ink-soft)' }}>
          {fmtMoney(usd, 'USD')}
        </span>
      </div>
      <div style={{ marginTop: 4, fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>{note}</div>
    </div>
  );
}

function MethodTile({
  label, n, usd, tone,
}: { label: string; n: number; usd: number; tone: 'neutral' | 'warn' }) {
  const accent = tone === 'warn' ? 'var(--st-warn, #C28F2C)' : 'var(--ink-soft)';
  return (
    <div
      style={{
        background: 'var(--paper-warm)',
        border: '1px solid var(--paper-deep)',
        borderRadius: 6,
        padding: 12,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
          letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
          color: accent,
        }}
      >
        {label}
      </div>
      <div style={{ marginTop: 4, display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontFamily: 'var(--serif)', fontSize: 'var(--t-lg)', fontWeight: 500 }}>
          {n.toLocaleString()}
        </span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-sm)', color: 'var(--ink-soft)' }}>
          {fmtMoney(usd, 'USD')}
        </span>
      </div>
    </div>
  );
}

function prettifyMethod(s: string): string {
  return s
    .replace('Internal  (Bfast,Mgmt/Staff,IMekong)', 'Internal · staff')
    .replace('Charge Room / to Folio', 'Charge to room')
    .replace('Payment through Office', 'Office')
    .replace('Bank Transfer', 'Bank transfer')
    .replace('Without payment', 'Without payment');
}

// UnmatchedTable moved to _components/UnmatchedReceiptsTable.tsx as a client
// component so month dropdown + client-side search work without server roundtrips.

function HouseAccountTable({ rows }: { rows: Array<{
  receipt_id: number; close_at: string | null; client: string | null;
  order_total: number | null; floor_area: string | null; waiter: string | null;
}> }) {
  if (rows.length === 0) {
    return (
      <div style={{ padding: 18, color: 'var(--ink-mute)', fontStyle: 'italic' }}>
        No house-account receipts in window.
      </div>
    );
  }
  return (
    <div style={{ overflowX: 'auto', padding: 12 }}>
      <table className="tbl" style={{ width: '100%', fontSize: 'var(--t-sm)', color: 'var(--ink)' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Date</th>
            <th style={{ textAlign: 'left' }}>Receipt #</th>
            <th style={{ textAlign: 'left' }}>Client / account</th>
            <th style={{ textAlign: 'left' }}>Area</th>
            <th style={{ textAlign: 'left' }}>Waiter</th>
            <th style={{ textAlign: 'right' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.receipt_id}>
              <td>{r.close_at?.slice(0, 10) ?? '—'}</td>
              <td style={{ fontFamily: 'var(--mono)' }}>{r.receipt_id}</td>
              <td>{r.client ?? '—'}</td>
              <td>{r.floor_area ?? '—'}</td>
              <td>{r.waiter ?? '—'}</td>
              <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>
                {r.order_total != null ? fmtMoney(r.order_total, 'USD') : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VsCloudbedsChart({ rows }: { rows: Array<{
  month_yyyymm: string; poster_room_usd: number; cb_fnb_usd: number; delta_usd: number;
}> }) {
  const w = 720, h = 220, padL = 48, padR = 16, padT = 16, padB = 30;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const max = Math.max(1, ...rows.map((r) => Math.max(r.poster_room_usd, r.cb_fnb_usd)));
  const x = (i: number) => padL + (rows.length === 1 ? innerW / 2 : (i / (rows.length - 1)) * innerW);
  const y = (v: number) => padT + innerH - (v / max) * innerH;
  const path = (key: 'poster_room_usd' | 'cb_fnb_usd') =>
    rows.map((r, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(r[key])}`).join(' ');
  return (
    <div style={{ padding: 12 }}>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 220 }}>
        <text x={4} y={padT + 6} style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--ink-mute)' }}>
          {fmtMoney(max, 'USD')}
        </text>
        <text x={4} y={padT + innerH} style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--ink-mute)' }}>$0</text>
        <path d={path('poster_room_usd')} fill="none" stroke="var(--brass, #C28F2C)" strokeWidth={1.5} />
        <path d={path('cb_fnb_usd')}      fill="none" stroke="var(--moss, #2D6A4F)" strokeWidth={1.5} />
        {rows.map((r, i) =>
          i % Math.max(1, Math.floor(rows.length / 6)) === 0 ? (
            <text key={r.month_yyyymm} x={x(i)} y={h - 12} textAnchor="middle"
                  style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--ink-mute)' }}>
              {r.month_yyyymm}
            </text>
          ) : null,
        )}
      </svg>
      <div style={{ marginTop: 6, display: 'flex', gap: 18, fontSize: 'var(--t-xs)', color: 'var(--ink-soft)' }}>
        <span><span style={{ color: 'var(--brass)' }}>━</span> Poster · charged to room</span>
        <span><span style={{ color: 'var(--moss)' }}>━</span> PMS · F&B</span>
      </div>
    </div>
  );
}
