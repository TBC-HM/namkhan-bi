// app/holding/it2/fleet/skills/page.tsx
// Skills Registry — live metrics: per-version success rate, health status, last refinement.
// Per-version counts reset after each skill edit (updated_at). IT2 layout provides nav.
import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import DiscoverPanel from './_client/DiscoverPanel';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const WHITE = '#FFFFFF'; const HAIR = '#E6DFCC'; const INK = '#1B1B1B';
const INK_M = '#5A5A5A'; const CREAM = '#F5F0E1'; const FOREST = '#084838';
const AMBER = '#B48A3A'; const RED = '#B03826'; const OK = '#0E7A4B';

const SURFACE_COLOR: Record<string, string> = {
  user_facing: '#0E7A4B', agent_internal: '#5A5A5A', backend: '#1A3A5C',
};
const SURFACE_LABEL: Record<string, string> = {
  user_facing: 'User-facing', agent_internal: 'Agent internal', backend: 'Background',
};
const TYPE_LABEL: Record<string, string> = {
  ts_handler: 'API route', sql_function: 'SQL fn', edge_function: 'Edge fn',
};
const HEALTH_COLOR: Record<string, string> = {
  healthy: OK, degraded: AMBER, failing: RED, stale: AMBER, never_run: '#5A5A5A',
};
const HEALTH_LABEL: Record<string, string> = {
  healthy: 'Healthy', degraded: 'Degraded', failing: 'Failing', stale: 'Stale', never_run: 'Never run',
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

type PageProps = { searchParams?: Record<string, string | string[] | undefined> };

async function getSkills(surface?: string, mod?: string, cat?: string, health?: string): Promise<Skill[]> {
  const admin = getSupabaseAdmin();
  let q = admin.from('cockpit_skills_catalog')
    .select('*').eq('active', true)
    .order('serves_module', { ascending: true })
    .order('name', { ascending: true });
  if (surface) q = q.eq('surface', surface);
  if (mod) q = q.eq('serves_module', mod);
  if (cat) q = q.eq('category', cat);
  if (health) q = q.eq('health_status', health);
  const { data, error } = await q;
  if (error) { console.error('[skills]', error); return []; }
  return (data ?? []) as Skill[];
}

export default async function SkillsPage({ searchParams }: PageProps) {
  const sp = searchParams ?? {};
  const surface = typeof sp['surface'] === 'string' ? sp['surface'] : undefined;
  const mod = typeof sp['module'] === 'string' ? sp['module'] : undefined;
  const cat = typeof sp['category'] === 'string' ? sp['category'] : undefined;
  const health = typeof sp['health'] === 'string' ? sp['health'] : undefined;

  const [allSkills, filtered] = await Promise.all([
    getSkills(), getSkills(surface, mod, cat, health),
  ]);

  const failingSkills = allSkills.filter(s => s.health_status === 'failing').map(s => s.name as string);
  const surfaces = Array.from(new Set(allSkills.map(s => s.surface).filter(Boolean))).sort() as string[];
  const modules  = Array.from(new Set(allSkills.map(s => s.serves_module).filter(Boolean))).sort() as string[];
  const cats     = Array.from(new Set(allSkills.map(s => s.category).filter(Boolean))).sort() as string[];
  const healths  = ['failing','degraded','stale','never_run','healthy'];

  const healthCounts: Record<string, number> = {};
  for (const s of allSkills) if (s.health_status) healthCounts[s.health_status] = (healthCounts[s.health_status] ?? 0) + 1;

  const byModule = new Map<string, Skill[]>();
  for (const s of filtered) {
    const m = s.serves_module ?? 'Uncategorized';
    byModule.set(m, [...(byModule.get(m) ?? []), s]);
  }

  function url(params: Record<string, string | undefined>): string {
    const p = new URLSearchParams();
    const base: Record<string, string | undefined> = { surface, module: mod, category: cat, health };
    Object.entries({ ...base, ...params }).forEach(([k, v]) => { if (v) p.set(k, v); });
    const s = p.toString();
    return '/holding/it2/fleet/skills' + (s ? '?' + s : '');
  }

  function fmtDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toISOString().slice(0,10);
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
        {filtered.length} of {allSkills.length} skills · live from cockpit.cap_skills · per-version metrics reset on each refinement
      </p>

      <DiscoverPanel failingSkills={failingSkills} />

      {/* Health summary strip */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' as const }}>
        {healths.filter(h => healthCounts[h] > 0).map(h => {
          const col = HEALTH_COLOR[h] || INK_M;
          return (
            <Link key={h} href={url({ health: h === health ? undefined : h })}
              style={{ fontSize: 11, padding: '5px 12px', borderRadius: 20, textDecoration: 'none',
                background: health === h ? col : CREAM, color: health === h ? WHITE : col,
                border: `1px solid ${col}`, fontWeight: 600 }}>
              {HEALTH_LABEL[h] ?? h} {healthCounts[h]}
            </Link>
          );
        })}
        {health && <Link href={url({ health: undefined })} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 20, textDecoration: 'none', background: CREAM, color: INK_M }}>Clear filter</Link>}
      </div>

      {/* Surface + Module + Category filters */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Surface', items: surfaces, key: 'surface', active: surface, paramKey: 'surface', extra: undefined },
          { label: 'Module', items: modules, key: 'module', active: mod, paramKey: 'module', extra: undefined },
          { label: 'Category', items: cats, key: 'category', active: cat, paramKey: 'category', extra: undefined },
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

      {/* Skills table by module */}
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
                    {['Name','Description','Health','Since refinement','All-time','Last run','Type','Surface','PBS'].map(h => (
                      <th key={h} style={{ padding: '6px 8px', fontSize: 9, textTransform: 'uppercase' as const,
                        letterSpacing: '.06em', color: INK_M, background: CREAM, borderBottom: `1px solid ${HAIR}`,
                        textAlign: 'left' as const, whiteSpace: 'nowrap' as const }}>{h}</th>
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
                            {s.ui_href && (
                              <Link href={s.ui_href} style={{ fontSize: 9, color: AMBER, textDecoration: 'none' }}>→ {s.ui_href}</Link>
                            )}
                          </td>
                          <td style={{ padding: '5px 8px', borderBottom: `1px solid ${HAIR}`, fontSize: 10, color: INK_M, maxWidth: 280, verticalAlign: 'top' as const }}>
                            {s.description ? s.description.slice(0,90) + (s.description.length > 90 ? '…' : '') : '—'}
                          </td>
                          <td style={{ padding: '5px 8px', borderBottom: `1px solid ${HAIR}`, verticalAlign: 'top' as const, textAlign: 'center' as const }}>
                            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 10, fontWeight: 700,
                              background: hCol + '22', color: hCol }}>{HEALTH_LABEL[s.health_status ?? ''] ?? '—'}</span>
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
                          <td style={{ padding: '5px 8px', borderBottom: `1px solid ${HAIR}`, fontSize: 9, color: INK_M, verticalAlign: 'top' as const }}>{TYPE_LABEL[s.implementation_type ?? ''] ?? s.implementation_type ?? '—'}</td>
                          <td style={{ padding: '5px 8px', borderBottom: `1px solid ${HAIR}`, textAlign: 'center' as const, verticalAlign: 'top' as const }}>
                            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 10, background: surfCol + '20', color: surfCol, fontWeight: 700 }}>
                              {SURFACE_LABEL[s.surface ?? ''] ?? '—'}
                            </span>
                          </td>
                          <td style={{ padding: '5px 8px', borderBottom: `1px solid ${HAIR}`, textAlign: 'center' as const, verticalAlign: 'top' as const }}>
                            {s.requires_pbs_approval ? <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>YES</span> : <span style={{ fontSize: 10, color: INK_M }}>—</span>}
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
    </div>
  );
}
