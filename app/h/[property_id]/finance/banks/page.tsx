// app/h/[property_id]/finance/banks/page.tsx
//
// PBS 2026-05-16: property-scoped Banks page. Donna (property_id=1000001) has
// one Santander EUR account with 9488 imported txns (Dec 2023 → May 2026).
// Namkhan has BCEL/BFL/JDB × USD/LAK. Same view shape; views were rebuilt
// 2026-05-16 to expose property_id so both can be served from the same pipe.

import { notFound } from 'next/navigation';
import Link from 'next/link';
import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import { financeSubPagesForProperty } from '@/app/finance/_subpages';
import TabStrip, { accTabs } from '@/app/finance/_components/TabStrip';
import CoverageMatrixExpandable from '@/app/finance/banks/_components/CoverageMatrixExpandable';
import { getBanksCfoView, type CoverageCell } from '@/lib/data-banks-cfo';
import { fmtMoney } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const KNOWN_LABEL: Record<number, string> = { 260955: 'Namkhan', 1000001: 'Donna' };

export default async function PropertyFinanceBanksPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  if (!KNOWN_LABEL[propertyId]) notFound();

  const v = await getBanksCfoView(propertyId);

  const byAccount: Record<string, CoverageCell[]> = {};
  for (const c of v.coverage) (byAccount[c.account_id] ??= []).push(c);
  const accountOrder = Array.from(new Set(v.coverage.map((c) => c.account_id))).sort();
  const accountMeta: Record<string, { bank_name: string; currency: string }> = {};
  for (const c of v.coverage) {
    if (!accountMeta[c.account_id]) accountMeta[c.account_id] = { bank_name: c.bank_name, currency: c.currency };
  }
  const missingByAccount: Record<string, string[]> = {};
  for (const acct of accountOrder) {
    missingByAccount[acct] = byAccount[acct].filter((c) => !c.has_data).map((c) => c.period_yyyymm);
  }

  const propertyLabel = KNOWN_LABEL[propertyId];
  const isDonna = propertyId === 1000001;
  const totalLabel = isDonna ? 'Total cash · EUR-eq' : 'Total cash · USD-eq';
  const totalValue = isDonna
    ? `€${(v.totalCashUsd / 1.08).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
    : fmtMoney(v.totalCashUsd, 'USD');

  return (
    <Page
      eyebrow={`Finance · Banks · ${propertyLabel}`}
      title={<>Banks · <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>{propertyLabel}</em></>}
      subPages={financeSubPagesForProperty(propertyId)}
    >
      <TabStrip tabs={accTabs(propertyId)} activeKey="banks" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, margin: '12px 0' }}>
        <Kpi value={totalValue} label={totalLabel} tone="brass" />
        <Kpi value={v.balances.length.toString()} label="Accounts" />
        <Kpi value={`${v.coverageStats.coverage_pct}%`} label="Data coverage" warn={v.coverageStats.coverage_pct < 80} />
        <Kpi value={v.coverageStats.cells_missing.toString()} label="Missing months" warn={v.coverageStats.cells_missing > 0} />
        <Kpi value={(v.monthlyFlow.reduce((s, r) => s + Number(r.txn_count || 0), 0)).toString()} label="Txns · 2025+" />
      </div>

      <Panel title="Accounts" eyebrow={`${v.balances.length} account${v.balances.length === 1 ? '' : 's'} · live balance`}>
        <div style={{ overflowX: 'auto', padding: 14 }}>
          <table style={{ width: '100%', fontSize: 'var(--t-sm)', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--tbl-border-strong, var(--paper-deep, #2a261d))' }}>
                <th style={th()}>Account</th>
                <th style={th()}>Bank</th>
                <th style={th()}>Currency</th>
                <th style={{ ...th(), textAlign: 'right' }}>Transactions</th>
                <th style={{ ...th(), textAlign: 'right' }}>Movement (native)</th>
                <th style={{ ...th(), textAlign: 'right' }}>Balance ({isDonna ? 'EUR-eq' : 'USD-eq'})</th>
                <th style={{ ...th(), textAlign: 'right' }}>Last txn</th>
              </tr>
            </thead>
            <tbody>
              {v.balances.map((b) => (
                <tr key={b.account_id} style={{ borderBottom: '1px solid var(--tbl-border, var(--paper-deep, #2a261d))' }}>
                  <td style={td({ weight: 600 })}>{b.account_label}</td>
                  <td style={td({ mute: true })}>{b.bank_name}</td>
                  <td style={td({ mute: true })}>{b.currency}</td>
                  <td style={td({ mono: true, right: true })}>{Number(b.n_txn || 0).toLocaleString('en-US')}</td>
                  <td style={td({ mono: true, right: true })}>
                    {b.currency === 'EUR' ? `€${Math.round(Number(b.movement_native || 0)).toLocaleString('en-US')}`
                      : b.currency === 'LAK' ? `₭${Math.round(Number(b.movement_native || 0)).toLocaleString('en-US')}`
                      : `$${Math.round(Number(b.movement_native || 0)).toLocaleString('en-US')}`}
                  </td>
                  <td style={td({ mono: true, right: true, weight: 600 })}>
                    {isDonna
                      ? `€${(Number(b.balance_usd || 0) / 1.08).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                      : `$${Math.round(Number(b.balance_usd || 0)).toLocaleString('en-US')}`}
                  </td>
                  <td style={td({ mono: true, right: true, mute: true })}>{b.last_txn_date ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div style={{ marginTop: 14 }}>
        <Panel
          title="Data coverage · 2025-01 → today"
          eyebrow={`${v.coverageStats.cells_missing} of ${v.coverageStats.cells_total} account-months missing · click row to expand`}
        >
          <CoverageMatrixExpandable
            months={v.months}
            accountOrder={accountOrder}
            accountMeta={accountMeta}
            byAccount={byAccount}
            missingByAccount={missingByAccount}
          />
        </Panel>
      </div>

      {v.topCounterparties.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <Panel title="Top counterparties · 2025+" eyebrow="ranked by inflow">
            <div style={{ overflowX: 'auto', padding: 14 }}>
              <table style={{ width: '100%', fontSize: 'var(--t-sm)', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--tbl-border-strong, var(--paper-deep, #2a261d))' }}>
                    <th style={th()}>Counterparty</th>
                    <th style={th()}>Category</th>
                    <th style={{ ...th(), textAlign: 'right' }}>Txns</th>
                    <th style={{ ...th(), textAlign: 'right' }}>Inflow · USD</th>
                    <th style={{ ...th(), textAlign: 'right' }}>Outflow · USD</th>
                    <th style={{ ...th(), textAlign: 'right' }}>Net · USD</th>
                  </tr>
                </thead>
                <tbody>
                  {v.topCounterparties.slice(0, 10).map((cp, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--tbl-border, var(--paper-deep, #2a261d))' }}>
                      <td style={td({ weight: 600 })}>{cp.counterparty}</td>
                      <td style={td({ mute: true })}>{cp.category}</td>
                      <td style={td({ mono: true, right: true })}>{cp.txn_count}</td>
                      <td style={td({ mono: true, right: true })}>{fmtMoney(Number(cp.inflow_usd || 0), 'USD')}</td>
                      <td style={td({ mono: true, right: true })}>{fmtMoney(Math.abs(Number(cp.outflow_usd || 0)), 'USD')}</td>
                      <td style={td({ mono: true, right: true, weight: 600 })}>{fmtMoney(Number(cp.net_usd || 0), 'USD')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}

      <div style={{ marginTop: 18, padding: '10px 12px', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', fontStyle: 'italic' }}>
        Source: <code>bank.transactions</code> via <code>public.v_bank_*</code> views (rebuilt 2026-05-16 to expose property_id).
        {isDonna && ' Donna imported from EXTRACTO DONNA.xlsx (9488 txns, single Santander EUR account).'}
        {' '}Reconcile + descriptor search tabs available on the Namkhan page; coming to property-scoped surfaces next.
        {' · '}<Link href="/finance/banks" style={{ color: 'var(--brass)' }}>Open Namkhan banks page →</Link>
      </div>
    </Page>
  );
}

function Kpi({ value, label, tone, warn }: { value: string; label: string; tone?: 'brass'; warn?: boolean }) {
  const accent = warn ? 'var(--st-warn, #C28F2C)' : tone === 'brass' ? 'var(--brass)' : 'var(--brass)';
  return (
    <div style={{
      padding: 12, background: 'var(--paper)', border: '1px solid var(--paper-deep)',
      borderLeft: `3px solid ${accent}`, borderRadius: 6,
    }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 'var(--t-lg)', fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}

function th(): React.CSSProperties {
  return {
    textAlign: 'left', padding: '8px 6px',
    color: 'var(--tbl-fg-mute, var(--ink-mute, #7d7565))',
    fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
    letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', fontWeight: 600,
  };
}

function td(opts: { mono?: boolean; right?: boolean; mute?: boolean; weight?: number } = {}): React.CSSProperties {
  return {
    padding: '8px 6px',
    fontFamily: opts.mono ? 'var(--mono)' : 'inherit',
    textAlign: opts.right ? 'right' : 'left',
    color: opts.mute ? 'var(--tbl-fg-mute, var(--ink-mute, #7d7565))' : 'var(--tbl-fg, var(--ink, #1a1a1a))',
    fontWeight: opts.weight ?? 400,
  };
}
