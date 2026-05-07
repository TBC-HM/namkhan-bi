/**
 * FinanceHeroStrip — 4-metric hero bar for /finance.
 *
 * Metrics (left → right):
 *   1. Cash Position   — source: v_finance_cash_position (NOT YET BUILT → em-dash)
 *   2. AR Aging Total  — source: v_finance_ar_aging (NOT YET BUILT per SOP-10 KB#302 → em-dash)
 *   3. P&L Net (MTD)   — source: v_pl_monthly_usali (NOT YET CONFIRMED → em-dash)
 *   4. Budget Variance — source: v_finance_budget_vs_actual (NOT YET CONFIRMED → em-dash)
 *
 * FX: reads NEXT_PUBLIC_FX_LAK_USD from env. Falls back to 21800 (standard snapshot).
 * Currency: $ USD primary, ₭ LAK secondary.
 * All values use em-dash guard (EMPTY from lib/format.ts) when source is null.
 *
 * TODO: wire each metric to its canonical view once views are built and allowlisted.
 */

import { EMPTY } from "@/lib/format";

const FX_LAK_USD = Number(process.env.NEXT_PUBLIC_FX_LAK_USD ?? 21800);

interface HeroMetric {
  label: string;
  value: string;
  sub: string;
  status?: "ok" | "warn" | "danger" | "unknown";
  sourceNote: string;
}

async function fetchHeroMetrics(): Promise<HeroMetric[]> {
  // TODO: replace each EMPTY with real Supabase fetch once views confirmed.
  // Pattern: const { data } = await supabase.from('v_finance_cash_position').select('*').single();
  // Then: value = data ? `$${fmtTableUsd(data.cash_usd)}` : EMPTY;

  return [
    {
      label: "Cash Position",
      value: EMPTY,
      sub: "USD + LAK equivalent · today",
      status: "unknown",
      sourceNote: "v_finance_cash_position — pending build",
    },
    {
      label: "AR Aging Total",
      value: EMPTY,
      sub: "Outstanding receivables",
      status: "unknown",
      sourceNote: "v_finance_ar_aging — pending build (SOP-10)",
    },
    {
      label: "P&L Net (MTD)",
      value: EMPTY,
      sub: "Net income · month-to-date",
      status: "unknown",
      sourceNote: "v_pl_monthly_usali — pending confirmation",
    },
    {
      label: "Budget Variance %",
      value: EMPTY,
      sub: "Actual vs budget · MTD",
      status: "unknown",
      sourceNote: "v_finance_budget_vs_actual — pending confirmation",
    },
  ];
}

export default async function FinanceHeroStrip() {
  const metrics = await fetchHeroMetrics();

  return (
    <div className="hero-strip" role="region" aria-label="Finance hero metrics">
      {metrics.map((m) => (
        <div key={m.label} className={`hero-metric hero-metric--${m.status}`}>
          <span className="hero-label">{m.label}</span>
          <span className="hero-value" title={m.sourceNote}>
            {m.value}
          </span>
          <span className="hero-sub">{m.sub}</span>
        </div>
      ))}

      <style jsx>{`
        .hero-strip {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1px;
          background: var(--color-border, #2a2f2e);
          border: 1px solid var(--color-border, #2a2f2e);
          border-radius: 8px;
          overflow: hidden;
        }
        @media (max-width: 768px) {
          .hero-strip {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        .hero-metric {
          background: var(--color-surface-1, #1a1f1e);
          padding: var(--space-5, 20px) var(--space-4, 16px);
          display: flex;
          flex-direction: column;
          gap: 4px;
          position: relative;
        }
        .hero-metric::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
        }
        .hero-metric--ok::before { background: var(--color-success, #22c55e); }
        .hero-metric--warn::before { background: var(--color-warning, #f59e0b); }
        .hero-metric--danger::before { background: var(--color-danger, #ef4444); }
        .hero-metric--unknown::before { background: var(--color-border, #2a2f2e); }
        .hero-label {
          font-family: var(--font-mono);
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--color-text-muted, #6b7280);
        }
        .hero-value {
          font-family: var(--font-serif, Georgia, serif);
          font-style: italic;
          font-size: 1.6rem;
          font-weight: 700;
          color: var(--color-text-primary, #f5f2ef);
          line-height: 1.1;
          letter-spacing: -0.02em;
        }
        .hero-sub {
          font-size: 0.72rem;
          color: var(--color-text-muted, #6b7280);
          margin-top: 2px;
        }
      `}</style>
    </div>
  );
}
