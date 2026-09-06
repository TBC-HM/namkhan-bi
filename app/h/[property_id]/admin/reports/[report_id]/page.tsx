// app/h/[property_id]/admin/reports/[report_id]/page.tsx
// PBS 2026-09-06: full-report view, opened in a new tab from the Preview button on
// Administration › Reports and Revenue › RevReports.
//
// Replaces the inline 25-row preview, which could only ever show the top of a report —
// several of these run to thousands of rows, so the inline panel answered "did the sync
// return anything" but never "what does the report say". This renders the whole
// snapshot.
//
// Uses the same flattenSnapshot as the CSV route, so what you read here and what you
// download are the same table, including the two-decimal rule.

import { notFound } from 'next/navigation';
import { DashboardPage, Container, KpiTile } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { flattenSnapshot } from '@/lib/cb-report-table';
import { KNOWN_REPORTS } from '@/lib/cb-reports';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props { params: { property_id: string; report_id: string } }

export default async function FullReportPage({ params }: Props) {
  const propertyId = Number(params.property_id);
  const reportId = Number(params.report_id);
  if (!Number.isFinite(propertyId) || propertyId <= 0) notFound();
  if (!Number.isFinite(reportId) || reportId <= 0) notFound();

  const { data, error } = await (getSupabaseAdmin() as any)
    .from('v_stock_report_snapshot')
    .select('report_name, report_date, period_from, period_to, headers, records, synced_at')
    .eq('property_id', propertyId)
    .eq('report_id', reportId)
    .order('synced_at', { ascending: false })
    .limit(1)
    .single();

  const meta = KNOWN_REPORTS[reportId];
  const title = `${reportId} · ${meta?.label ?? (data?.report_name ?? `Report ${reportId}`)}`;

  if (error || !data) {
    return (
      <DashboardPage title={title} subtitle="No snapshot">
        <div style={fullRow}>
          <Container title="Nothing synced yet" density="compact">
            <p style={note}>
              This report has never been synced for property {propertyId}. Run Sync on the
              Reports page first.
            </p>
          </Container>
        </div>
      </DashboardPage>
    );
  }

  const snap = data as {
    report_name: string; report_date: string | null;
    period_from: string | null; period_to: string | null;
    headers: unknown; records: unknown; synced_at: string;
  };

  const { columns, rows, shape } = flattenSnapshot(snap.headers, snap.records);

  // period_from is NULL whenever the sync ran in definition-replay mode, because the
  // report's own saved window governs and echoing our requested range would be a lie.
  const period = snap.period_from
    ? `${snap.period_from} → ${snap.period_to}`
    : "report's own window";

  const csvHref = `/api/admin/reports/download?property_id=${propertyId}&report_id=${reportId}`;

  return (
    <DashboardPage
      title={title}
      subtitle={`${rows.length.toLocaleString()} rows · ${columns.length} columns · synced ${snap.synced_at.slice(0, 16).replace('T', ' ')}`}
    >
      <div style={fullRow}>
        <Container title="Snapshot" density="compact">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
            <KpiTile label="Rows" value={rows.length} size="sm" />
            <KpiTile label="Columns" value={columns.length} size="sm" />
            <KpiTile label="Period" value={period as never} size="sm" />
            <KpiTile label="Shape" value={shape as never} size="sm"
                     footnote={shape === 'grouped' ? 'row-nested' : shape === 'list' ? 'column-oriented' : 'empty'} />
          </div>
          <div style={{ marginTop: 10 }}>
            <a href={csvHref} style={csvBtn}>↓ Download CSV</a>
          </div>
        </Container>
      </div>

      <div style={fullRow}>
        <Container
          title={snap.report_name}
          subtitle={rows.length === 0
            ? 'The sync succeeded and Cloudbeds returned no rows for this report.'
            : 'Complete report as returned by Cloudbeds · “-” is Cloudbeds’ own not-applicable marker, not zero'}
          density="compact"
        >
          {rows.length === 0 ? (
            <p style={note}>
              Nothing to show. This is usually the report being genuinely empty for this
              property rather than a failure — several Cloudbeds reports carry saved
              filters that match nothing here.
            </p>
          ) : (
            <div style={{ overflow: 'auto', maxHeight: '75vh' }}>
              <table style={table}>
                <thead>
                  <tr>
                    {columns.map((c, i) => (
                      <th key={i} style={{ ...th, left: i === 0 ? 0 : undefined, zIndex: i === 0 ? 3 : 2 }}>
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, ri) => (
                    <tr key={ri} style={tr}>
                      {r.map((v, ci) => (
                        <td key={ci} style={{
                          ...td,
                          textAlign: isNumeric(v) ? 'right' : 'left',
                          color: v === '-' ? 'var(--tbl-fg-mute, #8A8A8A)' : undefined,
                        }}>
                          {v === '' ? '—' : v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Container>
      </div>
    </DashboardPage>
  );
}

/** Right-align real numbers only — never ids, dates or Cloudbeds' "-" marker. */
function isNumeric(v: string): boolean {
  return v !== '' && v !== '-' && /^-?\d+(\.\d+)?$/.test(v);
}

const fullRow: React.CSSProperties = { gridColumn: '1 / -1' };

const note: React.CSSProperties = {
  padding: '10px 2px', fontSize: 13, lineHeight: 1.6,
  color: 'var(--tbl-fg-mute, #5A5A5A)',
};

const table: React.CSSProperties = {
  width: '100%', borderCollapse: 'collapse', fontSize: 12,
};

const th: React.CSSProperties = {
  position: 'sticky', top: 0,
  padding: '8px 12px', fontSize: 10, fontWeight: 600,
  letterSpacing: '0.06em', textTransform: 'uppercase',
  color: 'var(--tbl-fg-mute, #5A5A5A)',
  background: 'var(--tbl-bg-elev, #F5F0E1)',
  borderBottom: '1px solid var(--tbl-border-strong, #D8CFB4)',
  textAlign: 'left', whiteSpace: 'nowrap',
};

const tr: React.CSSProperties = {
  borderBottom: '1px solid var(--tbl-border, #E6DFCC)',
};

const td: React.CSSProperties = {
  padding: '6px 12px', fontSize: 12,
  color: 'var(--tbl-fg, #1B1B1B)',
  fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
};

const csvBtn: React.CSSProperties = {
  display: 'inline-block', padding: '4px 12px',
  fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
  background: 'rgba(31,58,46,0.06)', color: '#1F3A2E',
  border: '1px solid rgba(31,58,46,0.2)', borderRadius: 3,
  textDecoration: 'none',
};
