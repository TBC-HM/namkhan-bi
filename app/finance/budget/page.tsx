// app/finance/budget/page.tsx
// Budget vs actual — stub awaiting budget upload.

import PanelHero from '@/components/sections/PanelHero';
import Card from '@/components/sections/Card';
import KpiCard from '@/components/kpi/KpiCard';

export const dynamic = 'force-dynamic';

export default function BudgetPage() {
  return (
    <>
      <PanelHero
        eyebrow="Budget · 2026 · NOT WIRED"
        title="Budget"
        emphasis="vs actual"
        sub="No gl.budgets table yet — every value renders as xx until owner uploads an annual budget CSV."
        kpis={
          <>
            <KpiCard label="Annual Target" value={null} greyed kind="money" hint="xx · no gl.budgets" />
            <KpiCard label="YTD Actual" value={null} greyed kind="money" hint="xx · would aggregate gl.pl_section_monthly" />
            <KpiCard label="Variance" value={null} greyed kind="pct" hint="xx · actual − budget" />
            <KpiCard label="Pace to Target" value={null} greyed kind="pct" hint="xx · YTD ÷ annual target" />
          </>
        }
      />

      <Card title="Budget upload" sub="Owner to provide annual budget by USALI line">
        <div className="stub">
          <h3>Not wired</h3>
          <p>
            <strong>Status:</strong> <code>gl.budgets</code> table does not exist. All Budget / Δ Bgt / Flow / Pace tiles
            across <a href="/finance/pnl">/finance/pnl</a> render as <code>xx</code> placeholders.
          </p>
          <p>
            <strong>To unblock:</strong> create the schema (<code>period_yyyymm × usali_subcategory × amount_usd</code>),
            add a CSV upload route, then wire variance + pace.
          </p>
          <div className="stub-list">
            CSV upload · USALI mapping · Monthly variance · Pace tracker (all xx today)
          </div>
        </div>
      </Card>
    </>
  );
}
