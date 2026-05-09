// app/revenue/reports/render/page.tsx
// PBS 2026-05-09 #report-builder repair: the Reports container default docs
// used to point at dead routes (`/revenue/strategy`, `/revenue/channel-mix`,
// `/revenue/bar`) which 404'd or fell back to /revenue/pace. The Build-a-
// report modal also pointed at the source pages (`/revenue/pulse` etc.) so
// pressing a saved report opened the live page instead of a printable doc.
//
// This route is the single, printable, sendable, popup-on-screen render
// target for every revenue report type. URL contract:
//   /revenue/reports/render
//     ?type=pulse|pace|channels|pl-month
//     &win=30d&cmp=stly&seg=all   (period.ts standard)
//     &month=2026-04              (pl-month only)
//
// The page renders inside <Page footer={false}/> for a clean A4 layout.
// `@media print` strips the sticky header, hides interactive controls, and
// flips colors to white-on-black. PrintControls offers Print, Copy link,
// Email (mailto + POST /api/cockpit/reports/send fallback to a ticket).

import Page from '@/components/page/Page';
import { resolvePeriod } from '@/lib/period';
import PrintControls from './PrintControls';
import PulseReport from './_renderers/PulseReport';
import PaceReport from './_renderers/PaceReport';
import ChannelsReport from './_renderers/ChannelsReport';
import PlMonthReport from './_renderers/PlMonthReport';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const TITLE_BY_TYPE: Record<string, string> = {
  pulse:    'Pulse',
  pace:     'Pace',
  channels: 'Channels',
  'pl-month': 'P&L · month',
  pl_month: 'P&L · month',
};

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function RevenueReportRender({ searchParams }: Props) {
  const rawType = String(searchParams.type ?? 'pulse').toLowerCase();
  // Accept dash + underscore variants for pl-month.
  const type = rawType === 'pl_month' ? 'pl-month' : rawType;
  const titleWord = TITLE_BY_TYPE[type] ?? 'Revenue';

  const period = resolvePeriod(searchParams);
  const month = String(searchParams.month ?? '').slice(0, 7); // pl-month only

  const stamp = new Date().toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <Page
      eyebrow={`Revenue · Report · ${period.label}`}
      title={
        <>
          {titleWord} <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>report</em>
        </>
      }
      topRight={<PrintControls reportType={type} />}
      showHeaderPills={false}
      footer={false}
    >
      <style>{`
        /* Clean A4 print stylesheet. Strips chrome, removes sticky header,
           inverts colours to ink-on-paper. */
        @media print {
          html, body { background: #fff !important; color: #111 !important; }
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
          .no-print, .no-print * { display: none !important; }
          a { color: inherit !important; text-decoration: none !important; }
          /* Kill the sticky top bar so it doesn't repeat / float oddly. */
          [data-page-top] { position: static !important; backdrop-filter: none !important; background: transparent !important; border-bottom: none !important; }
          /* A4 page margins */
          @page { size: A4; margin: 14mm; }
        }
        .report-meta {
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 11px; color: #9b907a;
          letter-spacing: 0.10em; text-transform: uppercase;
          margin-bottom: 14px;
        }
        .tbl { width: 100%; border-collapse: collapse; font-size: 12px; }
        .tbl th { text-align: left; padding: 6px 8px; color: #a8854a;
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase;
          border-bottom: 1px solid #1f1c15; }
        .tbl td { padding: 6px 8px; color: #d8cca8; border-bottom: 1px solid #161310; }
        .tbl td.num, .tbl th.num { text-align: right; font-variant-numeric: tabular-nums; }
        .tbl td.lbl { color: #c9bb96; }
      `}</style>

      <div className="report-meta">
        Generated {stamp} · Source · Cloudbeds + QB · Property 260955
      </div>

      {type === 'pulse'    && <PulseReport period={period} />}
      {type === 'pace'     && <PaceReport period={period} />}
      {type === 'channels' && <ChannelsReport period={period} />}
      {(type === 'pl-month') && <PlMonthReport period={period} month={month} />}
      {!['pulse','pace','channels','pl-month'].includes(type) && (
        <div data-panel style={{
          padding: 24, color: '#7d7565', fontStyle: 'italic',
          textAlign: 'center', background: '#0f0d0a',
          border: '1px solid #1f1c15', borderRadius: 10,
        }}>
          Unknown report type "{type}". Supported types: pulse, pace, channels, pl-month.
        </div>
      )}
    </Page>
  );
}
