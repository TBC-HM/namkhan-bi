// app/h/[property_id]/revenue/forecast/page.tsx
// Donna canonical Revenue · Forecast — full canonical layout, empty-state data
// until Donna PMS/booking feed is wired.
//
// Namkhan (module-forecasting-v1, 2026-07-27): the old redirect to
// /revenue/forecast landed on a 404 (that legacy route never existed).
// The v1 forecast ENGINE is live in the DB (forecast.daily_forecast, nightly
// pg_cron `forecast-daily-run`, bridges public.v_forecast_current /
// public.v_forecast_vs_actual), but the dashboard UI is gated by the brief's
// A5 accuracy backtest, which the seasonality baseline failed (owner decision
// pending — build_briefs slug module-forecasting-v1 §0.B). Until PBS rules,
// Namkhan renders an honest status card: no placeholder numbers, no fake UI.

import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import { DashboardPage, Container, type DashboardTab } from '@/app/(cockpit)/_design';
import { REVENUE_SUBPAGES } from '@/app/revenue/_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';
import DonnaRevenueCanonical from '../_DonnaRevenueCanonical';
import { REVENUE_SURFACES } from '../_surfaces';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function RevenueForecastPage({
  params,
  searchParams,
}: {
  params: { property_id: string };
  searchParams?: { win?: string; cmp?: string };
}) {
  const propertyId = Number(params.property_id);

  if (propertyId === NAMKHAN_PROPERTY_ID) {
    const subPages = rewriteSubPagesForProperty(REVENUE_SUBPAGES, propertyId);
    const tabs: DashboardTab[] = subPages.map((s) => ({
      key: s.href,
      label: s.label,
      href: s.href,
      active: s.href.endsWith('/forecast'),
    }));

    return (
      <DashboardPage
        title="Revenue · Forecast"
        subtitle="365-day occupancy, ADR and revenue forecast · The Namkhan"
        tabs={tabs}
      >
        <Container
          title="Forecast engine running — dashboard pending accuracy validation"
          status="amber"
        >
          <div style={{ display: 'grid', gap: 12, maxWidth: 720 }}>
            <p style={{ margin: 0, color: 'var(--ink)', fontSize: 14, lineHeight: 1.6 }}>
              The nightly forecast model is live: every night it projects occupancy, ADR
              and rooms revenue for the next 365 days from on-the-books data, historical
              seasonality, day-of-week patterns and cancellation behaviour, and each
              projection is scored against what actually happens.
            </p>
            <p style={{ margin: 0, color: 'var(--ink-soft)', fontSize: 13, lineHeight: 1.6 }}>
              This dashboard stays dark until the model passes its accuracy gate — we do
              not show forecast numbers before their tracked error is at an acceptable
              level. Accuracy is being measured continuously; the page activates once the
              gate decision is made.
            </p>
          </div>
        </Container>
      </DashboardPage>
    );
  }

  return (
    <DonnaRevenueCanonical
      propertyId={propertyId}
      win={searchParams?.win}
      cmp={searchParams?.cmp}
      cfg={REVENUE_SURFACES.forecast}
    />
  );
}
