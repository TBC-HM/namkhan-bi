// app/revenue/reports/render/page.tsx
// 2026-05-21: shell ported to DashboardPage primitive so report landing pages
// match the rest of the revenue area (paper background · brass+ink palette ·
// tab strip · DashboardPage chrome). Print styles unchanged — @media print
// keeps the A4-ready ink-on-paper output. Inner renderers (PulseReport, etc.)
// still use the existing Panel block, which already prints cleanly.

import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { resolvePeriod } from '@/lib/period';
import { supabase } from '@/lib/supabase';
import LetterheadHeader from './LetterheadHeader';
import PrintControls from './PrintControls';
import PulseReport from './_renderers/PulseReport';
import PaceReport from './_renderers/PaceReport';
import ChannelsReport from './_renderers/ChannelsReport';
import PlMonthReport from './_renderers/PlMonthReport';
import PricingReport from './_renderers/PricingReport';
import ForecastReport from './_renderers/ForecastReport';
import CompSetReport from './_renderers/CompSetReport';
import VarianceReport from './_renderers/VarianceReport';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const TITLE_BY_TYPE: Record<string, string> = {
  pulse:     'Pulse',
  pace:      'Pace',
  channels:  'Channels',
  pricing:   'Pricing',
  comp_set:  'Comp Set',
  forecast:  'Forecast',
  'pl-month':'P&L · month',
  pl_month:  'P&L · month',
  compset:   'Comp Set',
  variance:  'Variance',
};

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function RevenueReportRender({ searchParams }: Props) {
  const rawType = String(searchParams.type ?? 'pulse').toLowerCase();
  const type = rawType === 'pl_month' ? 'pl-month' : rawType;
  const titleWord = TITLE_BY_TYPE[type] ?? 'Revenue';

  const period = resolvePeriod(searchParams);
  const month = String(searchParams.month ?? '').slice(0, 7);

  // task #71 · property-aware report renderers. Underlying views are
  // currently Namkhan-only (audit 2026-05-22) — task #74 will rebuild the 6
  // views as cross-property. Until then, when propertyId != Namkhan we
  // surface an explicit "data feed pending" panel rather than render
  // Namkhan numbers under Donna's brand (integrity rule: NEVER MIX).
  const NAMKHAN_PROPERTY_ID = 260955;
  const rawPid = Number(searchParams.property_id);
  const propertyId = Number.isFinite(rawPid) ? rawPid : NAMKHAN_PROPERTY_ID;
  const isNamkhan = propertyId === NAMKHAN_PROPERTY_ID;
  // Types that depend on Namkhan-only views (mv_channel_perf, mv_kpi_daily,
  // v_pace_curve, v_tactical_alerts_top, gl.v_usali_*). These get gated until
  // task #74 rebuilds the source views as cross-property. The other renderers
  // (pricing/forecast/compset) read from already-cross-property bridges
  // (v_rate_plans_all, v_otb_pace, v_rate_plan_*) so they render Donna data
  // correctly today.
  const NAMKHAN_ONLY_TYPES = new Set(['pulse', 'pace', 'channels', 'pl-month']);
  const needsNamkhanData = !isNamkhan && NAMKHAN_ONLY_TYPES.has(type);
  const propertyLabel = propertyId === 1000001 ? 'Donna' : isNamkhan ? 'Namkhan' : `Property ${propertyId}`;
  const backHref = isNamkhan ? '/revenue' : `/h/${propertyId}/revenue`;

  // Single back tab — keeps the report a focused, print-ready surface but
  // gives users one-click route back into the revenue area.
  const tabs: DashboardTab[] = [
    { key: 'back', label: '← Revenue', href: backHref },
  ];

  // task #79 · log every viewed report into public.report_runs so the
  // Reports landing (/h/<pid>/reports) can list and re-open them. Skipped
  // when the integrity gate fires — gated views aren't real reports.
  if (!needsNamkhanData) {
    // Anon role has SELECT only on public.report_runs — write goes through
    // the SECURITY DEFINER fn_log_report_run RPC (claude_md §0.5 pattern).
    void supabase.rpc('fn_log_report_run', {
      p_template_code: type,
      p_property_id: propertyId,
      p_params: {
        type,
        dept: 'revenue',
        period_label: period.label,
        win: searchParams.win ?? null,
        cmp: searchParams.cmp ?? null,
        month: month || null,
        raw: searchParams,
      },
      p_output_summary: `${titleWord} · ${period.label}${month ? ` · ${month}` : ''} · ${propertyLabel}`,
      p_status: 'ok',
    }).then(({ error }) => {
      if (error) console.error('[reports/render] persist failed:', error.message);
    });
  }

  return (
    <DashboardPage
      title={`${titleWord} report · ${propertyLabel}`}
      subtitle={`Revenue · ${period.label}${month ? ` · ${month}` : ''}`}
      tabs={tabs}
      action={<PrintControls reportType={type} />}
    >
      <style>{`
        /* Clean A4 print stylesheet. Strips chrome, inverts colours, avoids
           breaking panels across pages. */
        @media print {
          html, body { background: #fff !important; color: #111 !important; }
          nav[role="tablist"], .no-print, .no-print * { display: none !important; }
          [data-panel] {
            background: #fff !important;
            border: 1px solid #ccc !important;
            color: #111 !important;
            box-shadow: none !important;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          [data-panel] .tbl th { color: #555 !important; border-color: #ccc !important; }
          [data-panel] .tbl td { color: #111 !important; border-color: #eee !important; }
          a { color: inherit !important; text-decoration: none !important; }
        }
      `}</style>

      {/* PBS 2026-05-22: letterhead — property name left, address right, generated stamp */}
      <LetterheadHeader propertyId={propertyId} reportLabel={`${titleWord} report`} periodLabel={`${period.label}${month ? ` · ${month}` : ''}`} />

      {needsNamkhanData ? (
        <div data-panel style={{
          padding: 24,
          border: '1px solid var(--hairline, #E6DFCC)',
          borderRadius: 6,
          background: 'var(--paper, #FFFFFF)',
          color: 'var(--ink, #1B1B1B)',
          fontSize: 13,
          lineHeight: 1.6,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--ink, #1B1B1B)' }}>
            Donna data feed not yet wired
          </div>
          <div style={{ color: 'var(--ink-soft, #5A5A5A)' }}>
            This renderer reads from views (<code>mv_channel_perf</code>,{' '}
            <code>mv_kpi_daily</code>, <code>v_pace_curve</code>,{' '}
            <code>v_tactical_alerts_top</code>, <code>gl.v_usali_*</code>) that
            currently return Namkhan rows only. To preserve data integrity
            (never mix properties), the report is gated until task #74 rebuilds
            those 6 views as cross-property bridges.
          </div>
        </div>
      ) : (
        <>
          {type === 'pulse'    && <PulseReport period={period} />}
          {type === 'pace'     && <PaceReport period={period} />}
          {type === 'channels' && <ChannelsReport period={period} />}
          {type === 'pl-month' && <PlMonthReport period={period} month={month} />}
          {type === 'pricing'  && <PricingReport period={period} propertyId={propertyId} />}
          {type === 'forecast' && <ForecastReport period={period} propertyId={propertyId} />}
          {(type === 'compset' || type === 'comp_set') && <CompSetReport period={period} propertyId={propertyId} />}
          {type === 'variance' && <VarianceReport period={period} propertyId={propertyId} />}
        </>
      )}

      {!['pulse','pace','channels','pl-month','pricing','forecast','compset','comp_set','variance'].includes(type) && (
        <div data-panel style={{
          padding: 24,
          border: '1px solid var(--hairline, #E6DFCC)',
          borderRadius: 6,
          background: 'var(--paper, #FFFFFF)',
          color: 'var(--ink-soft, #5A5A5A)',
          fontSize: 13,
        }}>
          Renderer for <strong>{type}</strong> is owed by pair-Claude — the URL
          contract works, the dedicated print view will land here.
        </div>
      )}
    </DashboardPage>
  );
}
