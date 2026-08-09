// app/holding/it2/fleet/skills/page.tsx
// Skills Registry — per-version success rate, health status, last refinement + Research subtab
import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import DiscoverPanel from './_client/DiscoverPanel';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const WHITE = '#FFFFFF'; const HAIR = '#E6DFCC'; const INK = '#1B1B1B';
const INK_M = '#5A5A5A'; const CREAM = '#F5F0E1'; const FOREST = '#084838';
const AMBER = '#B48A3A'; const RED = '#B03826'; const OK = '#0E7A4B';
const NAVY = '#1A3A5C';

const SURFACE_COLOR: Record<string, string> = { user_facing: '#0E7A4B', agent_internal: '#5A5A5A', backend: '#1A3A5C' };
const SURFACE_LABEL: Record<string, string> = { user_facing: 'User-facing', agent_internal: 'Agent internal', backend: 'Background' };
const TYPE_LABEL: Record<string, string> = { ts_handler: 'API route', sql_function: 'SQL fn', edge_function: 'Edge fn' };
const HEALTH_COLOR: Record<string, string> = { healthy: OK, degraded: AMBER, failing: RED, stale: AMBER, never_run: '#5A5A5A' };
const HEALTH_LABEL: Record<string, string> = { healthy: 'Healthy', degraded: 'Degraded', failing: 'Failing', stale: 'Stale', never_run: 'Never run' };
const HEALTH_HINT: Record<string, string> = {
  failing: 'All-time success rate below 40%. Route may not exist or DB function is missing.',
  degraded: 'Success rate 40-70%. Route exists but encounters errors intermittently.',
  stale: 'No calls in 30+ days.',
  never_run: 'Registered but never called.',
  healthy: 'Success rate ≥70%.',
};

interface Skill {
  id: string; name: string; description: string | null;
  category: string | null; implementation_type: string | null;
  authority_level: string | null; requires_pbs_approval: boolean;
  cost_class: string | null; surface: string | null; serves_module: string | null;
  ui_href: string | null; uses_llm: boolean;
  last_refined_at: string | null;
  success_since_edit: number; fail_since_edit: number; total_since_edit: number;
  success_all_time: number; total_all_time: number;
  last_run_at: string | null; avg_duration_sec: number | null;
  health_status: string | null;
}

interface ResearchEntry {
  id: number; content: string; topics: string[]; importance: number; created_at: string;
}

type PageProps = { searchParams?: Record<string, string | string[] | undefined> };

async function getSkills(surface?: string, mod?: string, cat?: string, health?: string): Promise<Skill[]> {
  const admin = getSupabaseAdmin();
  let q = admin.from('cockpit_skills_catalog').select('*').eq('active', true)
    .order('serves_module', { ascending: true }).order('name', { ascending: true });
  if (surface) q = q.eq('surface', surface);
  if (mod) q = q.eq('serves_module', mod);
  if (cat) q = q.eq('category', cat);
  if (health) q = q.eq('health_status', health);
  const { data, error } = await q;
  if (error) { console.error('[skills]', error); return []; }
  return (data ?? []) as Skill[];
}

async function getResearch(): Promise<ResearchEntry[]> {
  const admin = getSupabaseAdmin();
  const { data } = await admin.from('cockpit_agent_memory')
    .select('id, content, topics, importance, created_at')
    .ilike('content', 'RESEARCH PROPOSAL%')
    .eq('agent_handle', 'all')
    .order('created_at', { ascending: false })
    .limit(100);
  return (data ?? []) as ResearchEntry[];
}

function parseProposal(content: string): { display_name: string; slug: string; framework: string; type: string; roi: string; effort: string; score: string; value: string; proposal: string; scorer: string; query: string; found_via: string; source: string } {
  const lines = content.split('\n');
  const get = (prefix: string) => { const l = lines.find(x => x.startsWith(prefix)); return l ? l.slice(prefix.length).trim() : ''; };
  const section = (label: string) => { const l = lines.find(x => x.startsWith(label + ':')); return l ? l.slice(label.length + 1).trim() : ''; };
  const title = lines[0].replace('RESEARCH PROPOSAL (not yet built): ', '').trim();
  const slugLine = get('slug: ');
  const slug = slugLine.split(' | ')[0].trim();
  const fw = slugLine.includes('framework:') ? slugLine.split('framework:')[1].split('|')[0].trim() : '';
  const type = slugLine.includes('type:') ? slugLine.split('type:')[1].trim() : 'NEW';
  const roiLine = get('roi: ');
  const roi = roiLine.split('|')[0].trim();
  const effort = roiLine.includes('effort:') ? roiLine.split('effort:')[1].split('|')[0].trim() : '';
  const score = roiLine.includes('score:') ? roiLine.split('score:')[1].trim() : '';
  const fvLine = get('found_via: ');
  const found_via = fvLine.split('|')[0].trim();
  const source = fvLine.includes('source:') ? fvLine.split('source:')[1].trim() : '';
  const queryLine = get('query: ');
  const query = queryLine.split('|')[0].trim();
  return { display_name: title, slug, framework: fw, type, roi, effort, score, value: section('VALUE'), proposal: section('BUILDS'), scorer: section('SCORER'), query, found_via, source };
}

export default async function SkillsPage({ searchParams }: PageProps) {
  const sp = searchParams ?? {};
  const tab = typeof sp['tab'] === 'string' ? sp['tab'] : undefined;
  const surface = typeof sp['surface'] === 'string' ? sp['surface'] : undefined;
  const mod = typeof sp['module'] === 'string' ? sp['module'] : undefined;
  const cat = typeof sp['category'] === 'string' ? sp['category'] : undefined;
  const health = typeof sp['health'] === 'string' ? sp['health'] : undefined;

  const isResearch = tab === 'research';

  const [allSkills, filtered, research] = await Promise.all([
    getSkills(),
    isResearch ? Promise.resolve([]) : getSkills(surface, mod, cat, health),
    isResearch ? getResearch() : Promise.resolve([]),
  ]);

  const failingSkills = allSkills.filter(s => s.health_status === 'failing').map(s => s.name as string);
  const surfaces = Array.from(new Set(allSkills.map(s => s.surface).filter(Boolean))).sort() as string[];
  const modules = Array.from(new Set(allSkills.map(s => s.serves_module).filter(Boolean))).sort() as string[];
  const cats = Array.from(new Set(allSkills.map(s => s.category).filter(Boolean))).sort() as string[];
  const healths = ['failing','degraded','stale','never_run','healthy'];
  const healthCounts: Record<string, number> = {};
  for (const s of allSkills) if (s.health_status) healthCounts[s.health_status] = (healthCounts[s.health_status] ?? 0) + 1;

  const byModule = new Map<string, Skill[]>();
  for (const s of filtered) { const m = s.serves_module ?? 'Uncategorized'; byModule.set(m, [...(byModule.get(m) ?? []), s]); }

  function url(params: Record<string, string | undefined>): string {
    const p = new URLSearchParams();
    const base: Record<string, string | undefined> = { surface, module: mod, category: cat, health, tab };
    Object.entries({ ...base, ...params }).forEach(([k, v]) => { if (v) p.set(k, v); });
    const s = p.toString();
    return '/holding/it2/fleet/skills' + (s ? '?' + s : '');
  }

  function fmtDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toISOString().slice(0, 10);
  }

  function SuccessBar({ ok, total }: { ok: number; total: number }) {
    if (total === 0) return <span style={{ fontSize: 9, color: INK_M }}>no runs</span>;
    const pct = Math.round((ok / total) * 100);
    const col = pct >= 80 ? OK : pct >= 50 ? AMBER : RED;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <div style={{ width: 40, height: 4, background: CREAM, borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: col, borderRadius: 2 }} />
        </div>
        <span style={{ fontSize: 9, color: col, fontWeight: 700 }}>{pct}%</span>
        <span style={{ fontSize: 9, color: INK_M }}>{ok}/{total}</span>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px 24px', background: WHITE, minHeight: '100vh' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: INK, marginBottom: 4 }}>Platform Skills Registry</h1>
      <p style={{ fontSize: 12, color: INK_M, marginBottom: 16 }}>
        {allSkills.length} skills · live from cockpit.cap_skills · per-version metrics reset on each refinement
      </p>

      <DiscoverPanel failingSkills={failingSkills} />

      {/* Tab nav: health chips + Research tab */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' as const, alignItems: 'center' }}>
        {healths.filter(h => healthCounts[h] > 0).map(h => {
          const col = HEALTH_COLOR[h] || INK_M;
          const isActive = !isResearch && health === h;
          return (
            <Link key={h} href={url({ health: isActive ? undefined : h, tab: undefined })}
              title={HEALTH_HINT[h]}
              style={{ fontSize: 11, padding: '5px 12px', borderRadius: 20, textDecoration: 'none',
                background: isActive ? col : CREAM, color: isActive ? WHITE : col,
                border: `1px solid ${col}`, fontWeight: 600 }}>
              {HEALTH_LABEL[h] ?? h} {healthCounts[h]}
            </Link>
          );
        })}
        {!isResearch && health && (
          <Link href={url({ health: undefined })} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 20, textDecoration: 'none', background: CREAM, color: INK_M }}>
            Clear filter
          </Link>
        )}
        {/* Research tab */}
        <Link href={url({ tab: isResearch ? undefined : 'research', health: undefined, surface: undefined, module: undefined, category: undefined })}
          style={{ fontSize: 11, padding: '5px 14px', borderRadius: 20, textDecoration: 'none', marginLeft: 8,
            background: isResearch ? NAVY : CREAM, color: isResearch ? WHITE : NAVY,
            border: `1px solid ${NAVY}`, fontWeight: 700 }}>
          📚 Research {research.length > 0 ? `(${research.length})` : ''}
        </Link>
        {/* Grant posture — contextual link (nav law: /fleet/grants reachable from Skills; allowlisted in check-it2-orphans) */}
        <Link href="/holding/it2/fleet/grants"
          style={{ fontSize: 11, padding: '5px 14px', borderRadius: 20, textDecoration: 'none',
            background: CREAM, color: FOREST, border: `1px solid ${FOREST}`, fontWeight: 700 }}>
          🔐 Grants
        </Link>
      </div>

      {/* RESEARCH VIEW */}
      {isResearch && (
        <div>
          <p style={{ fontSize: 12, color: INK_M, marginBottom: 16 }}>
            {research.length} proposals saved from discovery runs · memory_type=pattern · agent_handle=all · accessible to future Claude sessions
          </p>
          {research.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center' as const, color: INK_M, fontSize: 13 }}>
              No research saved yet. Run Discovery above to populate this tab.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
              {research.map(entry => {
                const p = parseProposal(entry.content);
                const scoreNum = parseFloat(p.score);
                const scorCol = scoreNum >= 8 ? OK : scoreNum >= 7 ? AMBER : INK_M;
                const roiCol = p.roi === 'High' ? OK : p.roi === 'Medium' ? AMBER : INK_M;
                return (
                  <div key={entry.id} style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, padding: 14 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' as const, alignItems: 'center' }}>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: OK+'22', color: OK, fontWeight: 700 }}>{p.type}</span>
                      {p.framework && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: NAVY+'18', color: NAVY, fontWeight: 600 }}>{p.framework}</span>}
                      {p.roi && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: roiCol+'22', color: roiCol, fontWeight: 600 }}>{p.roi} ROI</span>}
                      {p.effort && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: CREAM, color: INK_M }}>{p.effort}</span>}
                      {p.score && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: scorCol+'20', color: scorCol, fontWeight: 700 }}>★ {p.score}</span>}
                      <span style={{ fontSize: 9, color: INK_M, marginLeft: 'auto' }}>{fmtDate(entry.created_at)}</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: INK, marginBottom: 2 }}>{p.display_name}</div>
                    <div style={{ fontSize: 11, fontFamily: 'monospace', color: INK_M, marginBottom: 8 }}>{p.slug}</div>
                    {p.value && (
                      <div style={{ fontSize: 12, color: INK, fontWeight: 600, marginBottom: 6, padding: '6px 10px', background: OK+'10', borderRadius: 4, borderLeft: `3px solid ${OK}` }}>
                        {p.value}
                      </div>
                    )}
                    {p.proposal && <div style={{ fontSize: 11, color: INK_M, lineHeight: 1.7, marginBottom: 6 }}>{p.proposal}</div>}
                    {p.scorer && (
                      <div style={{ fontSize: 10, color: INK_M, fontStyle: 'italic', marginBottom: 8, padding: '6px 10px', background: CREAM, borderRadius: 4 }}>
                        Scorer: {p.scorer.slice(0, 200)}{p.scorer.length > 200 ? '…' : ''}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const, fontSize: 10, color: INK_M }}>
                      {p.query && <span>🔍 Query: <b>{p.query}</b></span>}
                      {p.found_via && <span>via: {p.found_via.split(':')[0]}</span>}
                      {p.source && p.source.includes('/') && (
                        <a href={'https://github.com/' + p.source} target="_blank" rel="noopener noreferrer"
                          style={{ color: NAVY, textDecoration: 'none', fontWeight: 600 }}>⌥ {p.source}</a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SKILLS TABLE VIEW */}
      {!isResearch && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Surface', items: surfaces, active: surface, paramKey: 'surface' },
              { label: 'Module', items: modules, active: mod, paramKey: 'module' },
              { label: 'Category', items: cats, active: cat, paramKey: 'category' },
            ].map(f => (
              <div key={f.label} style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '.08em', color: INK_M, marginBottom: 8, fontWeight: 600 }}>{f.label}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 5 }}>
                  {f.items.map(item => {
                    const isActive = f.active === item;
                    const col = SURFACE_COLOR[item] || FOREST;
                    return (
                      <Link key={item} href={url({ [f.paramKey]: isActive ? undefined : item })}
                        style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, textDecoration: 'none',
                          background: isActive ? col : CREAM, color: isActive ? WHITE : INK_M, fontWeight: isActive ? 600 : 400 }}>
                        {SURFACE_LABEL[item] ?? item}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: 24, background: CREAM, borderRadius: 4, textAlign: 'center' as const, color: INK_M }}>No skills match.</div>
          ) : (
            Array.from(byModule.keys()).sort().map(moduleName => {
              const mSkills = byModule.get(moduleName) ?? [];
              return (
                <div key={moduleName} style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, overflow: 'hidden', marginBottom: 14 }}>
                  <div style={{ background: FOREST, padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: WHITE }}>{moduleName}</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,.7)' }}>{mSkills.length} skills</span>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                      <thead><tr>
                        {['Name','Description','Health','Since refinement','All-time','Last run','Type','Edit'].map(h => (
                          <th key={h} style={{ padding: '6px 8px', fontSize: 9, textTransform: 'uppercase' as const, letterSpacing: '.06em', color: INK_M, background: CREAM, borderBottom: `1px solid ${HAIR}`, textAlign: 'left' as const, whiteSpace: 'nowrap' as const }}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {mSkills.map((s, i) => {
                          const hCol = HEALTH_COLOR[s.health_status ?? ''] || INK_M;
                          const surfCol = SURFACE_COLOR[s.surface ?? ''] || INK_M;
                          return (
                            <tr key={s.id} style={{ background: i % 2 === 0 ? WHITE : '#FAFAF7' }}>
                              <td style={{ padding: '5px 8px', borderBottom: `1px solid ${HAIR}`, verticalAlign: 'top' as const }}>
                                <div style={{ fontSize: 10, fontWeight: 700, fontFamily: 'monospace', color: FOREST }}>{s.name}</div>
                                {s.surface && <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 8, background: surfCol+'20', color: surfCol }}>{SURFACE_LABEL[s.surface] ?? s.surface}</span>}
                                {s.ui_href && <Link href={s.ui_href} style={{ fontSize: 9, color: AMBER, textDecoration: 'none', display: 'block' }}>→ {s.ui_href}</Link>}
                              </td>
                              <td style={{ padding: '5px 8px', borderBottom: `1px solid ${HAIR}`, fontSize: 10, color: INK_M, maxWidth: 260, verticalAlign: 'top' as const }}>
                                {s.description ? s.description.slice(0, 80) + (s.description.length > 80 ? '…' : '') : '—'}
                              </td>
                              <td style={{ padding: '5px 8px', borderBottom: `1px solid ${HAIR}`, verticalAlign: 'top' as const, textAlign: 'center' as const }}>
                                <span title={HEALTH_HINT[s.health_status ?? ''] ?? ''}
                                  style={{ fontSize: 9, padding: '2px 6px', borderRadius: 10, fontWeight: 700, background: hCol+'22', color: hCol, cursor: 'help' }}>
                                  {HEALTH_LABEL[s.health_status ?? ''] ?? '—'}
                                </span>
                                {s.health_status === 'failing' && (
                                  <div style={{ fontSize: 8, color: RED, marginTop: 2, maxWidth: 80 }}>
                                    {s.total_all_time === 0 ? 'never run' : s.success_all_time + '/' + s.total_all_time + ' lifetime'}
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: '5px 8px', borderBottom: `1px solid ${HAIR}`, verticalAlign: 'top' as const }}>
                                <div style={{ fontSize: 9, color: INK_M, marginBottom: 3 }}>Refined: {fmtDate(s.last_refined_at)}</div>
                                {SuccessBar({ ok: s.success_since_edit, total: s.total_since_edit })}
                              </td>
                              <td style={{ padding: '5px 8px', borderBottom: `1px solid ${HAIR}`, verticalAlign: 'top' as const }}>
                                {SuccessBar({ ok: s.success_all_time, total: s.total_all_time })}
                              </td>
                              <td style={{ padding: '5px 8px', borderBottom: `1px solid ${HAIR}`, fontSize: 9, color: INK_M, verticalAlign: 'top' as const, whiteSpace: 'nowrap' as const }}>
                                {s.last_run_at ? fmtDate(s.last_run_at) : 'never'}
                                {s.avg_duration_sec ? <div>{s.avg_duration_sec}s avg</div> : null}
                              </td>
                              <td style={{ padding: '5px 8px', borderBottom: `1px solid ${HAIR}`, fontSize: 9, color: INK_M, verticalAlign: 'top' as const }}>
                                {TYPE_LABEL[s.implementation_type ?? ''] ?? s.implementation_type ?? '—'}
                              </td>
                              <td style={{ padding: '5px 8px', borderBottom: `1px solid ${HAIR}`, verticalAlign: 'top' as const }}>
                                <Link href={'/holding/it2/fleet/skills/' + s.id + '/edit'}
                                  style={{ fontSize: 9, padding: '2px 7px', border: `1px solid ${HAIR}`, borderRadius: 3, textDecoration: 'none', color: INK_M, background: WHITE }}>
                                  ✏ Edit
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          )}
        </>
      )}
    </div>
  );
}
