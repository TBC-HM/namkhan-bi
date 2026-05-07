"use client";

/**
 * /finance — Finance Pillar Entry Page
 *
 * Pattern: mirrors /revenue-v2 conversational entry shell.
 * Data wiring: all sections guarded with em-dash (—) where views are absent/null.
 *
 * CANONICAL VIEW WIRING STATUS (checked 2026-05-08):
 * [✓] v_tactical_alerts_top        — exists (allowlisted)
 * [✓] mv_kpi_daily                 — exists (public schema, used via server component)
 * [~] v_finance_cash_position      — NOT YET IN allowlist / existence unconfirmed → em-dash stub
 * [~] v_finance_ar_aging           — NOT YET built per SOP-10 KB#302 known gaps → em-dash stub
 * [~] v_finance_budget_vs_actual   — NOT YET confirmed → em-dash stub
 * [~] v_pl_monthly_usali           — NOT YET confirmed → em-dash stub
 * [~] v_finance_top_suppliers      — NOT YET confirmed → em-dash stub
 * [~] v_finance_cash_forecast      — NOT YET confirmed (gl schema) → em-dash stub
 * [~] mv_classified_transactions   — NOT YET confirmed → em-dash stub
 * [~] v_unmapped_accounts          — NOT YET confirmed → em-dash stub
 * [~] mv_revenue_by_usali_dept     — NOT YET confirmed → em-dash stub
 * [~] fx_tracker table             — referenced in KB; not in allowlist → FX from env
 * [~] GOPPAR cost feed             — unknown status per triage → em-dash guard active
 * [~] NLP / "Ask anything"         — revenue-v2 orchestrator scope extension needed → local stub
 *
 * TODO: Sub-ticket to backend — create/allowlist all finance views listed above.
 * TODO: Sub-ticket to IT — extend NLP orchestrator to Finance domain intent.
 * TODO: Pia + finance_hod (Intel) to verify USALI department tree mapping before merge.
 *
 * Currency: $ USD | ₭ LAK   — via NEXT_PUBLIC_FX_LAK_USD env or app_settings.fx_lak_usd
 * Dates: ISO YYYY-MM-DD
 * Empty cells: — (em-dash, EMPTY constant from lib/format.ts)
 */

import { Suspense } from "react";
import PageHeader from "@/components/layout/PageHeader";
import KpiBox from "@/components/kpi/KpiBox";
import { EMPTY, fmtKpi, fmtTableUsd } from "@/lib/format";
import FinanceAskBox from "./_components/FinanceAskBox";
import FinanceHeroStrip from "./_components/FinanceHeroStrip";
import FinanceAttentionPanel from "./_components/FinanceAttentionPanel";
import FinanceUsaliAccordion from "./_components/FinanceUsaliAccordion";
import FinancePlTrendChart from "./_components/FinancePlTrendChart";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function FinancePage() {
  return (
    <main className="finance-page">
      <PageHeader
        title="Finance"
        subtitle="USALI 11th edition · Dual LAK / USD · D+10 monthly close"
        badge="F"
        badgeColor="var(--color-finance)"
      />

      {/* ── Ask Anything ─────────────────────────────────────────── */}
      <section className="finance-ask-section">
        <Suspense fallback={null}>
          <FinanceAskBox />
        </Suspense>
      </section>

      {/* ── Hero Strip ───────────────────────────────────────────── */}
      <section className="finance-hero-section">
        <Suspense fallback={<HeroStripSkeleton />}>
          <FinanceHeroStrip />
        </Suspense>
      </section>

      {/* ── KPI Tiles ────────────────────────────────────────────── */}
      <section className="finance-kpi-grid" aria-label="Finance KPI tiles">
        <Suspense fallback={<KpiGridSkeleton />}>
          <FinanceKpiTiles />
        </Suspense>
      </section>

      {/* ── What Needs Your Attention ────────────────────────────── */}
      <section className="finance-attention-section">
        <h2 className="section-heading">What needs your attention</h2>
        <Suspense fallback={<AttentionSkeleton />}>
          <FinanceAttentionPanel />
        </Suspense>
      </section>

      {/* ── USALI Department Accordion ───────────────────────────── */}
      <section className="finance-usali-section">
        <h2 className="section-heading">USALI Department P&amp;L</h2>
        <p className="section-sub">
          11th Edition schedule mapping · Current month vs budget
        </p>
        <Suspense fallback={<AccordionSkeleton />}>
          <FinanceUsaliAccordion />
        </Suspense>
      </section>

      {/* ── P&L Trend Chart ──────────────────────────────────────── */}
      <section className="finance-trend-section">
        <h2 className="section-heading">P&amp;L Trend — Rolling 12 months</h2>
        <Suspense fallback={<ChartSkeleton />}>
          <FinancePlTrendChart />
        </Suspense>
      </section>

      <style jsx>{`
        .finance-page {
          padding: var(--space-6) var(--space-8);
          max-width: 1400px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: var(--space-8);
        }
        .finance-ask-section {
          margin-bottom: var(--space-2);
        }
        .finance-kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: var(--space-4);
        }
        .section-heading {
          font-family: var(--font-mono);
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--color-text-secondary);
          margin-bottom: var(--space-3);
        }
        .section-sub {
          font-size: 0.78rem;
          color: var(--color-text-muted);
          margin-top: calc(-1 * var(--space-2));
          margin-bottom: var(--space-3);
        }
        .skeleton {
          background: var(--color-surface-2);
          border-radius: 6px;
          animation: pulse 1.5s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </main>
  );
}

/* ── Inline KPI tiles (5 tiles, all em-dash guarded) ── */
async function FinanceKpiTiles() {
  // TODO: wire to canonical finance views once created and allowlisted.
  // Each KpiBox safely renders EMPTY (—) when value is null/undefined.
  const tiles: Array<{
    label: string;
    value: string;
    sub?: string;
    delta?: string;
    deltaDir?: "up" | "down" | "flat";
    note?: string;
  }> = [
    {
      label: "GOPPAR",
      value: EMPTY, // em-dash: cost feed status unknown per triage
      sub: "Gross Op Profit / Avail Room",
      note: "Cost feed pending — see sub-ticket",
    },
    {
      label: "Revenue (MTD)",
      value: EMPTY,
      sub: "USD · month-to-date",
      delta: EMPTY,
    },
    {
      label: "Op Expense (MTD)",
      value: EMPTY,
      sub: "USD · month-to-date",
      delta: EMPTY,
    },
    {
      label: "Net Income (MTD)",
      value: EMPTY,
      sub: "USD · after tax",
      delta: EMPTY,
    },
    {
      label: "Cash Runway",
      value: EMPTY,
      sub: "weeks · operating",
      note: "13w forecast pending bank API",
    },
  ];

  return (
    <>
      {tiles.map((t) => (
        <KpiBox
          key={t.label}
          label={t.label}
          value={t.value}
          sub={t.sub}
          delta={t.delta}
          deltaDir={t.deltaDir}
          note={t.note}
        />
      ))}
    </>
  );
}

/* ── Skeleton helpers ── */
function HeroStripSkeleton() {
  return (
    <div className="skeleton" style={{ height: 88, borderRadius: 8 }} />
  );
}
function KpiGridSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="skeleton"
          style={{ height: 96, borderRadius: 8 }}
        />
      ))}
      <style jsx>{`
        .skeleton {
          background: var(--color-surface-2);
          border-radius: 6px;
          animation: pulse 1.5s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </>
  );
}
function AttentionSkeleton() {
  return <div className="skeleton" style={{ height: 120, borderRadius: 8 }} />;
}
function AccordionSkeleton() {
  return <div className="skeleton" style={{ height: 240, borderRadius: 8 }} />;
}
function ChartSkeleton() {
  return <div className="skeleton" style={{ height: 280, borderRadius: 8 }} />;
}
