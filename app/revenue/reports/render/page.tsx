// app/revenue/reports/render/page.tsx
// 2026-05-21: shell ported to DashboardPage primitive so report landing pages
// match the rest of the revenue area (paper background · brass+ink palette ·
// tab strip · DashboardPage chrome). Print styles unchanged — @media print
// keeps the A4-ready ink-on-paper output. Inner renderers (PulseReport, etc.)
// still use the existing Panel block, which already prints cleanly.

import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { resolvePeriod } from '@/lib/period';
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

  // Single back tab — keeps the report a focused, print-ready surface but
  // gives users one-click route back into the revenue area.
  const tabs: DashboardTab[] = [
    { key: 'back', label: '← Revenue', href: '/revenue' },
  ];

  return (
    <DashboardPage
      title={`${titleWord} report`}
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

      {type === 'pulse'    && <PulseReport period={period} />}
      {type === 'pace'     && <PaceReport period={period} />}
      {type === 'channels' && <ChannelsReport period={period} />}
      {type === 'pl-month' && <PlMonthReport month={month} />}

      {!['pulse','pace','channels','pl-month'].includes(type) && (
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
