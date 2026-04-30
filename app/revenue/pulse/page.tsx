// app/revenue/pulse/page.tsx
// D5 (staged, not deployed): wires 8 Pulse KPIs to live data with graceful mockup fallback:
//   D3 (deployed): Occupancy, ADR, RevPAR, TRevPAR (from mv_kpi_daily)
//   D5 (NEW):      Cancel %, No-Show %, Lead Time, ALOS (from reservations table)
// Net ADR, GOPPAR, Commission $, Forecast +30d remain as mockup placeholders pending data sources.

import tabPulse from '../_redesign/tabPulse';
import { resolvePeriod } from '@/lib/period';
import { getKpiDaily, aggregateDaily } from '@/lib/data';
import { getPulseExtendedKpis } from '@/lib/pulseExtended';
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

  // Parallel fetch — D3 + D5 data
  const [daily, extended] = await Promise.all([
    getKpiDaily(period.from, period.to).catch(() => []),
    getPulseExtendedKpis(period),
  ]);

  const agg = aggregateDaily(daily);

  let html = tabPulse.replace(/class="tab-content"/, 'class="tab-content active"');

  // D3 wired KPIs
  if (agg) {
    html = patchKpi(html, 'Occupancy', fmtPct(agg.occupancy_pct ?? 0));
    html = patchKpi(html, 'ADR',       fmtMoney(agg.adr ?? 0, 'USD'));
    html = patchKpi(html, 'RevPAR',    fmtMoney(agg.revpar ?? 0, 'USD'));
    html = patchKpi(html, 'TRevPAR',   fmtMoney(agg.trevpar ?? 0, 'USD'));
  }

  // D5 wired KPIs — only patch when we got a non-null number, otherwise mockup placeholder stays
  if (extended.cancelPct != null) {
    html = patchKpi(html, 'Cancel %', fmtPct(extended.cancelPct));
  }
  if (extended.noShowPct != null) {
    html = patchKpi(html, 'No-Show %', fmtPct(extended.noShowPct));
  }
  if (extended.leadTimeDays != null) {
    html = patchKpi(html, 'Lead Time', `${extended.leadTimeDays.toFixed(0)}d`);
  }
  if (extended.alosNights != null) {
    html = patchKpi(html, 'ALOS', extended.alosNights.toFixed(1));
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
