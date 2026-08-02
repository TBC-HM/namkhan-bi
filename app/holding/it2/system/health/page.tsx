// app/holding/it2/system/health/page.tsx
// Health — combines cockpit health (incidents + crons + audit) with
// live URL sweep results from public.health_check_runs.
// URL sweep cron runs every 6h (cron ID 188). Manual trigger:
//   GET /api/cockpit/health-sweep?trigger=manual with CRON_SHARED_SECRET.

import { fetchHealth } from '@/lib/cockpit/data-port';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { HealthView } from './HealthView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

interface SweepRow {
  url: string;
  status_code: number | null;
  ok: boolean | null;
  latency_ms: number | null;
  error_msg: string | null;
  run_at: string | null;
  trigger: string | null;
}

function statusBadge(ok: boolean | null, code: number | null): string {
  if (ok === null) return '—';
  if (ok) return `✓ ${code}`;
  return `✗ ${code ?? 'err'}`;
}

function statusColor(ok: boolean | null): string {
  if (ok === null) return '#888';
  return ok ? '#2E7D32' : '#C62828';
}

export default async function CockpitV2HealthPage() {
  const sb = getSupabaseAdmin();
  const [data, sweepRes] = await Promise.all([
    fetchHealth(),
    (sb as any).from('v_health_latest_sweep').select('*'),
  ]);

  const sweep = (sweepRes.data ?? []) as SweepRow[];
  const sweepRunAt = sweep[0]?.run_at ?? null;
  const sweepTrigger = sweep[0]?.trigger ?? null;
  const failCount = sweep.filter((r) => !r.ok).length;

  return (
    <>
      {/* URL Sweep Section */}
      {sweep.length > 0 && (
        <div style={{ maxWidth: 900, marginBottom: 28, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
            <h2 style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5A5A5A', margin: 0 }}>
              URL HEALTH SWEEP
            </h2>
            <span style={{ fontSize: 11, color: '#888' }}>
              {sweepRunAt ? new Date(sweepRunAt).toLocaleString('en-GB') : '—'} · trigger: {sweepTrigger}
            </span>
            {failCount > 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#C62828', background: '#FFEBEE', padding: '2px 8px', borderRadius: 4, border: '1px solid #EF9A9A' }}>
                {failCount} failing
              </span>
            )}
            {failCount === 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#2E7D32', background: '#E8F5E9', padding: '2px 8px', borderRadius: 4, border: '1px solid #A5D6A7' }}>
                all {sweep.length} OK
              </span>
            )}
          </div>
          <div style={{ border: '1px solid #E6DFCC', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: '#FAFAF7' }}>
                  <th style={{ textAlign: 'left', padding: '6px 12px', fontWeight: 600, fontSize: 11, color: '#5A5A5A', borderBottom: '1px solid #E6DFCC' }}>URL</th>
                  <th style={{ textAlign: 'left', padding: '6px 12px', fontWeight: 600, fontSize: 11, color: '#5A5A5A', borderBottom: '1px solid #E6DFCC', whiteSpace: 'nowrap' }}>Status</th>
                  <th style={{ textAlign: 'left', padding: '6px 12px', fontWeight: 600, fontSize: 11, color: '#5A5A5A', borderBottom: '1px solid #E6DFCC', whiteSpace: 'nowrap' }}>Latency</th>
                  <th style={{ textAlign: 'left', padding: '6px 12px', fontWeight: 600, fontSize: 11, color: '#5A5A5A', borderBottom: '1px solid #E6DFCC' }}>Error</th>
                </tr>
              </thead>
              <tbody>
                {sweep.map((r, i) => (
                  <tr key={r.url} style={{ borderBottom: i < sweep.length - 1 ? '1px solid #E6DFCC' : 'none', background: !r.ok ? '#FFF8F8' : 'transparent' }}>
                    <td style={{ padding: '7px 12px', fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 11.5, color: '#1B1B1B' }}>{r.url}</td>
                    <td style={{ padding: '7px 12px', fontWeight: 700, color: statusColor(r.ok), whiteSpace: 'nowrap' }}>{statusBadge(r.ok, r.status_code)}</td>
                    <td style={{ padding: '7px 12px', fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 11, color: '#5A5A5A', whiteSpace: 'nowrap' }}>{r.latency_ms != null ? `${r.latency_ms}ms` : '—'}</td>
                    <td style={{ padding: '7px 12px', fontSize: 11, color: '#C62828' }}>{r.error_msg ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 6, fontSize: 11, color: '#888' }}>
            Cron ID 188 · runs every 6h · manual: <code style={{ fontFamily: 'ui-monospace', background: '#F5F5F5', padding: '1px 5px', borderRadius: 3 }}>GET /api/cockpit/health-sweep?trigger=manual</code>
          </div>
        </div>
      )}

      {sweep.length === 0 && (
        <div style={{ maxWidth: 900, marginBottom: 20, padding: '12px 16px', border: '1px solid #E6DFCC', borderRadius: 8, fontSize: 12.5, color: '#5A5A5A', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
          No URL sweep data yet. First run scheduled for next 6h cron tick, or trigger manually:
          <code style={{ fontFamily: 'ui-monospace', marginLeft: 8, background: '#F5F5F5', padding: '2px 6px', borderRadius: 3 }}>GET /api/cockpit/health-sweep?trigger=manual</code>
        </div>
      )}

      <HealthView initial={data} />
    </>
  );
}
