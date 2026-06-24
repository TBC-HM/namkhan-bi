// app/operations/today/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OpsRow {
  date?: string;
  department?: string;
  metric?: string;
  value?: number | string | null;
  status?: string | null;
  note?: string | null;
  [key: string]: unknown;
}

interface KpiSnapshot {
  date?: string;
  open_incidents?: number | null;
  deploys_today?: number | null;
  deploy_success_rate_7d?: number | null;
  security_red?: number | null;
  security_warn?: number | null;
  uptime_pct?: number | null;
  error_rate?: number | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(v: number | string | null | undefined, prefix = ''): string {
  if (v === null || v === undefined || v === '') return '—';
  return `${prefix}${v}`;
}

function fmtPct(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return `${v.toFixed(1)} %`;
}

function statusColor(status: string | null | undefined): string {
  if (!status) return '#6b7280';
  const s = status.toLowerCase();
  if (s === 'ok' || s === 'good' || s === 'normal') return '#16a34a';
  if (s === 'warn' || s === 'warning') return '#d97706';
  if (s === 'critical' || s === 'red' || s === 'error') return '#dc2626';
  return '#6b7280';
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function Page() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Primary data: operations today view
  const { data: opsData } = await supabase
    .from('v_operations_today')
    .select('*')
    .limit(100);

  const rows: OpsRow[] = opsData ?? [];

  // Secondary data: latest KPI snapshot for headline KPIs
  const { data: snapData } = await supabase
    .from('cockpit_kpi_snapshots')
    .select(
      'date, open_incidents, deploys_today, deploy_success_rate_7d, security_red, security_warn, uptime_pct, error_rate'
    )
    .order('date', { ascending: false })
    .limit(1);

  const snap: KpiSnapshot = (snapData ?? [])[0] ?? {};

  // Open incidents from cockpit_incidents
  const { count: incidentCount } = await supabase
    .from('cockpit_incidents')
    .select('*', { count: 'exact', head: true })
    .eq('resolved', false);

  const openIncidents =
    incidentCount ?? snap.open_incidents ?? null;

  // Summary KPIs derived from rows (for operations-specific view)
  const totalDepts = rows.length > 0
    ? new Set(rows.map((r) => r.department).filter(Boolean)).size
    : null;

  const criticalCount = rows.filter(
    (r) => r.status && ['critical', 'red', 'error'].includes(String(r.status).toLowerCase())
  ).length;

  const warnCount = rows.filter(
    (r) => r.status && ['warn', 'warning'].includes(String(r.status).toLowerCase())
  ).length;

  // DataTable columns — adapt to whatever shape v_operations_today returns
  const hasOpsRows = rows.length > 0;
  const sampleKeys = hasOpsRows ? Object.keys(rows[0]) : [];

  // Build columns intelligently from actual data or use a sensible default set
  const knownColumns: Array<{ key: string; header: string }> = [
    { key: 'department', header: 'Department' },
    { key: 'metric', header: 'Metric' },
    { key: 'value', header: 'Value' },
    { key: 'status', header: 'Status' },
    { key: 'note', header: 'Note' },
  ];

  const columns =
    hasOpsRows && sampleKeys.length > 0
      ? sampleKeys.map((k) => ({
          key: k,
          header: k
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase()),
        }))
      : knownColumns;

  // Render rows: format nulls, add status colour hint
  const displayRows = rows.map((r) => {
    const out: Record<string, string> = {};
    for (const col of columns) {
      const raw = r[col.key];
      if (col.key === 'status') {
        out[col.key] = raw != null ? String(raw) : '—';
      } else {
        out[col.key] = raw != null && raw !== '' ? String(raw) : '—';
      }
    }
    return out;
  });

  return (
    <main style={{ padding: '24px 32px', fontFamily: 'var(--font-sans, sans-serif)' }}>
      <PageHeader pillar="Operations" tab="Today" title="Operations · Today" />

      {/* ── Headline KPI strip ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <KpiBox
          label="Open Incidents"
          value={fmt(openIncidents)}
          highlight={openIncidents !== null && openIncidents > 0}
        />
        <KpiBox
          label="Uptime"
          value={fmtPct(snap.uptime_pct)}
        />
        <KpiBox
          label="Error Rate"
          value={fmtPct(snap.error_rate)}
        />
        <KpiBox
          label="Deploys Today"
          value={fmt(snap.deploys_today)}
        />
        <KpiBox
          label="Deploy Success (7d)"
          value={fmtPct(snap.deploy_success_rate_7d)}
        />
        <KpiBox
          label="Security 🔴"
          value={fmt(snap.security_red)}
          highlight={!!snap.security_red && snap.security_red > 0}
        />
        <KpiBox
          label="Security ⚠️"
          value={fmt(snap.security_warn)}
        />
        {totalDepts !== null && (
          <KpiBox label="Depts Reporting" value={String(totalDepts)} />
        )}
        {hasOpsRows && (
          <KpiBox
            label="Critical Items"
            value={String(criticalCount)}
            highlight={criticalCount > 0}
          />
        )}
        {hasOpsRows && (
          <KpiBox label="Warnings" value={String(warnCount)} />
        )}
      </div>

      {/* ── Status legend ── */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 20, fontSize: 13 }}>
        {[
          { label: 'OK', color: '#16a34a' },
          { label: 'Warning', color: '#d97706' },
          { label: 'Critical', color: '#dc2626' },
          { label: 'Unknown', color: '#6b7280' },
        ].map(({ label, color }) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: color,
                display: 'inline-block',
              }}
            />
            {label}
          </span>
        ))}
      </div>

      {/* ── Operations table ── */}
      {hasOpsRows ? (
        <DataTable columns={columns} rows={displayRows} />
      ) : (
        <div
          style={{
            padding: '48px 0',
            textAlign: 'center',
            color: '#6b7280',
            fontSize: 15,
            border: '1px dashed #d1d5db',
            borderRadius: 8,
          }}
        >
          No operations data for today yet. Check back after the morning sync.
        </div>
      )}

      {/* ── Security advisory banner ── */}
      {(snap.security_red ?? 0) > 0 && (
        <div
          style={{
            marginTop: 32,
            padding: '16px 20px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 8,
            color: '#7f1d1d',
            fontSize: 14,
          }}
        >
          <strong>⚠ Security advisory:</strong>{' '}
          {snap.security_red} critical npm{' '}
          {snap.security_red === 1 ? 'advisory' : 'advisories'} and{' '}
          {snap.security_warn ?? 0} warning
          {(snap.security_warn ?? 0) !== 1 ? 's' : ''} flagged. Run{' '}
          <code>npm audit</code> and patch before next release.
        </div>
      )}

      <p
        style={{ marginTop: 24, fontSize: 12, color: '#9ca3af' }}
      >
        Last refreshed: {snap.date ?? new Date().toISOString().slice(0, 10)} ·
        Auto-updates every 60 s
      </p>
    </main>
  );
}
