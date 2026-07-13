// app/revenue/_shared/LighthouseIngestStatus.tsx
// PBS 2026-07-14: small "Last import: {ts} · {rows} rows" strip
// surfaced above /revenue/lighthouse/overview and /revenue/parity.
// Reads from public.v_lighthouse_ingest_runs (bridge over
// revenue.lighthouse_ingest_runs) — populated by the
// ingest-lighthouse-mails edge fn.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

type IngestRunRow = {
  id: string;
  report_type: string;
  status: string;
  rows_parsed: number | null;
  rows_upserted: number | null;
  started_at: string;
  finished_at: string | null;
  attachment_filename: string | null;
  error_msg: string | null;
};

export type IngestReportType = 'rateshopping' | 'rate_integrity';

async function getLastRun(report: IngestReportType): Promise<IngestRunRow | null> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('v_lighthouse_ingest_runs')
    .select('id, report_type, status, rows_parsed, rows_upserted, started_at, finished_at, attachment_filename, error_msg')
    .eq('report_type', report)
    .order('started_at', { ascending: false })
    .limit(1);
  const rows = (data ?? []) as IngestRunRow[];
  return rows[0] ?? null;
}

function fmtTs(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  // ISO short: 2026-07-14 07:15 UTC
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi} UTC`;
}

export async function LighthouseIngestStatus({ report }: { report: IngestReportType }) {
  const run = await getLastRun(report);
  if (!run) {
    return (
      <div style={{ fontSize: 11, color: '#5A5A5A', padding: '2px 0 6px' }}>
        Last import: <span style={{ fontFamily: 'ui-monospace, monospace' }}>never</span>
        <span style={{ marginLeft: 8, color: '#8A8A80' }}>· awaiting first cron run</span>
      </div>
    );
  }
  const isErr = run.status === 'error' || run.status === 'no_email' || run.status === 'no_attachment';
  const tone = isErr ? '#8B3A1F' : '#5A5A5A';
  const badge = run.status === 'success' ? 'ok' : run.status;
  return (
    <div style={{ fontSize: 11, color: tone, padding: '2px 0 6px' }}>
      Last import: <span style={{ fontFamily: 'ui-monospace, monospace' }}>{fmtTs(run.finished_at ?? run.started_at)}</span>
      <span style={{ marginLeft: 8, color: '#8A8A80' }}>
        · {run.rows_upserted ?? 0} new / {run.rows_parsed ?? 0} parsed · {badge}
      </span>
      {run.error_msg ? <span style={{ marginLeft: 8 }}>· {run.error_msg}</span> : null}
    </div>
  );
}
