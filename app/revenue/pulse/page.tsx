// app/revenue/pulse/page.tsx
// Renders Federico's mockup verbatim AND patches the 4 main KPIs (Occupancy, ADR, RevPAR, TRevPAR)
// with real values for the resolved period from FilterStrip. Other tiles keep mockup placeholder values.

import tabPulse from '../_redesign/tabPulse';
import { resolvePeriod } from '@/lib/period';
import { getKpiDaily, aggregateDaily } from '@/lib/data';
import { fmtMoney, fmtPct } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
}

// Replace the kpi-value that immediately follows a given kpi-label.
// Use a function replacement so `$` chars in newValue (e.g. "$206") aren't interpreted as backrefs.
function patchKpi(html: string, labelText: string, newValue: string): string {
  const escLabel = labelText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `(<div class="kpi-label">\\s*${escLabel}\\s*</div>\\s*<div class="kpi-value">)([^<]*)(</div>)`
  );
  return html.replace(re, (_match, p1: string, _p2: string, p3: string) => p1 + newValue + p3);
}

export default async function PulsePage({ searchParams }: Props) {
  const period = resolvePeriod(searchParams);
  const daily = await getKpiDaily(period.from, period.to).catch(() => []);
  const agg = aggregateDaily(daily);

  let html = tabPulse.replace(/class="tab-content"/, 'class="tab-content active"');

  if (agg) {
    html = patchKpi(html, 'Occupancy', fmtPct(agg.occupancy_pct ?? 0));
    html = patchKpi(html, 'ADR',       fmtMoney(agg.adr ?? 0, 'USD'));
    html = patchKpi(html, 'RevPAR',    fmtMoney(agg.revpar ?? 0, 'USD'));
    html = patchKpi(html, 'TRevPAR',   fmtMoney(agg.trevpar ?? 0, 'USD'));
  }

  // Period banner so the date filter is visibly driving the page.
  const periodBanner =
    '<div style="margin: 12px 0 16px; padding: 10px 14px; background: rgba(184,133,74,0.08); border: 1px solid rgba(184,133,74,0.35); border-radius: 6px; font-size: 12px; color: var(--text); display: flex; justify-content: space-between; align-items: center;">' +
    '<div><strong>Active period:</strong> ' + period.label + ' &middot; ' + period.rangeLabel +
    (period.cmpLabel ? ' &middot; ' + period.cmpLabel : '') +
    (period.segLabel && period.seg !== 'all' ? ' &middot; ' + period.segLabel : '') + '</div>' +
    '<div style="font-family: ui-monospace, SFMono-Regular, monospace; font-size: 11px; color: var(--text-dim);">win=' + period.win + ' &middot; cmp=' + period.cmp + ' &middot; seg=' + period.seg + ' &middot; ' + period.days + 'd</div>' +
    '</div>';
  html = html.replace(/(<div class="tab-content active"[^>]*>)/, (_m, p1: string) => p1 + periodBanner);

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
