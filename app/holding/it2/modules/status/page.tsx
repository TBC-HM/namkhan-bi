// app/holding/it2/modules/status/page.tsx
// IT2 native module status page — replaces the cockpit/releases shim.
// Renders v_module_completion_queue + doc-releases ledger with plain HTML
// (no Container/MetricRow client components) to avoid cockpit context deps.
import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { TOKENS, MONO } from '@/app/holding/it/cockpit/_components/tokens';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type QueueRow = {
  module_doc_type: string;
  display_name: string | null;
  priority: number | null;
  status: string | null;
  completion_estimate: number | null;
  brief_slug: string | null;
  entry_url: string | null;
  in_production: boolean | null;
  expected_delivery: string | null;
  open_questions: string | null;
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }
  catch { return iso.slice(0, 10); }
}

function moduleName(r: QueueRow): string {
  if (r.display_name) return r.display_name;
  return r.module_doc_type.replace(/_module$/, '').replace(/_/g, ' ');
}

const th: React.CSSProperties = {
  textAlign: 'left', fontFamily: MONO, fontSize: 10, letterSpacing: 0.8,
  textTransform: 'uppercase', color: TOKENS.text3, padding: '6px 10px',
  borderBottom: `1px solid ${TOKENS.border}`, whiteSpace: 'nowrap',
};
const td: React.CSSProperties = {
  fontSize: 13, color: TOKENS.ink, padding: '8px 10px',
  borderBottom: `1px solid ${TOKENS.border}`, verticalAlign: 'top',
};

export default async function It2ModulesStatusPage() {
  const sb = getSupabaseAdmin();
  const { data, error } = await (sb as any)
    .from('v_module_completion_queue')
    .select('module_doc_type, display_name, priority, status, completion_estimate, brief_slug, entry_url, in_production, expected_delivery, open_questions');

  if (error) console.error('[it2/modules/status] fetch error', error);
  const raw = ((data as QueueRow[]) ?? []).slice();

  raw.sort((a, b) => {
    const aQ = a.open_questions ? 0 : 1;
    const bQ = b.open_questions ? 0 : 1;
    if (aQ !== bQ) return aQ - bQ;
    const aP = a.in_production ? 0 : 1;
    const bP = b.in_production ? 0 : 1;
    if (aP !== bP) return aP - bP;
    const aD = a.expected_delivery ?? '9999-12-31';
    const bD = b.expected_delivery ?? '9999-12-31';
    if (aD !== bD) return aD < bD ? -1 : 1;
    return (a.priority ?? 999) - (b.priority ?? 999);
  });

  const live = raw.filter(r => r.in_production).length;
  const questions = raw.filter(r => r.open_questions).length;

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'In production', value: live, foot: `${raw.length} modules tracked` },
          { label: 'In flight', value: raw.length - live, foot: 'being built' },
          { label: 'Needs PBS', value: questions, foot: 'open questions' },
        ].map(t => (
          <div key={t.label} style={{ background: TOKENS.bgRaised, border: `1px solid ${TOKENS.border}`, borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: TOKENS.text2 }}>{t.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, fontFamily: MONO, margin: '2px 0', color: TOKENS.ink }}>{t.value}</div>
            <div style={{ fontSize: 11, color: TOKENS.text3 }}>{t.foot}</div>
          </div>
        ))}
      </div>

      {/* Module table */}
      <div style={{ background: TOKENS.bgRaised, border: `1px solid ${TOKENS.border}`, borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${TOKENS.border}`, fontSize: 13, fontWeight: 600, color: TOKENS.ink }}>
          Module production table
          <span style={{ fontWeight: 400, color: TOKENS.text3, fontSize: 12, marginLeft: 8 }}>
            live from governance.module_completion_queue · {raw.length} modules · never cached
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={th}>Module</th>
                <th style={th}>Stage</th>
                <th style={th}>Completion</th>
                <th style={th}>Status</th>
                <th style={th}>Delivery</th>
                <th style={th}>Open question</th>
                <th style={th}>Brief</th>
              </tr>
            </thead>
            <tbody>
              {raw.map(r => {
                const urgent = r.open_questions ? (r.open_questions.trimStart().startsWith('BLOCKED') || r.open_questions.trimStart().startsWith('DO')) : false;
                const pct = r.completion_estimate;
                const live = !!r.in_production;
                return (
                  <tr key={r.module_doc_type} style={urgent ? { background: '#FFEBEE66' } : undefined}>
                    <td style={{ ...td, fontWeight: 600, minWidth: 180 }}>
                      {r.entry_url
                        ? <Link href={r.entry_url} style={{ color: TOKENS.forest, textDecoration: 'underline' }}>{moduleName(r)}</Link>
                        : moduleName(r)}
                    </td>
                    <td style={td}>
                      <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 0.6, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap', background: live ? '#E8F5E9' : '#FFF3E0', color: live ? '#2E7D32' : '#B45309', border: `1px solid ${live ? '#2E7D3244' : '#B4530944'}` }}>
                        {live ? 'IN PRODUCTION' : 'IN FLIGHT'}
                      </span>
                    </td>
                    <td style={td}>
                      {pct === null || pct === undefined
                        ? <span style={{ color: TOKENS.text3, fontSize: 12 }}>not audited</span>
                        : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 64, height: 6, borderRadius: 3, background: TOKENS.border, overflow: 'hidden', display: 'inline-block' }}>
                              <span style={{ display: 'block', height: '100%', width: `${Math.min(100, Math.max(0, pct))}%`, background: pct >= 100 ? '#2E7D32' : pct >= 80 ? TOKENS.forest : TOKENS.brass }} />
                            </span>
                            <span style={{ fontFamily: MONO, fontSize: 12, color: TOKENS.ink }}>{pct}%</span>
                          </span>}
                    </td>
                    <td style={{ ...td, fontFamily: MONO, fontSize: 11, color: TOKENS.text2, whiteSpace: 'nowrap' }}>{r.status ?? '—'}</td>
                    <td style={{ ...td, fontFamily: MONO, fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(r.expected_delivery)}</td>
                    <td style={{ ...td, maxWidth: 340, fontSize: 12, color: urgent ? '#B71C1C' : TOKENS.text2 }}>{r.open_questions ?? ''}</td>
                    <td style={td}>
                      {r.brief_slug
                        ? <Link href={`/holding/it2/modules/briefs/${r.brief_slug}`} style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.forest, textDecoration: 'underline', whiteSpace: 'nowrap' }}>brief →</Link>
                        : <span style={{ color: TOKENS.text3, fontSize: 11 }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ fontSize: 12, color: TOKENS.text3 }}>
        Doc-release ledger: <Link href="/holding/it/cockpit/releases" style={{ color: TOKENS.forest }}>view at /holding/it/cockpit/releases →</Link>
      </div>
    </div>
  );
}
