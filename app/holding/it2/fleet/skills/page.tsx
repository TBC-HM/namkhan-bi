// app/holding/it2/fleet/skills/page.tsx
// Skills Registry — fully dynamic from cockpit.cap_skills via public bridge view.
// Filters: surface (user_facing/agent_internal/backend) + module + category.
// All filters via URL search params — server-side, no client component needed.
import { DashboardPage } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import Link from 'next/link';
import { GROUPS } from '../../_lib/groups';

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
const CATEGORY_COLOR: Record<string, string> = {
  platform: '#084838', marketing: '#B48A3A', it: '#1A3A5C',
  hr: '#556B2F', background_check: '#4A1942', legal_analysis: '#8B0000',
  knowledge: '#2D6A4F', guest: '#1F3A5F', operations: '#5A4000',
  marketing_composer: '#B48A3A', sales: '#084838', strategy: '#5A5A5A',
};
const TYPE_LABEL: Record<string, string> = {
  ts_handler: 'API route', sql_function: 'SQL fn', edge_function: 'Edge fn',
};

interface Skill {
  id: string; name: string; description: string | null;
  category: string | null; implementation_type: string | null;
  authority_level: string | null; requires_pbs_approval: boolean;
  cost_class: string | null; active: boolean;
  surface: string | null; serves_module: string | null;
}

async function getSkills(surface?: string, module?: string, category?: string): Promise<Skill[]> {
  const admin = getSupabaseAdmin();
  let q = admin.from('cockpit_skills_catalog')
    .select('id,name,description,category,implementation_type,authority_level,requires_pbs_approval,cost_class,active,surface,serves_module')
    .eq('active', true)
    .order('serves_module', { ascending: true })
    .order('name', { ascending: true });
  if (surface) q = q.eq('surface', surface);
  if (module)  q = q.eq('serves_module', module);
  if (category) q = q.eq('category', category);
  const { data, error } = await q;
  if (error) { console.error('[skills]', error); return []; }
  return (data ?? []) as Skill[];
}

interface Props { searchParams: { surface?: string; module?: string; category?: string } }

export default async function SkillsPage({ searchParams }: Props) {
  const { surface, module: mod, category } = searchParams;
  const [allSkills, filtered] = await Promise.all([
    getSkills(),  // for counts + filter chips
    getSkills(surface, mod, category), // filtered display
  ]);

  const tabs = GROUPS.map(g => ({ key: g.key, label: g.label, href: g.href, active: false }));

  // Compute filter options from full dataset
  const surfaces = Array.from(new Set(allSkills.map(s => s.surface).filter(Boolean))) as string[];
  const modules = Array.from(new Set(allSkills.map(s => s.serves_module).filter(Boolean))).sort() as string[];
  const categories = Array.from(new Set(allSkills.map(s => s.category).filter(Boolean))).sort() as string[];

  // Group filtered results by module
  const byModule = new Map<string, Skill[]>();
  for (const s of filtered) {
    const m = s.serves_module ?? 'Uncategorized';
    byModule.set(m, [...(byModule.get(m) ?? []), s]);
  }
  const moduleList = Array.from(byModule.keys()).sort();

  // Surface counts
  const surfaceCounts = { user_facing: 0, agent_internal: 0, backend: 0 };
  for (const s of allSkills) if (s.surface) (surfaceCounts as any)[s.surface]++;

  function buildUrl(params: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    const merged = { surface, module: mod, category, ...params };
    Object.entries(merged).forEach(([k, v]) => { if (v) p.set(k, v); });
    const str = p.toString();
    return '/holding/it2/fleet/skills' + (str ? '?' + str : '');
  }

  const chipBase = { fontSize: 11, padding: '4px 12px', borderRadius: 20, cursor: 'pointer',
    textDecoration: 'none', fontWeight: 500, display: 'inline-block' };
  const thStyle = { padding: '6px 10px', fontSize: 10, textTransform: 'uppercase' as const,
    letterSpacing: '.06em', color: INK_M, background: CREAM, borderBottom: `1px solid ${HAIR}` };
  const tdStyle = { padding: '6px 10px', borderBottom: `1px solid ${HAIR}`, fontSize: 11,
    color: INK, verticalAlign: 'top' as const };

  const isFiltered = !!(surface || mod || category);

  return (
    <DashboardPage title="Platform Skills Registry"
      subtitle={`${filtered.length} of ${allSkills.length} skills · cockpit.cap_skills · auto-updates when new skills ship`}
      tabs={tabs}>
      <div style={{ gridColumn: '1 / -1', display: 'grid', gap: 16 }}>

        {/* Surface filter — top priority */}
        <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, padding: '12px 16px' }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', color: INK_M, marginBottom: 10, fontWeight: 600 }}>Filter by surface</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <Link href={buildUrl({ surface: undefined, module: undefined, category: undefined })}
              style={{ ...chipBase, background: !isFiltered ? INK : CREAM, color: !isFiltered ? WHITE : INK_M }}>
              All ({allSkills.length})
            </Link>
            {Object.entries(surfaceCounts).map(([s, count]) => (
              <Link key={s} href={buildUrl({ surface: s, module: undefined })}
                style={{ ...chipBase,
                  background: surface === s ? SURFACE_COLOR[s] : CREAM,
                  color: surface === s ? WHITE : SURFACE_COLOR[s] || INK_M,
                  border: `1px solid ${SURFACE_COLOR[s] || HAIR}` }}>
                {SURFACE_LABEL[s]} ({count})
              </Link>
            ))}
          </div>
          <div style={{ fontSize: 10, color: INK_M, lineHeight: 1.6 }}>
            <strong style={{ color: OK }}>User-facing</strong>: skill output is shown to PBS or hotel staff ·
            <strong style={{ color: '#5A5A5A' }}> Agent internal</strong>: agents gather data or context, not shown to users ·
            <strong style={{ color: '#1A3A5C' }}> Background</strong>: runs automatically, fully invisible
          </div>
        </div>

        {/* Module + Category filters */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, padding: '12px 16px' }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', color: INK_M, marginBottom: 8, fontWeight: 600 }}>Module</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {modules.map(m => (
                <Link key={m} href={buildUrl({ module: m === mod ? undefined : m })}
                  style={{ ...chipBase, fontSize: 10, padding: '3px 9px',
                    background: mod === m ? FOREST : CREAM,
                    color: mod === m ? WHITE : INK_M }}>{m}</Link>
              ))}
            </div>
          </div>
          <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, padding: '12px 16px' }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', color: INK_M, marginBottom: 8, fontWeight: 600 }}>Category</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {categories.map(c => {
                const col = CATEGORY_COLOR[c] || INK_M;
                return (
                  <Link key={c} href={buildUrl({ category: c === category ? undefined : c })}
                    style={{ ...chipBase, fontSize: 10, padding: '3px 9px',
                      background: category === c ? col : CREAM,
                      color: category === c ? WHITE : col }}>{c}</Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Skills table grouped by module */}
        {filtered.length === 0 ? (
          <div style={{ padding: 24, background: CREAM, borderRadius: 4, fontSize: 13, color: INK_M, textAlign: 'center' }}>
            No skills match this filter.
          </div>
        ) : (
          moduleList.map(moduleName => {
            const moduleSkills = byModule.get(moduleName) ?? [];
            return (
              <div key={moduleName} style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ background: FOREST, padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: WHITE }}>{moduleName}</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,.7)' }}>{moduleSkills.length} skills</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ ...thStyle, textAlign: 'left', width: 200 }}>Name</th>
                        <th style={{ ...thStyle, textAlign: 'left' }}>Description</th>
                        <th style={{ ...thStyle }}>Surface</th>
                        <th style={{ ...thStyle }}>Type</th>
                        <th style={{ ...thStyle }}>Authority</th>
                        <th style={{ ...thStyle }}>Cost</th>
                        <th style={{ ...thStyle }}>PBS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {moduleSkills.map((s, i) => {
                        const surfColor = SURFACE_COLOR[s.surface ?? ''] || INK_M;
                        return (
                          <tr key={s.id} style={{ background: i % 2 === 0 ? WHITE : '#FAFAF7' }}>
                            <td style={{ ...tdStyle, fontWeight: 600, fontFamily: 'monospace', fontSize: 10, color: FOREST }}>{s.name}</td>
                            <td style={{ ...tdStyle, color: INK_M, maxWidth: 340 }}>
                              {s.description?.slice(0, 100) ?? '—'}{s.description && s.description.length > 100 ? '…' : ''}
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                              <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 10, fontWeight: 700,
                                background: surfColor + '20', color: surfColor, whiteSpace: 'nowrap' }}>
                                {SURFACE_LABEL[s.surface ?? ''] ?? '—'}
                              </span>
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'center', fontSize: 9, color: INK_M }}>{TYPE_LABEL[s.implementation_type ?? ''] ?? s.implementation_type ?? '—'}</td>
                            <td style={{ ...tdStyle, fontSize: 10, color: INK_M, whiteSpace: 'nowrap' }}>{s.authority_level?.replace(/_/g,' ') ?? '—'}</td>
                            <td style={{ ...tdStyle, textAlign: 'center', fontSize: 10, color: INK_M }}>{s.cost_class ?? '—'}</td>
                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                              {s.requires_pbs_approval
                                ? <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>YES</span>
                                : <span style={{ fontSize: 10, color: INK_M }}>—</span>}
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
    </DashboardPage>
  );
}
