'use client';

// app/it/schedule/page.tsx
// Marathon #195 child — IT · Schedule
// Wires cron.job rows into a live schedule table.
// cron schema exposed via supabase service role — falls back to empty state gracefully.

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import PageHeader from '@/components/layout/PageHeader';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';

interface CronJob {
  jobid: number;
  jobname: string;
  schedule: string;
  command: string;
  active: boolean;
  database?: string | null;
  username?: string | null;
}

const COLUMNS = [
  { key: 'jobid',    header: 'ID' },
  { key: 'jobname',  header: 'Job Name' },
  { key: 'schedule', header: 'Schedule (cron)' },
  { key: 'active',   header: 'Active' },
  { key: 'command',  header: 'Command' },
];

function formatActive(val: boolean): string {
  return val ? '✓ Active' : '✗ Inactive';
}

export default function ItSchedulePage() {
  const [jobs, setJobs]       = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    void (async () => {
      // cron.job is in the cron schema — query via rpc or direct schema hint
      const { data, error: err } = await supabase
        .schema('cron')
        .from('job')
        .select('jobid, jobname, schedule, command, active, database, username')
        .order('jobid');

      if (err) {
        setError(err.message);
      } else {
        setJobs(data ?? []);
      }
      setLoading(false);
    })();
  }, []);

  const activeCount   = jobs.filter(j => j.active).length;
  const inactiveCount = jobs.filter(j => !j.active).length;
  const totalCount    = jobs.length;

  // Normalise rows for DataTable (booleans → strings, truncate long commands)
  const rows = jobs.map(j => ({
    ...j,
    active:  formatActive(j.active),
    command: j.command.length > 80 ? j.command.slice(0, 80) + '…' : j.command,
  }));

  return (
    <main style={{ padding: '24px 32px', fontFamily: 'var(--font-sans, sans-serif)' }}>
      <PageHeader pillar="IT" tab="Schedule" title="Cron Schedule" />

      {/* KPI strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <KpiBox label="Total Jobs"    value={loading ? '…' : String(totalCount)}   />
        <KpiBox label="Active Jobs"   value={loading ? '…' : String(activeCount)}   />
        <KpiBox label="Inactive Jobs" value={loading ? '…' : String(inactiveCount)} />
      </div>

      {/* Error banner */}
      {error && (
        <div
          style={{
            background: 'var(--red-1, #fff0f0)',
            border: '1px solid var(--red-2, #ffb3b3)',
            borderRadius: 6,
            padding: '10px 16px',
            marginBottom: 16,
            color: 'var(--ink, #1a1a1a)',
          }}
        >
          <strong>Could not load cron jobs:</strong> {error}
          <br />
          <small>
            Ensure the <code>cron</code> schema is exposed in Supabase API settings and
            the service role has SELECT on <code>cron.job</code>.
          </small>
        </div>
      )}

      {/* Main table */}
      <DataTable
        columns={COLUMNS}
        rows={rows}
      />

      {!loading && !error && totalCount === 0 && (
        <p style={{ color: 'var(--ink-mute, #888)', marginTop: 16, textAlign: 'center' }}>
          No cron jobs found — or <code>cron</code> schema is not exposed to the API.
        </p>
      )}
    </main>
  );
}
