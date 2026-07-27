// app/holding/it/cockpit/university/page.tsx
//
// University refresh loop — nightly job log (brief
// autospec-university_module-20260725, acceptance: "Nightly job log visible
// in cockpit — last run, articles touched, trigger reason").
// Live read from public.v_university_refresh_runs. The job itself is
// pg_cron 'university-refresh-nightly' (19:00 UTC = 02:00 Vientiane),
// change-gated: no relevant kpi_catalog / kpi-DDL movement → logged skip.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { TOKENS } from '../_components/tokens';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface RunRow {
  id: number;
  started_at: string;
  finished_at: string | null;
  trigger_reason: string;
  gate_basis: string | null;
  articles_written: number;
  articles_unchanged: number;
  articles_retired: number;
  ok: boolean;
  error: string | null;
}

async function fetchRuns(): Promise<RunRow[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('v_university_refresh_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(60);
  if (error) {
    console.error('[cockpit/university] fetch error', error);
    return [];
  }
  return (data as RunRow[]) ?? [];
}

function fmt(ts: string | null): string {
  if (!ts) return '—';
  return new Date(ts).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

export default async function UniversityRefreshLogPage() {
  const runs = await fetchRuns();
  const last = runs.find((r) => r.ok && r.gate_basis !== 'no_relevant_changes');
  const lastAny = runs[0];

  const cell: React.CSSProperties = {
    padding: '7px 10px', fontSize: 12.5, color: TOKENS.text, verticalAlign: 'top',
  };

  return (
    <div style={{ maxWidth: 980, color: TOKENS.text }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>University refresh loop</h1>
      <p style={{ margin: '6px 0 0', fontSize: 13.5, lineHeight: 1.6, color: TOKENS.text2 }}>
        Nightly job <code style={{ fontSize: 12 }}>university-refresh-nightly</code> (02:00 Vientiane)
        regenerates KPI reference articles from <code style={{ fontSize: 12 }}>kpi.kpi_catalog</code> —
        change-gated, so quiet nights cost nothing. Manual run:{' '}
        <code style={{ fontSize: 12 }}>SELECT public.fn_university_refresh(&apos;manual&apos;);</code>
      </p>

      <div style={{ display: 'flex', gap: 12, margin: '16px 0' }}>
        <div style={{ background: TOKENS.bgRaised, border: `1px solid ${TOKENS.border}`, borderRadius: 8, padding: '12px 16px' }}>
          <div style={{ fontSize: 11, color: TOKENS.text3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Last content run</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 3 }}>
            {last ? fmt(last.finished_at) : 'never'}
          </div>
          {last && (
            <div style={{ fontSize: 12, color: TOKENS.text2, marginTop: 2 }}>
              {last.articles_written} written · {last.articles_unchanged} unchanged · {last.articles_retired} retired
            </div>
          )}
        </div>
        <div style={{ background: TOKENS.bgRaised, border: `1px solid ${TOKENS.border}`, borderRadius: 8, padding: '12px 16px' }}>
          <div style={{ fontSize: 11, color: TOKENS.text3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Last tick</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 3 }}>
            {lastAny ? fmt(lastAny.started_at) : 'never'}
          </div>
          {lastAny && (
            <div style={{ fontSize: 12, color: TOKENS.text2, marginTop: 2 }}>
              {lastAny.gate_basis === 'no_relevant_changes' ? 'skipped — nothing changed' : lastAny.trigger_reason}
            </div>
          )}
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', background: TOKENS.bgRaised, border: `1px solid ${TOKENS.border}`, borderRadius: 8 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: TOKENS.text2, borderBottom: `1px solid ${TOKENS.border}` }}>
            <th style={{ ...cell, fontWeight: 600 }}>Run</th>
            <th style={{ ...cell, fontWeight: 600 }}>Started</th>
            <th style={{ ...cell, fontWeight: 600 }}>Trigger</th>
            <th style={{ ...cell, fontWeight: 600 }}>Gate</th>
            <th style={{ ...cell, fontWeight: 600 }}>Written</th>
            <th style={{ ...cell, fontWeight: 600 }}>Unchanged</th>
            <th style={{ ...cell, fontWeight: 600 }}>Retired</th>
            <th style={{ ...cell, fontWeight: 600 }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {runs.length === 0 && (
            <tr><td colSpan={8} style={{ ...cell, color: TOKENS.text3, textAlign: 'center', padding: 20 }}>
              No runs yet — the first nightly tick is at 02:00 Vientiane.
            </td></tr>
          )}
          {runs.map((r) => (
            <tr key={r.id} style={{ borderTop: `1px solid ${TOKENS.border}` }}>
              <td style={cell}>#{r.id}</td>
              <td style={cell}>{fmt(r.started_at)}</td>
              <td style={cell}>{r.trigger_reason}</td>
              <td style={{ ...cell, color: r.gate_basis === 'no_relevant_changes' ? TOKENS.text3 : TOKENS.text }}>
                {r.gate_basis ?? '—'}
              </td>
              <td style={cell}>{r.articles_written}</td>
              <td style={cell}>{r.articles_unchanged}</td>
              <td style={cell}>{r.articles_retired}</td>
              <td style={{ ...cell, fontWeight: 600, color: r.ok ? TOKENS.forest : '#B03826' }}>
                {r.ok ? 'ok' : (r.error ? `error: ${r.error.slice(0, 80)}` : 'running…')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
