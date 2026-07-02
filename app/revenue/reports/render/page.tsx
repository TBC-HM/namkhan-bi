// app/revenue/reports/render/page.tsx
// 2026-05-21: shell ported to DashboardPage primitive so report landing pages
// match the rest of the revenue area (paper background · brass+ink palette ·
// tab strip · DashboardPage chrome). Print styles unchanged — @media print
// keeps the A4-ready ink-on-paper output. Inner renderers (PulseReport, etc.)
// still use the existing Panel block, which already prints cleanly.

import Link from 'next/link';
import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { resolvePeriod } from '@/lib/period';
import { supabase } from '@/lib/supabase';
import PrintControls from './PrintControls';
import PulseReport from './_renderers/PulseReport';
import PaceReport from './_renderers/PaceReport';
import ChannelsReport from './_renderers/ChannelsReport';
import PlMonthReport from './_renderers/PlMonthReport';

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

  // PBS 2026-07-03: fold Letterhead into DashboardPage subtitle so header is one block.
  const propertyMeta = await supabase
    .from('v_property_display')
    .select('property_name, address')
    .eq('property_id', propertyId)
    .maybeSingle();
  const propName = String((propertyMeta.data as { property_name?: string } | null)?.property_name ?? propertyLabel);
  const propAddr = String((propertyMeta.data as { address?: string } | null)?.address ?? '').replace(/\s*,\s*/g, ' · ');
  const stamp = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <DashboardPage
      title={`${titleWord} · ${propName}`}
      subtitle={`${period.label}${month ? ` · ${month}` : ''}${propAddr ? ` · ${propAddr}` : ''} · Generated ${stamp}`}
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

      {/* PBS 2026-07-03: letterhead removed — property name / address / generated
          stamp are now inline in the DashboardPage title + subtitle above. */}

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
          {type === 'pulse'    && <PulseReport period={period} propertyId={propertyId} />}
          {type === 'pace'     && <PaceReport period={period} />}
          {type === 'channels' && <ChannelsReport period={period} />}
          {type === 'pl-month' && <PlMonthReport period={period} month={month} />}

          {/* PBS 2026-07-03: pickup lives on the interactive page — no print
              renderer needed; deep-link operator there instead. */}
          {type === 'pickup' && (
            <ComingLater
              title="Pickup report"
              body="The full interactive pickup table lives on the Pickup page — deltas by lead-time, day-of-week, month. Open there for filters + drill-through."
              cta={{ label: 'Open Pickup page', href: propertyId === NAMKHAN_PROPERTY_ID ? '/revenue/pickup' : `/h/${propertyId}/revenue/pickup` }}
            />
          )}

          {/* PBS 2026-07-03: variance / forecast / compset / pricing renderers
              are still in scaffolding — surface a "coming later" note instead
              of the old placeholder shells so the operator knows the state. */}
          {(type === 'variance' || type === 'forecast' || type === 'compset' || type === 'comp_set' || type === 'pricing') && (
            <ComingLater
              title={`${titleWord} report — coming later`}
              body={`This report is scoped and the URL contract works, but the printable renderer is still owed. The interactive page under ${propertyId === NAMKHAN_PROPERTY_ID ? '/revenue' : `/h/${propertyId}/revenue`} carries the underlying view for now.`}
            />
          )}
        </>
      )}

      {!['pulse','pace','channels','pl-month','pickup','pricing','forecast','compset','comp_set','variance'].includes(type) && (
        <ComingLater title={`Renderer for "${type}"`} body="This report type is not yet scoped. Route the request through the report builder on /revenue." />
      )}
    </DashboardPage>
  );
}

function ComingLater({ title, body, cta }: { title: string; body: string; cta?: { label: string; href: string } }) {
  return (
    <div data-panel style={{
      gridColumn: '1 / -1',
      padding: '18px 20px',
      background: '#FFFFFF',
      border: '1px dashed #E6DFCC',
      borderRadius: 6,
      color: '#1B1B1B',
      fontSize: 13,
      lineHeight: 1.5,
    }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{title}</div>
      <div style={{ color: '#5A5A5A', marginBottom: cta ? 10 : 0 }}>{body}</div>
      {cta && (
        <Link href={cta.href} style={{
          display: 'inline-block',
          padding: '7px 14px',
          background: '#1F3A2E',
          color: '#FFFFFF',
          textDecoration: 'none',
          borderRadius: 4,
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}>{cta.label} →</Link>
      )}
    </div>
  );
}
