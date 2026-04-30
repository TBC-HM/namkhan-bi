// app/revenue/pace/page.tsx
// D6 (staged, not deployed): wire Pace mockup top KPIs to live mv_pace_otb data.
// Mockup table sections (curves, drill-downs) stay as-is for now — heavier lift in a later deploy.
// Replaces /revenue/demand semantically (demand still serves as legacy URL until D14 cleanup).

import tabPace from '../_redesign/tabPace';
import { getPaceOtb } from '@/lib/data';
import { fmtMoney } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

function patchKpi(html: string, labelText: string, newValue: string): string {
  const escLabel = labelText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `(<div class="kpi-label">\\s*${escLabel}\\s*</div>\\s*<div class="kpi-value"[^>]*>)([^<]*)(</div>)`
  );
  return html.replace(re, (_match, p1: string, _p2: string, p3: string) => p1 + newValue + p3);
}

export default async function PacePage() {
  const pace = await getPaceOtb().catch(() => []);

  // Aggregate forward 12mo OTB
  const totals = pace.reduce(
    (a: { otb: number; rev: number; stly: number; stlyRev: number }, r: any) => ({
      otb: a.otb + Number(r.otb_roomnights || 0),
      rev: a.rev + Number(r.otb_revenue || 0),
      stly: a.stly + Number(r.stly_roomnights || 0),
      stlyRev: a.stlyRev + Number(r.stly_revenue || 0),
    }),
    { otb: 0, rev: 0, stly: 0, stlyRev: 0 }
  );

  // Risk months: any month with >= 30rn negative delta vs STLY
  const riskMonths = pace.filter((r: any) => Number(r.roomnights_delta || 0) <= -30).length;

  let html = tabPace.replace(/class="tab-content"/, 'class="tab-content active"');

  if (totals.otb > 0 || totals.rev > 0) {
    html = patchKpi(html, 'OTB Roomnights · 12mo fwd', String(totals.otb));
    html = patchKpi(html, 'OTB Revenue',               fmtMoney(totals.rev, 'USD'));
  }
  // Pickup last 7d / 28d — proper pickup deltas need snapshot history table (mv_pace_snapshots).
  // Leave mockup placeholders for now — graceful fallback per spec.
  html = patchKpi(html, 'Risk months', String(riskMonths));

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
