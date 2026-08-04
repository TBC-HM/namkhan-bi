// app/holding/it2/system/health/page.tsx
// Health — cockpit incidents + crons + URL sweep results.
// URL sweep: cron 188 runs every 6h. "Run sweep now" triggers on demand.

import { fetchHealth } from '@/lib/cockpit/data-port';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { HealthView } from './HealthView';
import { SweepTrigger } from './SweepTrigger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

interface SweepRow {
  url: string; status_code: number | null; ok: boolean | null;
  latency_ms: number | null; error_msg: string | null;
  run_at: string | null; trigger: string | null;
}

function statusBadge(ok: boolean | null, code: number | null): string {
  if (ok === null) return '—';
  return ok ? `✓ ${code}` : `✗ ${code ?? 'err'}`;
}
function statusColor(ok: boolean | null): string {
  return ok === null ? '#888' : ok ? '#2E7D32' : '#C62828';
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

  const cell: React.CSSProperties = { padding: '7px 12px', borderBottom: '1px solid #E6DFCC' };
  const hdr: React.CSSProperties = { ...cell, textAlign: 'left', fontWeight: 600, fontSize: 11, color: '#5A5A5A', background: '#FAFAF7', whiteSpace: 'nowrap' as const };

  return (
    <>
      {/* URL Sweep panel */}
      <div style={{ maxWidth: 900, marginBottom: 28, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <h2 style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: '#5A5A5A', margin: 0 }}>
              URL HEALTH SWEEP
            </h2>
            {sweepRunAt && (
              <span style={{ fontSize: 11, color: '#888' }}>
                last run: {new Date(sweepRunAt).toLocaleString('en-GB')} · {sweepTrigger}
              </span>
            )}
            {sweep.length > 0 && failCount === 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#2E7D32', background: '#E8F5E9', padding: '2px 8px', borderRadius: 4, border: '1px solid #A5D6A7' }}>
                all {sweep.length} OK
              </span>
            )}
            {failCount > 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#C62828', background: '#FFEBEE', padding: '2px 8px', borderRadius: 4, border: '1px solid #EF9A9A' }}>
                {failCount} failing
              </span>
            )}
          </div>
          {/* Manual trigger CTA */}
          <SweepTrigger />
        </div>

        {sweep.length === 0 ? (
          <div style={{ padding: '14px 16px', border: '1px solid #E6DFCC', borderRadius: 8, fontSize: 12.5, color: '#5A5A5A' }}>
            No sweep data yet — press <strong>Run sweep now</strong> above to populate.
          </div>
        ) : (
          <div style={{ border: '1px solid #E6DFCC', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr>
                  <th style={hdr}>URL</th>
                  <th style={hdr}>Status</th>
                  <th style={hdr}>Latency</th>
                  <th style={hdr}>Error</th>
                </tr>
              </thead>
              <tbody>
                {sweep.map((r, i) => (
                  <tr key={r.url} style={{ background: !r.ok ? '#FFF8F8' : 'transparent', borderBottom: i < sweep.length - 1 ? '1px solid #E6DFCC' : 'none' }}>
                    <td style={{ ...cell, borderBottom: 'none', fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 11.5, color: '#1B1B1B' }}>{r.url}</td>
                    <td style={{ ...cell, borderBottom: 'none', fontWeight: 700, color: statusColor(r.ok), whiteSpace: 'nowrap' as const }}>{statusBadge(r.ok, r.status_code)}</td>
                    <td style={{ ...cell, borderBottom: 'none', fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 11, color: '#5A5A5A', whiteSpace: 'nowrap' as const }}>{r.latency_ms != null ? `${r.latency_ms}ms` : '—'}</td>
                    <td style={{ ...cell, borderBottom: 'none', fontSize: 11, color: '#C62828' }}>{r.error_msg ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ marginTop: 5, fontSize: 11, color: '#AAA' }}>
          Cron 188 · 0 */6 * * * · stores results in public.health_check_runs
        </div>

        {/* DQ Engine link card (dq-engine-v1 — no free System tab, law 659) */}
        <a href="/holding/it2/system/data-quality" style={{
          display: 'block', marginTop: 16, padding: '12px 16px', border: '1px solid #E6DFCC',
          borderRadius: 8, textDecoration: 'none', background: '#FFFFFF',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: '#5A5A5A' }}>
            Data Quality →
          </div>
          <div style={{ fontSize: 12, color: '#5A5A5A', marginTop: 4 }}>
            Feed freshness, rule exceptions, and week-over-week data-quality trend — is the data on this platform trustworthy right now?
          </div>
        </a>

        {/* Operating Laws link card (laws-page-v1 — same law-659 pattern) */}
        <a href="/holding/it2/system/laws" style={{
          display: 'block', marginTop: 10, padding: '12px 16px', border: '1px solid #E6DFCC',
          borderRadius: 8, textDecoration: 'none', background: '#FFFFFF',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: '#5A5A5A' }}>
            ⚖ Operating Laws →
          </div>
          <div style={{ fontSize: 12, color: '#5A5A5A', marginTop: 4 }}>
            Every rule the agents run on — searchable, grouped by topic, with propose-change and retire CTAs. Guardrails stay in Settings; this is how the machine works.
          </div>
        </a>
      </div>

      <HealthView initial={data} />
    </>
  );
}
