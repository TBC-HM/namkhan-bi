// app/finance/banks/page.tsx
//
// Finance · Banks — CFO command centre for BCEL · BFL · JDB × USD/LAK.
//
// Three tabs (?tab=overview|analytics|reconcile):
//   1. Overview    — tiles → graphs → lookup container → recent table
//   2. Analytics   — supplier rollup + recurring vs one-off + card patterns
//   3. Reconcile   — bank credits ↔ Cloudbeds payments matching engine
//
// FX: LAK→USD at static 21,800 until fx.rates_daily is wired (memory).
// PBS canonical rhythm: tiles top → graphs → lookup → tables.
//
// PBS 2026-05-15.

import TenantLink from '@/components/nav/TenantLink';
import { DashboardPage, Container } from '@/app/(cockpit)/_design';

import { FINANCE_SUBPAGES } from '../_subpages';
import TabStrip, { ACC_TABS } from '../_components/TabStrip';
import CoverageMatrixExpandable from './_components/CoverageMatrixExpandable';
import { fmtMoney } from '@/lib/format';
import {
  getBanksCfoView, getBankLookup, getReconcileHealth, getReconcileCandidates,
  type CoverageCell, type MonthlyFlowRow, type AccountBalanceRow,
  type LookupRow, type ReconcileHealth, type ReconcileCandidate, type CounterpartyRow,
} from '@/lib/data-banks-cfo';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

type Tab = 'overview' | 'analytics' | 'reconcile';

interface Props { searchParams: Record<string, string | string[] | undefined>; }

export default async function BanksPage({ searchParams }: Props) {
  const tabParam = (searchParams.tab as string) ?? '';
  const tab: Tab =
    tabParam === 'analytics' ? 'analytics' :
    tabParam === 'reconcile' ? 'reconcile' :
    'overview';

  // Lookup container state (Overview tab)
  const q      = (searchParams.q as string) ?? '';
  const period = ((searchParams.period as string) ?? 'ytd') as 'all' | '30d' | '90d' | 'ytd';
  const type   = ((searchParams.type   as string) ?? 'all') as 'all' | 'in' | 'out';

  const [v, lookup, recHealth, recCandidates] = await Promise.all([
    getBanksCfoView(),
    tab === 'overview'  ? getBankLookup({ q, period, type, limit: 200 }) : Promise.resolve([] as LookupRow[]),
    tab === 'reconcile' ? getReconcileHealth() : Promise.resolve({
      bank_credit_n: 0, bank_credit_usd: 0, matched_n: 0, matched_usd: 0, matched_pct: 0,
      cb_payment_n: 0, cb_payment_usd: 0, candidates_n: 0, high_confidence_n: 0,
    } as ReconcileHealth),
    tab === 'reconcile' ? getReconcileCandidates(200) : Promise.resolve([] as ReconcileCandidate[]),
  ]);

  const tabLabel =
    tab === 'analytics' ? 'Analytics' :
    tab === 'reconcile' ? 'Reconcile · PMS' :
    'Overview';
  const eyebrow = [
    'Finance · Banks',
    `Tab: ${tabLabel}`,
    `${v.balances.length} accounts · ${v.coverageStats.accounts_with_any_data} loaded`,
    `Coverage ${v.coverageStats.coverage_pct}%`,
  ].join(' · ');

  return (
    <DashboardPage
      title="Banks · cash command"
      subtitle={eyebrow}
      tabs={FINANCE_SUBPAGES.map(s => ({ key: s.href, label: s.label, href: s.href, active: s.href === '/finance/acc' }))}
    >
      <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* ─── Acc hub strip (Transactions · Banks · POS) ────────────── */}
      <TabStrip tabs={ACC_TABS} activeKey="banks" />

      {/* ─── Banks inner tabs ──────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--paper-deep)', marginBottom: 12 }}>
        <TabLink href="/finance/banks?tab=overview"  active={tab === 'overview'}>
          Overview · {v.coverageStats.accounts_with_any_data}/{v.balances.length} loaded
        </TabLink>
        <TabLink href="/finance/banks?tab=analytics" active={tab === 'analytics'}>
          Analytics · {v.topCounterparties.length} counterparties
        </TabLink>
        <TabLink href="/finance/banks?tab=reconcile" active={tab === 'reconcile'}>
          Reconcile · PMS · {recHealth.matched_pct}% matched
        </TabLink>
      </div>

      {/* ─── TAB 1 · OVERVIEW ──────────────────────────────────────── */}
      {tab === 'overview' && (
        <OverviewTab v={v} lookup={lookup} q={q} period={period} type={type} />
      )}

      {/* ─── TAB 2 · ANALYTICS ─────────────────────────────────────── */}
      {tab === 'analytics' && (
        <AnalyticsTab v={v} />
      )}

      {/* ─── TAB 3 · RECONCILE ─────────────────────────────────────── */}
      {tab === 'reconcile' && (
        <ReconcileTab health={recHealth} candidates={recCandidates} />
      )}
      </div>
    </DashboardPage>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TAB 1 · OVERVIEW
// ═══════════════════════════════════════════════════════════════════════
function OverviewTab({
  v, lookup, q, period, type,
}: {
  v: Awaited<ReturnType<typeof getBanksCfoView>>;
  lookup: LookupRow[];
  q: string;
  period: 'all' | '30d' | '90d' | 'ytd';
  type: 'all' | 'in' | 'out';
}) {
  const { coverage, months, coverageStats } = v;
  const byAccount: Record<string, CoverageCell[]> = {};
  for (const c of coverage) (byAccount[c.account_id] ??= []).push(c);
  const accountOrder = Array.from(new Set(coverage.map((c) => c.account_id))).sort();
  const accountMeta: Record<string, { bank_name: string; currency: string }> = {};
  for (const c of coverage) {
    if (!accountMeta[c.account_id]) accountMeta[c.account_id] = { bank_name: c.bank_name, currency: c.currency };
  }
  const missingByAccount: Record<string, number> = {};
  for (const acct of accountOrder) {
    missingByAccount[acct] = byAccount[acct].filter((c) => !c.has_data).length;
  }

  return (
    <>
      {/* 1 · Headline — cash position + YTD flow, all 10 tiles in one strip */}
      <Container title="Headline · cash position + YTD flow" subtitle="position (top) + flow (bottom) · USD-equivalent" density="compact">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          <Kpi value={fmtMoney(v.totalCashUsd, 'USD')} label="Total cash · USD-eq" hint="Σ opening + Σ txns, LAK FX'd to USD at 21,800" tone="brass" />
          <Kpi value={fmtMoney(v.usdCashUsd, 'USD')}   label="USD accounts" />
          <Kpi value={fmtMoney(v.lakCashUsd, 'USD')}   label="LAK accounts · USD-eq" />
          <Kpi value={`${v.fxExposurePct}%`}           label="FX exposure (LAK %)" warn={v.fxExposurePct > 30} />
          <Kpi value={`${coverageStats.coverage_pct}%`} label="Data coverage" warn={coverageStats.coverage_pct < 80} />
          <Kpi value={fmtMoney(v.ytdInflowUsd, 'USD')}             label="Inflow · YTD" tone="brass" />
          <Kpi value={fmtMoney(Math.abs(v.ytdOutflowUsd), 'USD')}  label="Outflow · YTD" tone="brass" />
          <Kpi value={fmtMoney(v.ytdNetUsd, 'USD')}                label="Net cash · YTD" />
          <Kpi value={`${v.ytdReconciledPct}%`}                    label="Reconciled · %" warn />
          <Kpi value={`${coverageStats.accounts_empty}/${v.balances.length}`} label="Accounts empty" warn={coverageStats.accounts_empty > 0} />
        </div>
      </Container>

      <div style={{ height: 14 }} />

      {/* 2 · Graphs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 12 }}>
        <Container title="Balance trajectory · USD-eq" subtitle="cumulative net cash">
          <BalanceTrajectoryChart months={months} flow={v.monthlyFlow} totalCash={v.totalCashUsd} />
        </Container>
        <Container title="Monthly flow · in vs out" subtitle="2025-01 onwards · hover for value">
          <MonthlyFlowChart months={months} flow={v.monthlyFlow} />
        </Container>
        <Container title="Top counterparties · USD" subtitle="ranked by inflow · top 10">
          <TopCounterpartiesChart rows={v.topCounterparties} />
        </Container>
      </div>

      <div style={{ height: 14 }} />

      {/* 3 · Data coverage matrix · compact · with FC CTA */}
      <Container
        title="Data coverage · 2025-01 → today"
        subtitle={`${coverageStats.cells_missing} of ${coverageStats.cells_total} account-months missing · click ✉ to request from FC`}
        action={<MasterRequestCTA
          accountOrder={accountOrder}
          accountMeta={accountMeta}
          missingByAccount={(() => {
            const m: Record<string, string[]> = {};
            for (const acct of accountOrder) m[acct] = byAccount[acct].filter((c) => !c.has_data).map((c) => c.period_yyyymm);
            return m;
          })()}
        />}
      >
        <CoverageMatrixExpandable
          months={months}
          accountOrder={accountOrder}
          accountMeta={accountMeta}
          byAccount={byAccount}
          missingByAccount={(() => {
            const m: Record<string, string[]> = {};
            for (const acct of accountOrder) m[acct] = byAccount[acct].filter((c) => !c.has_data).map((c) => c.period_yyyymm);
            return m;
          })()}
        />
      </Container>

      <div style={{ height: 14 }} />

      {/* 4 · Lookup container */}
      <Container
        title="Look up · descriptor search"
        subtitle="free-text · period · type · type 'booking' to match Booking.com etc."
      >
        <form method="get" style={{
          display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end',
          padding: '12px 14px', background: 'var(--paper-warm)',
          border: '1px solid var(--paper-deep)', borderRadius: 6,
        }}>
          <input type="hidden" name="tab" value="overview" />
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 280px' }}>
            <span className="t-eyebrow">Search descriptor / counterparty / category</span>
            <input
              type="search" name="q" defaultValue={q}
              placeholder="e.g. booking, EDL, salary, supplier name…"
              style={{ padding: '6px 10px', border: '1px solid var(--rule)', borderRadius: 4, font: 'inherit', width: '100%' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="t-eyebrow">Period</span>
            <select name="period" defaultValue={period}
              style={{ padding: '6px 10px', border: '1px solid var(--rule)', borderRadius: 4, font: 'inherit', minWidth: 120 }}
            >
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="ytd">YTD</option>
              <option value="all">All time</option>
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="t-eyebrow">Transaction type</span>
            <select name="type" defaultValue={type}
              style={{ padding: '6px 10px', border: '1px solid var(--rule)', borderRadius: 4, font: 'inherit', minWidth: 140 }}
            >
              <option value="all">All</option>
              <option value="in">Inflow only</option>
              <option value="out">Outflow only</option>
            </select>
          </label>
          <button type="submit" style={{
            padding: '6px 14px', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
            letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
            background: 'var(--brass)', color: '#fff', border: 'none',
            borderRadius: 4, cursor: 'pointer', fontWeight: 700,
          }}>Apply</button>
          {(q || period !== 'ytd' || type !== 'all') && (
            <TenantLink href="/finance/banks?tab=overview" style={{ color: 'var(--ink-mute)', fontSize: 'var(--t-xs)', textDecoration: 'underline', alignSelf: 'center' }}>
              clear
            </TenantLink>
          )}
        </form>
      </Container>

      <div style={{ height: 14 }} />

      {/* 5 · Tables — lookup results + account balances */}
      <Container
        title={`Lookup results · ${lookup.length}${lookup.length === 200 ? ' (capped)' : ''}`}
        subtitle={[
          q && `“${q}”`,
          period !== 'all' && period,
          type !== 'all' && (type === 'in' ? 'inflow only' : 'outflow only'),
        ].filter(Boolean).join(' · ') || 'all rows · 200 most recent'}
      >
        <LookupTable rows={lookup} />
      </Container>

      <div style={{ height: 14 }} />

      <Container title="Account balances · USD-equivalent" subtitle="opening + Σ txns">
        <AccountBalanceTable rows={v.balances} />
      </Container>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TAB 2 · ANALYTICS
// ═══════════════════════════════════════════════════════════════════════
function AnalyticsTab({ v }: { v: Awaited<ReturnType<typeof getBanksCfoView>> }) {
  const inflows  = v.topCounterparties.filter((r) => Number(r.inflow_usd  || 0) > 0).sort((a, b) => b.inflow_usd  - a.inflow_usd).slice(0, 15);
  const outflows = v.topCounterparties.filter((r) => Number(r.outflow_usd || 0) > 0).sort((a, b) => b.outflow_usd - a.outflow_usd).slice(0, 15);
  const categoryRollup = aggByCategory(v.topCounterparties);
  const hasData = v.topCounterparties.length > 0;

  return (
    <>
      {/* 1 · KPI band */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        <Kpi value={inflows.length}                                  label="Inflow counterparties" hint="Distinct payers (top 15 below)" tone="brass" />
        <Kpi value={outflows.length}                                 label="Outflow counterparties" hint="Distinct payees / suppliers" tone="brass" />
        <Kpi value={categoryRollup.cardSettlements.toLocaleString()} label="Card txns" hint="Categories: card_settlement" />
        <Kpi value={fmtMoney(categoryRollup.cardSettlementsUsd, 'USD')} label="Card settlements · USD" />
        <Kpi value={categoryRollup.recurringSuppliers}               label="Recurring suppliers" hint="≥3 outflow events same counterparty" warn={!hasData} />
      </div>

      <div style={{ height: 14 }} />

      {/* 2 · Graphs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 12 }}>
        <Container title="Inflow Pareto · top 15" subtitle="ranked by inflow USD">
          <CounterpartyPareto rows={inflows} kind="in" />
        </Container>
        <Container title="Outflow Pareto · top 15" subtitle="ranked by outflow USD · highest spend on top">
          <CounterpartyPareto rows={outflows} kind="out" />
        </Container>
        <Container title="Category split · USD" subtitle="net flow per descriptor category">
          <CategoryBars rows={categoryRollup.byCategory} />
        </Container>
      </div>

      <div style={{ height: 14 }} />

      {/* 3 · Tables */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Container title="Top inflow counterparties" subtitle="who pays us">
          <SmallTable cols={['Counterparty', 'Category', 'Txns', 'Inflow $']} rows={inflows.map((r) => [
            r.counterparty, r.category, r.txn_count, fmtMoney(r.inflow_usd, 'USD'),
          ])} />
        </Container>
        <Container title="Top outflow counterparties" subtitle="who we pay">
          <SmallTable cols={['Counterparty', 'Category', 'Txns', 'Outflow $']} rows={outflows.map((r) => [
            r.counterparty, r.category, r.txn_count, fmtMoney(r.outflow_usd, 'USD'),
          ])} />
        </Container>
      </div>

      {!hasData && (
        <>
          <div style={{ height: 14 }} />
          <div style={{
            padding: '12px 14px', fontSize: 'var(--t-xs)', color: 'var(--ink-soft)',
            background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)',
            borderLeft: '3px solid var(--brass)', borderRadius: 6,
          }}>
            <strong>Analytics empty</strong> · the moment one bank statement lands, the descriptor rule
            engine (9 rules seeded · extend at <code>bank.descriptor_rules</code>) classifies every line
            and these tables populate automatically. Pareto charts, recurring-supplier detection, and
            card-settlement totals all derive from <code>public.v_bank_top_counterparties</code>.
          </div>
        </>
      )}
    </>
  );
}

function aggByCategory(rows: CounterpartyRow[]) {
  const byCat = new Map<string, { name: string; in_usd: number; out_usd: number; n: number }>();
  for (const r of rows) {
    const c = r.category || '— uncategorised —';
    const x = byCat.get(c) ?? { name: c, in_usd: 0, out_usd: 0, n: 0 };
    x.in_usd  += Number(r.inflow_usd  || 0);
    x.out_usd += Number(r.outflow_usd || 0);
    x.n       += Number(r.txn_count   || 0);
    byCat.set(c, x);
  }
  const byCategory = Array.from(byCat.values()).sort((a, b) => (b.in_usd + b.out_usd) - (a.in_usd + a.out_usd));
  const cardCat = byCategory.find((c) => c.name === 'card_settlement');
  const recurringSuppliers = rows.filter((r) => r.category === 'supplier' && r.txn_count >= 3).length;
  return {
    byCategory,
    cardSettlements: cardCat?.n ?? 0,
    cardSettlementsUsd: cardCat?.in_usd ?? 0,
    recurringSuppliers,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// TAB 3 · RECONCILE · CLOUDBEDS
// ═══════════════════════════════════════════════════════════════════════
function ReconcileTab({ health, candidates }: { health: ReconcileHealth; candidates: ReconcileCandidate[] }) {
  const high = candidates.filter((c) => c.match_score >= 80);
  const med  = candidates.filter((c) => c.match_score >= 50 && c.match_score < 80);
  const low  = candidates.filter((c) => c.match_score < 50);

  return (
    <>
      {/* 1 · KPI band */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        <Kpi value={`${health.matched_pct}%`}                       label="Bank credits matched · %" tone="brass" warn={health.matched_pct < 80} />
        <Kpi value={fmtMoney(health.matched_usd, 'USD')}            label="Matched · USD" />
        <Kpi value={fmtMoney(health.bank_credit_usd - health.matched_usd, 'USD')} label="Unmatched · USD" warn />
        <Kpi value={health.candidates_n.toLocaleString()}           label="Candidate matches" hint="Bank credits with ≥1 plausible PMS payment match (±3d, ±$1)" />
        <Kpi value={health.high_confidence_n.toLocaleString()}      label="High-confidence" hint="match_score ≥ 80 — safe to auto-confirm" tone="brass" />
      </div>
      <div style={{ height: 10 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        <Kpi value={health.bank_credit_n.toLocaleString()}          label="Bank credits · count" />
        <Kpi value={fmtMoney(health.bank_credit_usd, 'USD')}        label="Bank credits · USD" />
        <Kpi value={health.cb_payment_n.toLocaleString()}           label="PMS payments · count" />
        <Kpi value={fmtMoney(health.cb_payment_usd, 'USD')}         label="PMS payments · USD" />
        <Kpi value={fmtMoney(Math.max(0, health.cb_payment_usd - health.matched_usd), 'USD')} label="CB without bank · USD" hint="PMS-side payments not yet matched to a bank credit" warn />
      </div>

      <div style={{ height: 14 }} />

      {/* 2 · Strategy / explainer */}
      <Container title="How the matcher works" subtitle="v_bank_cloudbeds_reconcile_candidates · ±3 days · ±$1 USD · method affinity">
        <div style={{ padding: 14, fontSize: 'var(--t-sm)', color: 'var(--ink-soft)' }}>
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            <li><strong>Date window:</strong> bank_date within ±3 days of PMS pay_date (covers settlement lag).</li>
            <li><strong>Amount window:</strong> |bank_amount − cb_amount| ≤ $1.00 (FX rounding tolerance).</li>
            <li><strong>Method affinity:</strong> bonus points when descriptor mentions card brand (visa/master/amex).</li>
            <li><strong>Score 0–100</strong>: 50 amount + 30 date + 20 method. <strong>≥80 = high-confidence</strong> (safe to auto-confirm).</li>
            <li><strong>Manual override:</strong> set <code>bank.transactions.reconciled = true</code> and <code>reconciled_with = cb_txn_id</code>.</li>
          </ol>
        </div>
      </Container>

      <div style={{ height: 14 }} />

      {/* 3 · Candidate match tables */}
      <Container title={`High-confidence matches · ${high.length}`} subtitle="score ≥ 80 · safe to confirm">
        <ReconcileTable rows={high} />
      </Container>
      <div style={{ height: 14 }} />
      <Container title={`Medium-confidence matches · ${med.length}`} subtitle="score 50-79 · review manually">
        <ReconcileTable rows={med} />
      </Container>
      <div style={{ height: 14 }} />
      <Container title={`Low-confidence matches · ${low.length}`} subtitle="score < 50 · likely false positive">
        <ReconcileTable rows={low} />
      </Container>

      {health.bank_credit_n === 0 && (
        <>
          <div style={{ height: 14 }} />
          <div style={{
            padding: '12px 14px', fontSize: 'var(--t-xs)', color: 'var(--ink-soft)',
            background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)',
            borderLeft: '3px solid var(--brass)', borderRadius: 6,
          }}>
            <strong>Reconcile engine empty</strong> · we have {health.cb_payment_n.toLocaleString()} PMS payments
            ({fmtMoney(health.cb_payment_usd, 'USD')}) waiting to be matched. The matcher fires automatically
            once bank credits land in <code>bank.transactions</code>. Upload a statement to see this fill in.
          </div>
        </>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════════════
function TabLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <TenantLink href={href} style={{
      padding: '10px 20px', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
      letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
      textDecoration: 'none', fontWeight: active ? 700 : 500,
      color: active ? 'var(--brass)' : 'var(--ink-soft)',
      borderBottom: active ? '2px solid var(--brass)' : '2px solid transparent',
      marginBottom: -1,
    }}>
      {children}
    </TenantLink>
  );
}

function Kpi({ value, label, hint, warn, tone }: {
  value: number | string;
  label: string;
  hint?: string;
  warn?: boolean;
  tone?: 'brass' | 'default';
}) {
  const accent = warn ? 'var(--st-warn, #C28F2C)' : 'var(--brass)';
  return (
    <div title={hint} style={{
      padding: 12, background: 'var(--paper-warm)',
      border: '1px solid var(--paper-deep)', borderLeft: `3px solid ${accent}`,
      borderRadius: 6,
    }}>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
        letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
        color: 'var(--ink-mute)',
      }}>{label}</div>
      <div style={{
        marginTop: 4, fontSize: 'var(--t-lg)', fontWeight: 600,
        color: warn ? 'var(--ink-mute)' : tone === 'brass' ? 'var(--brass)' : 'var(--ink)',
        fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
    </div>
  );
}

// Slim compact matrix · 16-month band · request-CTA per row.
// PBS 2026-05-15: was full-width tall; now reads as a status strip.
function CoverageMatrixCompact({
  months, accountOrder, accountMeta, byAccount, missingByAccount,
}: {
  months: string[];
  accountOrder: string[];
  accountMeta: Record<string, { bank_name: string; currency: string }>;
  byAccount: Record<string, CoverageCell[]>;
  missingByAccount: Record<string, string[]>;
}) {
  return (
    <div style={{ overflowX: 'auto', padding: 4 }}>
      <table style={{ borderCollapse: 'separate', borderSpacing: 0, fontSize: 10, lineHeight: 1.15 }}>
        <thead>
          <tr>
            <th style={{ ...thCompact('left'), minWidth: 100 }}>Account</th>
            {months.map((m) => (
              <th key={m} style={{ ...thCompact('center'), minWidth: 22 }}>{m.slice(5)}</th>
            ))}
            <th style={thCompact('right')}>Miss</th>
            <th style={thCompact('center')}>Request</th>
          </tr>
        </thead>
        <tbody>
          {accountOrder.map((acct) => {
            const meta = accountMeta[acct];
            const cells = byAccount[acct];
            const miss = missingByAccount[acct];
            return (
              <tr key={acct}>
                <td style={{
                  padding: '2px 8px 2px 4px',
                  fontFamily: 'var(--mono)', fontWeight: 600,
                  whiteSpace: 'nowrap', fontSize: 11,
                }}>
                  <strong>{meta.bank_name}</strong>·{meta.currency}
                </td>
                {cells.map((c) => (
                  <td key={c.period_yyyymm}
                    title={c.has_data
                      ? `${meta.bank_name} ${meta.currency} · ${c.period_yyyymm} · ${c.txn_count} txns`
                      : `${meta.bank_name} ${meta.currency} · ${c.period_yyyymm} · NO DATA`}
                    style={{
                      width: 18, height: 14, padding: 0, textAlign: 'center',
                      background: c.has_data
                        ? `rgba(45,106,79,${Math.min(0.25 + (c.txn_count / 100), 0.9)})`
                        : 'rgba(178,59,59,0.10)',
                      color: c.has_data ? '#fff' : 'transparent',
                      border: '1px solid var(--paper-deep)',
                      fontFamily: 'var(--mono)', fontSize: 9,
                    }}>
                    {c.has_data ? '·' : ''}
                  </td>
                ))}
                <td style={{
                  padding: '2px 6px', textAlign: 'right',
                  fontFamily: 'var(--mono)', fontWeight: 600, fontSize: 11,
                  color: miss.length > 0 ? 'var(--st-bad, #B23B3B)' : 'var(--moss, #2D6A4F)',
                }}>
                  {miss.length}
                </td>
                <td style={{ padding: '0 4px', textAlign: 'center' }}>
                  {miss.length > 0
                    ? <RowRequestCTA bank={meta.bank_name} currency={meta.currency} months={miss} />
                    : <span style={{ color: 'var(--moss, #2D6A4F)' }}>✓</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ marginTop: 6, fontSize: 10, color: 'var(--ink-mute)' }}>
        🟩 loaded · 🟥 missing · click ✉ per row to email FC the exact missing months.
      </div>
    </div>
  );
}

// Per-row mailto CTA — pre-fills subject + body asking FC for the missing months
function RowRequestCTA({ bank, currency, months }: { bank: string; currency: string; months: string[] }) {
  const subject = encodeURIComponent(`Bank statement request · ${bank} ${currency} · ${months.length} months missing`);
  const body = encodeURIComponent(
    [
      `Hi FC,`,
      ``,
      `Please provide the bank statements for the following account-months — they're missing in our BI system:`,
      ``,
      `Bank:     ${bank}`,
      `Currency: ${currency}`,
      `Months:   ${months.join(', ')}`,
      ``,
      `Preferred format: CSV or XLSX (PDF works too). Drop into the shared finance Drive or reply by email.`,
      `Once you send them I'll import them into the system the same day.`,
      ``,
      `Thanks,`,
      `Paul (pb@thenamkhan.com)`,
    ].join('\n'),
  );
  const href = `mailto:fc@thenamkhan.com?cc=pb@thenamkhan.com&subject=${subject}&body=${body}`;
  return (
    <a
      href={href}
      title={`Email FC for ${bank} ${currency} · ${months.length} missing months`}
      style={{
        display: 'inline-block', padding: '1px 6px',
        fontFamily: 'var(--mono)', fontSize: 10,
        background: 'var(--brass)', color: '#fff',
        border: 'none', borderRadius: 3,
        textDecoration: 'none', fontWeight: 700,
      }}
    >
      ✉
    </a>
  );
}

// Master CTA — emails FC for ALL missing data across all 6 accounts
function MasterRequestCTA({
  accountOrder, accountMeta, missingByAccount,
}: {
  accountOrder: string[];
  accountMeta: Record<string, { bank_name: string; currency: string }>;
  missingByAccount: Record<string, string[]>;
}) {
  const lines: string[] = [];
  let totalMissing = 0;
  for (const acct of accountOrder) {
    const miss = missingByAccount[acct];
    if (miss.length === 0) continue;
    const meta = accountMeta[acct];
    totalMissing += miss.length;
    lines.push(`• ${meta.bank_name} ${meta.currency} · ${miss.length} months · ${miss.join(', ')}`);
  }
  if (totalMissing === 0) return <span style={{ fontSize: 11, color: 'var(--moss, #2D6A4F)' }}>✓ all loaded</span>;
  const subject = encodeURIComponent(`Bank statement request · ${totalMissing} account-months missing`);
  const body = encodeURIComponent(
    [
      `Hi FC,`,
      ``,
      `Please provide the bank statements listed below — they're missing in our BI system from 2025-01 onwards.`,
      ``,
      ...lines,
      ``,
      `Preferred format: CSV or XLSX (PDF works too). Drop into the shared finance Drive or reply by email.`,
      `Priority order for a CFO view: BCEL USD (OTA + card settlements) → BCEL LAK (supplier AP) → BFL USD (payroll wires) → JDB → BFL LAK.`,
      `Once you send them I'll import them into the system the same day.`,
      ``,
      `Thanks,`,
      `Paul (pb@thenamkhan.com)`,
    ].join('\n'),
  );
  const href = `mailto:fc@thenamkhan.com?cc=pb@thenamkhan.com&subject=${subject}&body=${body}`;
  return (
    <a
      href={href}
      style={{
        padding: '4px 12px',
        fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
        letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
        background: 'var(--brass)', color: '#fff',
        border: 'none', borderRadius: 4,
        textDecoration: 'none', fontWeight: 700,
      }}
    >
      ✉ Email FC · request all ({totalMissing})
    </a>
  );
}

function thCompact(align: 'left' | 'right' | 'center'): React.CSSProperties {
  return {
    textAlign: align, padding: '2px 4px',
    fontFamily: 'var(--mono)', fontSize: 9,
    letterSpacing: '0.04em', textTransform: 'uppercase',
    color: 'var(--ink-mute)', fontWeight: 600,
    borderBottom: '1px solid var(--paper-deep)',
  };
}

function LookupTable({ rows }: { rows: LookupRow[] }) {
  if (rows.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-mute)', fontStyle: 'italic' }}>
        No rows match. Either no bank data imported yet, or the filter is too narrow.
      </div>
    );
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="tbl" style={{ width: '100%', fontSize: 'var(--t-sm)' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Date</th>
            <th style={{ textAlign: 'left' }}>Bank</th>
            <th style={{ textAlign: 'left' }}>Descriptor</th>
            <th style={{ textAlign: 'left' }}>Counterparty</th>
            <th style={{ textAlign: 'left' }}>Category</th>
            <th style={{ textAlign: 'right' }}>Amount</th>
            <th style={{ textAlign: 'right' }}>USD</th>
            <th style={{ textAlign: 'center' }}>Rec</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.txn_id}>
              <td style={{ fontFamily: 'var(--mono)' }}>{r.txn_date}</td>
              <td style={{ color: 'var(--ink-soft)' }}><strong>{r.bank_name}</strong> · {r.currency}</td>
              <td style={{ fontSize: 'var(--t-xs)', fontFamily: 'var(--mono)', color: 'var(--ink-soft)', maxWidth: 320 }}>
                {r.descriptor_raw ?? '—'}
              </td>
              <td>{r.counterparty ?? <span style={{ color: 'var(--ink-mute)' }}>—</span>}</td>
              <td style={{ color: 'var(--ink-soft)' }}>{r.category ?? <span style={{ color: 'var(--ink-mute)' }}>—</span>}</td>
              <td style={{
                textAlign: 'right', fontFamily: 'var(--mono)',
                color: r.amount >= 0 ? 'var(--moss, #2D6A4F)' : 'var(--st-bad, #B23B3B)',
              }}>{fmtMoney(Number(r.amount), r.currency === 'LAK' ? 'LAK' : 'USD')}</td>
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
  );
}

function AccountBalanceTable({ rows }: { rows: AccountBalanceRow[] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="tbl" style={{ width: '100%', fontSize: 'var(--t-sm)' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Bank</th>
            <th style={{ textAlign: 'left' }}>Account</th>
            <th style={{ textAlign: 'left' }}>Currency</th>
            <th style={{ textAlign: 'right' }}>Opening</th>
            <th style={{ textAlign: 'right' }}>Movement (native)</th>
            <th style={{ textAlign: 'right' }}>Balance · USD-eq</th>
            <th style={{ textAlign: 'right' }}>Txns</th>
            <th style={{ textAlign: 'left' }}>Last txn</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => {
            const empty = Number(b.n_txn || 0) === 0;
            return (
              <tr key={b.account_id} style={{ opacity: empty ? 0.55 : 1 }}>
                <td style={{ fontWeight: 600 }}>{b.bank_name}</td>
                <td>{b.account_label}</td>
                <td style={{ fontFamily: 'var(--mono)' }}>{b.currency}</td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>
                  {!b.opening_balance ? '—' : Number(b.opening_balance).toLocaleString()}
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>
                  {empty ? '—' : Number(b.movement_native).toLocaleString()}
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--brass)' }}>
                  {empty ? '—' : fmtMoney(Number(b.balance_usd), 'USD')}
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>{b.n_txn ?? 0}</td>
                <td style={{ fontFamily: 'var(--mono)', color: 'var(--ink-mute)' }}>{b.last_txn_date ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ReconcileTable({ rows }: { rows: ReconcileCandidate[] }) {
  if (rows.length === 0) {
    return (
      <div style={{ padding: 18, textAlign: 'center', color: 'var(--ink-mute)', fontStyle: 'italic', fontSize: 'var(--t-xs)' }}>
        No candidates at this confidence level.
      </div>
    );
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="tbl" style={{ width: '100%', fontSize: 'var(--t-xs)' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'right' }}>Score</th>
            <th style={{ textAlign: 'left' }}>Bank date</th>
            <th style={{ textAlign: 'left' }}>Bank · descriptor</th>
            <th style={{ textAlign: 'right' }}>Bank $</th>
            <th style={{ textAlign: 'left' }}>CB date</th>
            <th style={{ textAlign: 'left' }}>CB · method · resv</th>
            <th style={{ textAlign: 'right' }}>CB $</th>
            <th style={{ textAlign: 'right' }}>Δ $</th>
            <th style={{ textAlign: 'right' }}>Δ days</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 100).map((r) => (
            <tr key={`${r.bank_txn_id}-${r.cb_txn_id}`}>
              <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 600, color: r.match_score >= 80 ? 'var(--moss, #2D6A4F)' : r.match_score >= 50 ? 'var(--st-warn, #C28F2C)' : 'var(--st-bad, #B23B3B)' }}>
                {r.match_score}
              </td>
              <td style={{ fontFamily: 'var(--mono)' }}>{r.bank_date}</td>
              <td style={{ fontFamily: 'var(--mono)', maxWidth: 240 }}>{r.bank_name} · {r.descriptor_raw ?? '—'}</td>
              <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>{fmtMoney(r.bank_amount_usd, 'USD')}</td>
              <td style={{ fontFamily: 'var(--mono)' }}>{r.cb_date}</td>
              <td style={{ color: 'var(--ink-soft)' }}>{r.cb_method} · {r.reservation_id ?? '—'}</td>
              <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>{fmtMoney(r.cb_amount_usd, 'USD')}</td>
              <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>{fmtMoney(r.amount_delta_usd, 'USD')}</td>
              <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>{r.day_delta}d</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SmallTable({ cols, rows }: { cols: string[]; rows: (string | number)[][] }) {
  if (rows.length === 0) {
    return <div style={{ padding: 14, color: 'var(--ink-mute)', fontStyle: 'italic', fontSize: 'var(--t-xs)' }}>No data yet.</div>;
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="tbl" style={{ width: '100%', fontSize: 'var(--t-xs)' }}>
        <thead><tr>{cols.map((c, i) => <th key={i} style={{ textAlign: i >= cols.length - 2 ? 'right' : 'left' }}>{c}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((cell, ci) => (
                <td key={ci} style={{
                  textAlign: ci >= r.length - 2 ? 'right' : 'left',
                  fontFamily: ci >= r.length - 2 ? 'var(--mono)' : 'inherit',
                }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Charts ──────────────────────────────────────────────────────────
function BalanceTrajectoryChart({ months, flow, totalCash }: { months: string[]; flow: MonthlyFlowRow[]; totalCash: number }) {
  if (months.length === 0 || flow.length === 0) return <Empty>cumulative balance fills in as months land</Empty>;
  const byMonth = new Map<string, number>();
  for (const r of flow) byMonth.set(r.period_yyyymm, (byMonth.get(r.period_yyyymm) || 0) + Number(r.net_usd || 0));
  let cum = 0;
  const pts = months.map((m) => { cum += byMonth.get(m) || 0; return { period: m, value: cum }; });
  const W = 520, H = 200, padL = 40, padB = 22, padT = 8;
  const innerW = W - padL - 10, innerH = H - padT - padB;
  const vals = pts.map((p) => p.value);
  const min = Math.min(...vals, 0);
  const max = Math.max(...vals, totalCash, 1);
  const range = (max - min) || 1;
  const xStep = innerW / Math.max(1, pts.length - 1);
  const path = pts.map((p, i) => {
    const x = padL + i * xStep;
    const y = padT + innerH - ((p.value - min) / range) * innerH;
    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }}>
      <path d={path} fill="none" stroke="var(--brass)" strokeWidth="2" />
      {pts.map((p, i) => {
        const x = padL + i * xStep;
        const y = padT + innerH - ((p.value - min) / range) * innerH;
        return (
          <circle key={p.period} cx={x} cy={y} r={2} fill="var(--brass)">
            <title>{`${p.period} · $${(p.value / 1000).toFixed(1)}k`}</title>
          </circle>
        );
      })}
    </svg>
  );
}

function MonthlyFlowChart({ months, flow }: { months: string[]; flow: MonthlyFlowRow[] }) {
  if (months.length === 0 || flow.length === 0) return <Empty>monthly inflow vs outflow appears once statements load</Empty>;
  const W = 520, H = 200, padL = 40, padB = 22, padT = 8;
  const innerW = W - padL - 10, innerH = H - padT - padB;
  const byMonth = new Map<string, { in: number; out: number }>();
  for (const r of flow) {
    const m = byMonth.get(r.period_yyyymm) || { in: 0, out: 0 };
    m.in  += Number(r.inflow_usd  || 0);
    m.out += Math.abs(Number(r.outflow_usd || 0));
    byMonth.set(r.period_yyyymm, m);
  }
  const max = Math.max(1, ...Array.from(byMonth.values()).flatMap((v) => [v.in, v.out]));
  const barW = (innerW / months.length) * 0.4;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }}>
      {months.map((m, i) => {
        const v = byMonth.get(m) || { in: 0, out: 0 };
        const x  = padL + i * (innerW / months.length);
        const inH  = (v.in  / max) * innerH;
        const outH = (v.out / max) * innerH;
        const yIn  = padT + innerH - inH;
        const yOut = padT + innerH - outH;
        return (
          <g key={m}>
            <rect x={x} y={yIn} width={barW} height={inH} fill="var(--moss, #2D6A4F)">
              <title>{`${m} · in ${fmtMoney(v.in, 'USD')}`}</title>
            </rect>
            <rect x={x + barW + 2} y={yOut} width={barW} height={outH} fill="var(--st-bad, #B23B3B)">
              <title>{`${m} · out ${fmtMoney(v.out, 'USD')}`}</title>
            </rect>
            {i % 3 === 0 && (
              <text x={x + barW} y={H - 6} textAnchor="middle" style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--ink-mute)' }}>
                {m.slice(2)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function TopCounterpartiesChart({ rows }: { rows: { counterparty: string; inflow_usd: number; outflow_usd: number }[] }) {
  if (rows.length === 0) return <Empty>top counterparties appear once descriptor rules resolve them</Empty>;
  const max = Math.max(1, ...rows.map((r) => Math.max(Number(r.inflow_usd || 0), Number(r.outflow_usd || 0))));
  const lineH = 22;
  return (
    <div style={{ padding: 6 }}>
      {rows.map((r) => {
        const inflow  = Number(r.inflow_usd || 0);
        const outflow = Number(r.outflow_usd || 0);
        const inW  = (inflow  / max) * 200;
        const outW = (outflow / max) * 200;
        return (
          <div key={r.counterparty} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 80px', alignItems: 'center', gap: 6, height: lineH, fontSize: 'var(--t-xs)' }}>
            <div style={{ fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.counterparty}>
              {r.counterparty}
            </div>
            <div style={{ position: 'relative', height: 12, background: 'var(--paper-deep)', borderRadius: 2 }}>
              <div title={`in ${fmtMoney(inflow, 'USD')}`} style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: inW, background: 'var(--moss, #2D6A4F)' }} />
              <div title={`out ${fmtMoney(outflow, 'USD')}`} style={{ position: 'absolute', left: inW, top: 0, height: '100%', width: outW, background: 'var(--st-bad, #B23B3B)' }} />
            </div>
            <div style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--ink-soft)' }}>
              {fmtMoney(inflow - outflow, 'USD')}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CounterpartyPareto({ rows, kind }: { rows: CounterpartyRow[]; kind: 'in' | 'out' }) {
  if (rows.length === 0) return <Empty>{kind === 'in' ? 'inflow' : 'outflow'} Pareto fills in once data lands</Empty>;
  const max = Math.max(1, ...rows.map((r) => Number(kind === 'in' ? r.inflow_usd : r.outflow_usd)));
  return (
    <div style={{ padding: 6 }}>
      {rows.map((r) => {
        const value = Number(kind === 'in' ? r.inflow_usd : r.outflow_usd);
        const w = (value / max) * 220;
        return (
          <div key={r.counterparty} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 80px', alignItems: 'center', gap: 6, height: 20, fontSize: 'var(--t-xs)' }}>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.counterparty}>
              {r.counterparty}
            </div>
            <div title={`${r.txn_count} txns · ${fmtMoney(value, 'USD')}`} style={{
              height: 12, width: w,
              background: kind === 'in' ? 'var(--moss, #2D6A4F)' : 'var(--st-bad, #B23B3B)',
              borderRadius: 2,
            }} />
            <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--ink-soft)' }}>
              {fmtMoney(value, 'USD')}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CategoryBars({ rows }: { rows: { name: string; in_usd: number; out_usd: number; n: number }[] }) {
  if (rows.length === 0) return <Empty>category split appears as rule engine classifies rows</Empty>;
  const max = Math.max(1, ...rows.map((r) => r.in_usd + r.out_usd));
  return (
    <div style={{ padding: 6 }}>
      {rows.map((r) => {
        const inW  = (r.in_usd  / max) * 220;
        const outW = (r.out_usd / max) * 220;
        return (
          <div key={r.name} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 80px', alignItems: 'center', gap: 6, height: 20, fontSize: 'var(--t-xs)' }}>
            <div style={{ fontFamily: 'var(--mono)' }} title={r.name}>{r.name}</div>
            <div style={{ position: 'relative', height: 12, background: 'var(--paper-deep)', borderRadius: 2 }}>
              <div title={`in ${fmtMoney(r.in_usd, 'USD')}`}  style={{ position: 'absolute', left: 0,  top: 0, height: '100%', width: inW,  background: 'var(--moss, #2D6A4F)' }} />
              <div title={`out ${fmtMoney(r.out_usd, 'USD')}`} style={{ position: 'absolute', left: inW, top: 0, height: '100%', width: outW, background: 'var(--st-bad, #B23B3B)' }} />
            </div>
            <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--ink-soft)' }}>
              {fmtMoney(r.in_usd - r.out_usd, 'USD')}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: 18, color: 'var(--ink-mute)', fontStyle: 'italic', textAlign: 'center', fontSize: 'var(--t-xs)' }}>
      {children}
    </div>
  );
}

