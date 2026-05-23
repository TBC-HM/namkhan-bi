// app/revenue/reports/render/_renderers/CompSetReport.tsx
// Comp Set report — honest stub. The Lighthouse rate-shop export isn't wired
// yet (report_def.data_ready=false), so we surface an explicit data-pending
// panel rather than render fake or empty rows. Task #75 · 2026-05-22.

import { Container } from '@/app/(cockpit)/_design';
import ReportBrief from './_shared/ReportBrief';
import type { ResolvedPeriod } from '@/lib/period';

interface Props {
  period: ResolvedPeriod;
  propertyId: number;
}

export default async function CompSetReport({ period, propertyId }: Props) {
  const propertyLabel = propertyId === 1000001 ? 'Donna' : propertyId === 260955 ? 'Namkhan' : `Property ${propertyId}`;

  return (
    <>
      <ReportBrief
        signal={`${period.label} · Comp set data feed not yet wired`}
        body="Lighthouse rate-shop export is upstream of this report. Until it's ingested, this view is a placeholder — it does NOT render comp-set numbers."
        good={['Honest empty state — no fake numbers under the report header.']}
        bad={['Upstream Lighthouse → Supabase pipeline owed.']}
      />

      <Container title="Comp set rate-shop" subtitle={`${propertyLabel} · feed pending`} density="compact">
        <div style={{
          padding: 24,
          border: '1px dashed var(--hairline, #E6DFCC)',
          borderRadius: 6,
          background: 'var(--paper, #FFFFFF)',
          color: 'var(--ink, #1B1B1B)',
          fontSize: 13,
          lineHeight: 1.6,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>
            Data feed not wired
          </div>
          <div style={{ color: 'var(--ink-soft, #5A5A5A)' }}>
            <p style={{ margin: '0 0 8px 0' }}>
              The Comp Set report reads from a <strong>Lighthouse rate-shop export</strong> that
              isn't yet ingested into Supabase. The renderer is built and ready —
              it just has no source data to read.
            </p>
            <p style={{ margin: '0 0 8px 0' }}>
              When the pipeline lands, mark <code>report_def.data_ready = true</code> for
              code <code>compset</code> and wire the read here.
            </p>
            <p style={{ margin: 0, fontStyle: 'italic' }}>
              Owed: Lighthouse export → Supabase table (probably <code>compset.lighthouse_rates</code>
              or similar) + a view that aggregates rate &amp; promo signals per
              competitor over the window.
            </p>
          </div>
        </div>
      </Container>
    </>
  );
}
