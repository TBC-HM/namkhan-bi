// app/revenue/reports/render/_renderers/VarianceReport.tsx
// Variance report — actual vs budget vs LY on every USALI line.
// Stub for now (report_def.data_ready=false) since the budget data feed
// isn't wired yet. Renderer is built so wiring the gl/budget source flips
// it on without code changes. Task #93 · 2026-05-23.

import { Container } from '@/app/(cockpit)/_design';
import ReportBrief from './_shared/ReportBrief';
import type { ResolvedPeriod } from '@/lib/period';

interface Props {
  period: ResolvedPeriod;
  propertyId: number;
}

export default async function VarianceReport({ period, propertyId }: Props) {
  const propertyLabel = propertyId === 1000001 ? 'Donna' : propertyId === 260955 ? 'Namkhan' : `Property ${propertyId}`;

  return (
    <>
      <ReportBrief
        signal={`${period.label} · Variance report — budget feed pending`}
        body="Actual vs budget vs same-time-last-year, with red/amber/green flags on every USALI line. The actual + LY sides are ready (mv_kpi_daily, gl); the budget side needs a finance.gl_budgets seed per property × USALI line × period."
        good={['Renderer + URL contract live — wired the moment data_ready flips true.']}
        bad={['Budget data not seeded yet for either property.']}
      />

      <Container title="Variance · actual vs budget vs LY" subtitle={`${propertyLabel} · feed pending`} density="compact">
        <div style={{
          padding: 24,
          border: '1px dashed var(--hairline, #E6DFCC)',
          borderRadius: 6,
          background: 'var(--paper, #FFFFFF)',
          color: 'var(--ink, #1B1B1B)',
          fontSize: 13,
          lineHeight: 1.6,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Budget feed not seeded</div>
          <div style={{ color: 'var(--ink-soft, #5A5A5A)' }}>
            <p style={{ margin: '0 0 8px 0' }}>
              Once a property loads its budget into <code>finance.gl_budgets</code>
              keyed by (property_id, period_yyyymm, usali_line_code, amount),
              flip <code>report_def.data_ready = true</code> for code
              <code>variance</code> and this renderer will start producing the
              actual vs budget vs LY table with green / amber / red flags per line.
            </p>
            <p style={{ margin: 0, fontStyle: 'italic' }}>
              Owed: budget seed (PBS to upload finance plan, or via
              <code>plan.scenarios</code> "Budget 2026 v1"), then a view that
              joins gl-actual + budget + LY-actual per period.
            </p>
          </div>
        </div>
      </Container>
    </>
  );
}
