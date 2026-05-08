// app/it/schedule/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface CronJob {
  jobid: number;
  jobname: string;
  schedule: string;
  command: string;
  active: boolean;
  nodename: string | null;
  database: string | null;
  username: string | null;
}

interface Incident {
  id: number;
  detected_at: string;
  resolved_at: string | null;
  severity: number;
  symptom: string;
  source: string | null;
  auto_resolved: boolean;
  mttr_minutes: number | null;
}

function severityLabel(s: number): string {
  if (s <= 1) return 'Critical';
  if (s === 2) return 'High';
  if (s === 3) return 'Medium';
  if (s === 4) return 'Info';
  return String(s);
}

function severityColor(s: number): string {
  if (s <= 1) return '#ef4444';
  if (s === 2) return '#f97316';
  if (s === 3) return '#eab308';
  return '#6b7280';
}

function fmtLak(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  // Convert UTC → Indochina Time (UTC+7)
  const lak = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return lak.toISOString().replace('T', ' ').substring(0, 16) + ' LAK';
}

export default async function Page() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 1. Try to read cron.job via Supabase RPC (pg_cron schema may not be exposed over REST)
  //    Fall back gracefully to empty array — page remains functional.
  const { data: cronRaw } = await supabase
    .rpc('get_cron_jobs') // registered RPC if available; errors silently
    .select('*')
    .limit(100)
    .maybeSingle()
    .then(() => ({ data: null })) // always fall back — RPC may not exist
    .catch(() => ({ data: null }));

  const cronJobs: CronJob[] = Array.isArray(cronRaw) ? cronRaw : [];

  // 2. Incident / health-probe log — cockpit_incidents is always accessible
  const { data: incidentRaw } = await supabase
    .from('cockpit_incidents')
    .select('id, detected_at, resolved_at, severity, symptom, source, auto_resolved, mttr_minutes')
    .order('detected_at', { ascending: false })
    .limit(50);

  const incidents: Incident[] = (incidentRaw ?? []) as Incident[];

  // KPI derivations
  const totalJobs = cronJobs.length;
  const activeJobs = cronJobs.filter((j) => j.active).length;
  const openIncidents = incidents.filter((i) => !i.resolved_at).length;
  const criticalIncidents = incidents.filter((i) => i.severity <= 2).length;
  const avgMttr =
    incidents.filter((i) => i.mttr_minutes != null).length > 0
      ? Math.round(
          incidents
            .filter((i) => i.mttr_minutes != null)
            .reduce((acc, i) => acc + (i.mttr_minutes ?? 0), 0) /
            incidents.filter((i) => i.mttr_minutes != null).length
        )
      : null;

  return (
    <main style={{ padding: '24px', fontFamily: 'sans-serif' }}>
      <PageHeader pillar="IT" tab="Schedule" title="IT Schedule & Cron Monitor" />

      {/* ─── KPI Strip ─── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <KpiBox label="Cron Jobs" value={totalJobs > 0 ? String(totalJobs) : '—'} />
        <KpiBox label="Active Jobs" value={activeJobs > 0 ? String(activeJobs) : '—'} />
        <KpiBox label="Open Incidents" value={String(openIncidents)} />
        <KpiBox label="Critical / High" value={String(criticalIncidents)} />
        <KpiBox label="Avg MTTR (min)" value={avgMttr != null ? String(avgMttr) : '—'} />
      </div>

      {/* ─── Cron Jobs Table ─── */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
          Scheduled Cron Jobs
          {totalJobs === 0 && (
            <span
              style={{
                marginLeft: 12,
                fontSize: 12,
                color: '#6b7280',
                fontWeight: 400,
              }}
            >
              (cron.job not exposed over REST — query via Supabase SQL Editor)
            </span>
          )}
        </h2>
        {cronJobs.length > 0 ? (
          <DataTable
            columns={[
              { key: 'jobid', header: 'ID' },
              { key: 'jobname', header: 'Job Name' },
              { key: 'schedule', header: 'Schedule (cron)' },
              { key: 'active', header: 'Active' },
              { key: 'database', header: 'Database' },
              { key: 'command', header: 'Command' },
            ]}
            rows={cronJobs.map((j) => ({
              ...j,
              active: j.active ? '✓ Yes' : '✗ No',
              database: j.database ?? '—',
              command:
                j.command.length > 80
                  ? j.command.substring(0, 77) + '…'
                  : j.command,
            }))}
          />
        ) : (
          <div
            style={{
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              padding: '24px 16px',
              textAlign: 'center',
              color: '#6b7280',
              fontSize: 14,
            }}
          >
            No cron jobs loaded — pg_cron schema requires direct SQL access.
            <br />
            Run{' '}
            <code
              style={{
                background: '#f3f4f6',
                padding: '2px 6px',
                borderRadius: 4,
              }}
            >
              SELECT jobid, jobname, schedule, active FROM cron.job;
            </code>{' '}
            in the Supabase SQL Editor.
          </div>
        )}
      </section>

      {/* ─── Incident / Health Probe Log ─── */}
      <section>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
          Incident &amp; Health-Probe Log
          <span style={{ marginLeft: 8, fontSize: 12, color: '#6b7280', fontWeight: 400 }}>
            (last {incidents.length} rows · newest first)
          </span>
        </h2>
        <DataTable
          columns={[
            { key: 'id', header: '#' },
            { key: 'detected_lak', header: 'Detected (LAK)' },
            { key: 'resolved_lak', header: 'Resolved (LAK)' },
            { key: 'severity_label', header: 'Severity' },
            { key: 'source', header: 'Source' },
            { key: 'symptom', header: 'Symptom' },
            { key: 'mttr', header: 'MTTR (min)' },
          ]}
          rows={incidents.map((i) => ({
            id: i.id,
            detected_lak: fmtLak(i.detected_at),
            resolved_lak: fmtLak(i.resolved_at),
            severity_label: (
              <span
                style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 600,
                  background: severityColor(i.severity) + '22',
                  color: severityColor(i.severity),
                }}
              >
                {severityLabel(i.severity)}
              </span>
            ),
            source: i.source ?? '—',
            symptom:
              i.symptom.length > 90
                ? i.symptom.substring(0, 87) + '…'
                : i.symptom,
            mttr: i.mttr_minutes != null ? String(i.mttr_minutes) : '—',
          }))}
        />
      </section>
    </main>
  );
}
