// app/revenue/pace/page.tsx
// D6+D6b (staged): wire Pace top KPIs + OTB-vs-STLY-by-stay-month chart from mv_pace_otb.
// Other Pace charts (pace curves Apr-Aug, 4-month overlay) keep mockup until snapshot history table lands.

import tabPace from '../_redesign/tabPace';
import { getPaceOtb } from '@/lib/data';
import { fmtMoney } from '@/lib/format';
import { paceOtbStlySvg } from '@/lib/svgCharts';
import { replaceChartInSection } from '../_redesign/chartReplace';

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

  const totals = pace.reduce(
    (a: { otb: number; rev: number; stly: number; stlyRev: number }, r: any) => ({
      otb: a.otb + Number(r.otb_roomnights || 0),
      rev: a.rev + Number(r.otb_revenue || 0),
      stly: a.stly + Number(r.stly_roomnights || 0),
      stlyRev: a.stlyRev + Number(r.stly_revenue || 0),
    }),
    { otb: 0, rev: 0, stly: 0, stlyRev: 0 }
  );

  const riskMonths = pace.filter((r: any) => Number(r.roomnights_delta || 0) <= -30).length;

  let html = tabPace.replace(/class="tab-content"/, 'class="tab-content active"');

  if (totals.otb > 0 || totals.rev > 0) {
    html = patchKpi(html, 'OTB Roomnights · 12mo fwd', String(totals.otb));
    html = patchKpi(html, 'OTB Revenue',               fmtMoney(totals.rev, 'USD'));
  }
  html = patchKpi(html, 'Risk months', String(riskMonths));

  // Chart: OTB vs STLY · by stay month — wire from getPaceOtb
  if (pace.length > 0) {
    const rows = pace.map((r: any) => ({
      ci_month: String(r.ci_month),
      otb: Number(r.otb_roomnights || 0),
      stly: Number(r.stly_roomnights || 0),
    }));
    const svg = paceOtbStlySvg(rows);
    html = replaceChartInSection(html, 'OTB vs STLY vs Budget · by stay month', svg);
    // also try alternate title text variants used in mockup
    html = replaceChartInSection(html, 'Pace by check-in month · OTB vs STLY · forward 18 months', svg);
  }

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
