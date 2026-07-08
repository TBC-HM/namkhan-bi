// app/finance/ledger/_components/BankSection.tsx
//
// Bank cash tab on /finance/ledger. Surfaces the 6 Lao bank accounts (BCEL,
// BFL, JDB × USD/LAK), each account's cash movement, and an empty-state
// onboarding checklist while parsers ship.
//
// Server-rendered (no 'use client') so search-param filtering works without
// JS hydration cost. Search box uses native form submit → URL ?q=… (same
// pattern as /finance/transactions).

import TenantLink from '@/components/nav/TenantLink';
import type { BankView, BankSummaryRow } from '@/lib/data-bank';
import { fmtMoney } from '@/lib/format';

interface Props {
  view: BankView;
  account: string;    // 'all' | account_id
  q: string;          // search text
  basePath: string;   // e.g. '/finance/ledger?tab=bank'
}

export default function BankSection({ view, account, q, basePath }: Props) {
  const { accounts, summary, recent, totals } = view;
  const hasAnyData = totals.n_txn > 0;

  // KPIs derived from already-rolled-up summary
  const cardInflowUsd = summary.reduce((s, r) => s + Number(r.inflow_usd || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ─── Controller-honest empty-state banner ──────────────────── */}
      {!hasAnyData && (
        <div
          style={{
            padding: '12px 14px',
            fontSize: 'var(--t-sm)',
            color: 'var(--ink-soft)',
            background: 'var(--paper-warm)',
            border: '1px solid var(--paper-deep)',
            borderLeft: '3px solid var(--brass)',
            borderRadius: 6,
          }}
        >
          <strong style={{ color: 'var(--brass)' }}>Bank import not started yet.</strong>{' '}
          The schema is live (<code>bank.banks</code> · <code>bank.accounts</code> ·
          <code> bank.transactions</code>) and the 6 accounts below are seeded. To get
          numbers flowing:
          <ol style={{ margin: '8px 0 0 20px', padding: 0 }}>
            <li>
              Drop statement files into the Supabase Storage bucket{' '}
              <a
                href="https://supabase.com/dashboard/project/kpenyneooigsyuuomgct/storage/buckets/bank-statements"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--brass)', textDecoration: 'underline' }}
              >
                <code>bank-statements/</code>
              </a>{' '}
              under <code>&lt;bank&gt;/&lt;YYYY&gt;/&lt;filename&gt;</code>
              {' '}(e.g. <code>bcel/2026/202604_usd.csv</code>).
            </li>
            <li>
              Confirm the export format for each bank (CSV, XLSX, PDF) and one
              sample descriptor line — I&apos;ll wire the parser per bank.
            </li>
            <li>
              Descriptor rule engine seeded with 9 universal regexes
              (payroll, EDL, OTA, card settlement, etc.) — extend at
              <code> bank.descriptor_rules</code>.
            </li>
          </ol>
        </div>
      )}

      {/* ─── KPI band ───────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
        }}
      >
        <Kpi value={fmtMoney(totals.inflow_usd, 'USD')}  label="Inflow · USD"        hint="Σ amount_usd > 0 across all bank accounts" tone="brass" />
        <Kpi value={fmtMoney(Math.abs(totals.outflow_usd), 'USD')} label="Outflow · USD" hint="Σ |amount_usd| < 0 across all bank accounts" tone="brass" />
        <Kpi value={fmtMoney(totals.net_usd, 'USD')}     label="Net movement · USD"  hint="inflow − outflow" />
        <Kpi value={totals.n_txn.toLocaleString()}        label="Transactions"         hint="Total imported line items across 6 accounts" />
        <Kpi value={`${totals.reconciled_pct}%`}          label="Reconciled · %"       hint="Bank rows matched to PMS/POS/supplier/payroll" />
        <Kpi value={`${totals.accounts_with_data}/${accounts.length}`} label="Accounts loaded" hint="Accounts with at least one imported transaction" warn={totals.accounts_empty > 0} />
        <Kpi value={fmtMoney(cardInflowUsd, 'USD')}      label="Card settlement · in"  hint="Once card-settlement category resolves: bank credits tagged 'card_settlement'. Match key for POS reconcile." />
        <Kpi value="—"                                    label="Bank-matched cash"     hint="Unlocked once parser + rules run" warn />
      </div>

      {/* ─── Account roll-up table ──────────────────────────────────── */}
      <div>
        <SectionTitle>Accounts · per-account cash movement</SectionTitle>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl" style={{ width: '100%', fontSize: 'var(--t-sm)' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Bank</th>
                <th style={{ textAlign: 'left' }}>Account</th>
                <th style={{ textAlign: 'left' }}>Currency</th>
                <th style={{ textAlign: 'right' }}>Inflow $</th>
                <th style={{ textAlign: 'right' }}>Outflow $</th>
                <th style={{ textAlign: 'right' }}>Net $</th>
                <th style={{ textAlign: 'right' }}>Txns</th>
                <th style={{ textAlign: 'left' }}>First → last</th>
                <th style={{ textAlign: 'right' }}>Reconciled</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((r) => <AccountRow key={r.account_id} r={r} />)}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Filter strip + descriptor search ───────────────────────── */}
      <div
        style={{
          display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end',
          padding: 10,
          background: 'var(--paper-warm)',
          border: '1px solid var(--paper-deep)',
          borderRadius: 6,
        }}
      >
        <form method="get" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', flex: '1 1 600px' }}>
          <input type="hidden" name="tab" value="bank" />
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="t-eyebrow">Account</span>
            <select
              name="account"
              defaultValue={account}
              style={{ padding: '6px 10px', border: '1px solid var(--rule)', borderRadius: 4, font: 'inherit', minWidth: 200 }}
            >
              <option value="all">All accounts</option>
              {summary.map((r) => (
                <option key={r.account_id} value={r.account_id}>
                  {r.bank_name} · {r.currency} ({r.n_txn})
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 280px' }}>
            <span className="t-eyebrow">Descriptor search</span>
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="e.g. EDL, Booking.com, salary, supplier name…"
              style={{ padding: '6px 10px', border: '1px solid var(--rule)', borderRadius: 4, font: 'inherit', width: '100%' }}
            />
          </label>
          <button
            type="submit"
            style={{
              padding: '6px 14px', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
              letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
              background: 'var(--brass)', color: '#fff', border: 'none',
              borderRadius: 4, cursor: 'pointer', fontWeight: 700,
            }}
          >
            Apply
          </button>
          {(q || account !== 'all') && (
            <TenantLink href="/finance/ledger?tab=bank" style={{ color: 'var(--ink-mute)', fontSize: 'var(--t-xs)', textDecoration: 'underline', alignSelf: 'center' }}>
              clear
            </TenantLink>
          )}
        </form>
      </div>

      {/* ─── Transactions table ────────────────────────────────────── */}
      <div>
        <SectionTitle>
          Recent transactions
          {' · '}
          {recent.length === 200 ? 'showing latest 200' : `${recent.length} rows`}
          {q && <> · matching <em>“{q}”</em></>}
          {account !== 'all' && <> · {summary.find((s) => s.account_id === account)?.account_label}</>}
        </SectionTitle>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl" style={{ width: '100%', fontSize: 'var(--t-sm)' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Date</th>
                <th style={{ textAlign: 'left' }}>Bank · Acct</th>
                <th style={{ textAlign: 'left' }}>Descriptor</th>
                <th style={{ textAlign: 'left' }}>Counterparty</th>
                <th style={{ textAlign: 'left' }}>Category</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th style={{ textAlign: 'right' }}>USD</th>
                <th style={{ textAlign: 'center' }}>Reconciled</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: 24, textAlign: 'center', color: 'var(--ink-mute)', fontStyle: 'italic' }}>
                    No transactions yet. Drop statements in <code>bank-statements/</code> to populate.
                  </td>
                </tr>
              )}
              {recent.map((r) => (
                <tr key={r.txn_id}>
                  <td style={{ fontFamily: 'var(--mono)' }}>{r.txn_date}</td>
                  <td style={{ color: 'var(--ink-soft)' }}>
                    <strong>{r.bank_name}</strong> · {r.currency}
                  </td>
                  <td style={{ fontSize: 'var(--t-xs)', fontFamily: 'var(--mono)', color: 'var(--ink-soft)', maxWidth: 320 }}>
                    {r.descriptor_raw ?? '—'}
                  </td>
                  <td>{r.counterparty ?? <span style={{ color: 'var(--ink-mute)' }}>—</span>}</td>
                  <td style={{ color: 'var(--ink-soft)' }}>{r.category ?? <span style={{ color: 'var(--ink-mute)' }}>—</span>}</td>
                  <td
                    style={{
                      textAlign: 'right', fontFamily: 'var(--mono)',
                      color: r.amount >= 0 ? 'var(--moss, #2D6A4F)' : 'var(--st-bad, #B23B3B)',
                    }}
                  >
                    {fmtMoney(Number(r.amount), (r.currency === 'LAK' ? 'LAK' : 'USD'))}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>
                    {r.amount_usd == null ? '—' : fmtMoney(Number(r.amount_usd), 'USD')}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {r.reconciled ? '✓' : <span style={{ color: 'var(--ink-mute)' }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Acknowledge unused for now to silence lint */}
      <div style={{ display: 'none' }}>{basePath}</div>
    </div>
  );
}

function AccountRow({ r }: { r: BankSummaryRow }) {
  const empty = Number(r.n_txn || 0) === 0;
  return (
    <tr style={{ opacity: empty ? 0.55 : 1 }}>
      <td style={{ fontWeight: 600 }}>{r.bank_name}</td>
      <td>{r.account_label}</td>
      <td style={{ fontFamily: 'var(--mono)', color: 'var(--ink-soft)' }}>{r.currency}</td>
      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--moss, #2D6A4F)' }}>
        {empty ? '—' : fmtMoney(Number(r.inflow_usd), 'USD')}
      </td>
      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--st-bad, #B23B3B)' }}>
        {empty ? '—' : fmtMoney(Math.abs(Number(r.outflow_usd)), 'USD')}
      </td>
      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 600 }}>
        {empty ? '—' : fmtMoney(Number(r.net_usd), 'USD')}
      </td>
      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>{r.n_txn}</td>
      <td style={{ fontFamily: 'var(--mono)', color: 'var(--ink-mute)', fontSize: 'var(--t-xs)' }}>
        {empty ? 'no data yet' : `${r.first_txn ?? '—'} → ${r.last_txn ?? '—'}`}
      </td>
      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>
        {empty ? '—' : `${r.reconciled_n} / ${Number(r.reconciled_n) + Number(r.unreconciled_n)}`}
      </td>
    </tr>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: '8px 12px',
        fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
        letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
        color: 'var(--brass)', fontWeight: 700,
      }}
    >
      {children}
    </div>
  );
}

function Kpi({
  value, label, hint, warn, tone,
}: {
  value: number | string;
  label: string;
  hint?: string;
  warn?: boolean;
  tone?: 'brass' | 'default';
}) {
  const accent = warn ? 'var(--st-warn, #C28F2C)' : 'var(--brass)';
  return (
    <div
      title={hint}
      style={{
        padding: 12,
        background: 'var(--paper-warm)',
        border: '1px solid var(--paper-deep)',
        borderLeft: `3px solid ${accent}`,
        borderRadius: 6,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
          letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
          color: 'var(--ink-mute)',
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 4,
          fontSize: 'var(--t-lg)', fontWeight: 600,
          color: warn ? 'var(--ink-mute)' : tone === 'brass' ? 'var(--brass)' : 'var(--ink)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
    </div>
  );
}
