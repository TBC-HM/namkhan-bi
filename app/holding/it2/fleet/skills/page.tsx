// app/holding/it2/fleet/skills/page.tsx
// Skills Registry — all platform capabilities built in cockpit.cap_skills.
// Reads via public.cockpit_skills_catalog (bridge view, PostgREST-safe).
import { DashboardPage } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { GROUPS } from '../_lib/groups';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const WHITE = '#FFFFFF'; const HAIR = '#E6DFCC'; const INK = '#1B1B1B';
const INK_M = '#5A5A5A'; const CREAM = '#F5F0E1'; const FOREST = '#084838';
const AMBER = '#B48A3A'; const RED = '#B03826'; const OK = '#0E7A4B';

const CATEGORY_COLOR: Record<string, string> = {
  platform: '#084838', marketing: '#B48A3A', it: '#1A3A5C',
  hr: '#556B2F', background_check: '#4A1942', legal_analysis: '#8B0000',
  knowledge: '#2D6A4F', guest: '#1F3A5F', operations: '#5A4000',
  marketing_composer: '#B48A3A', sales: '#084838', strategy: '#5A5A5A',
};

const TYPE_LABEL: Record<string, string> = {
  ts_handler: 'API route', sql_function: 'SQL fn', edge_function: 'Edge fn',
};
const TYPE_COLOR: Record<string, string> = {
  ts_handler: '#1A3A5C', sql_function: '#084838', edge_function: '#4A1942',
};

interface Skill {
  id: string; name: string; description: string | null;
  category: string | null; implementation_type: string | null;
  authority_level: string | null; requires_pbs_approval: boolean;
  cost_class: string | null; active: boolean;
}

async function getSkills(): Promise<Skill[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('cockpit_skills_catalog')
    .select('id,name,description,category,implementation_type,authority_level,requires_pbs_approval,cost_class,active')
    .eq('active', true)
    .order('category', { ascending: true })
    .order('name', { ascending: true });
  if (error) { console.error('[skills]', error); return []; }
  return (data ?? []) as Skill[];
}

export default async function SkillsPage() {
  const skills = await getSkills();
  const tabs = GROUPS.map(g => ({ key: g.key, label: g.label, href: g.href, active: false }));

  // Group by category
  const byCategory = new Map<string, Skill[]>();
  for (const s of skills) {
    const cat = s.category ?? 'uncategorized';
    const arr = byCategory.get(cat) ?? [];
    arr.push(s);
    byCategory.set(cat, arr);
  }
  const categories = Array.from(byCategory.keys()).sort();

  const thStyle = { padding: '6px 10px', fontSize: 10, textTransform: 'uppercase' as const,
    letterSpacing: '.06em', color: INK_M, background: CREAM, borderBottom: `1px solid ${HAIR}` };
  const tdStyle = { padding: '6px 10px', borderBottom: `1px solid ${HAIR}`, fontSize: 11, color: INK,
    verticalAlign: 'top' as const };

  return (
    <DashboardPage title="Platform Skills Registry"
      subtitle={`${skills.length} active skills across ${categories.length} categories · cockpit.cap_skills`}
      tabs={tabs}>
      <div style={{ gridColumn: '1 / -1', display: 'grid', gap: 20 }}>

        {/* Summary strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
          {categories.map(cat => {
            const count = byCategory.get(cat)?.length ?? 0;
            const color = CATEGORY_COLOR[cat] || INK_M;
            return (
              <div key={cat} style={{ background: WHITE, border: `1px solid ${HAIR}`,
                borderRadius: 4, padding: '10px 12px', borderLeft: `4px solid ${color}` }}>
                <div style={{ fontSize: 9, fontWeight: 700, color, textTransform: 'uppercase',
                  letterSpacing: '.07em', marginBottom: 2 }}>{cat}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: INK,
                  fontVariantNumeric: 'tabular-nums' }}>{count}</div>
              </div>
            );
          })}
        </div>

        {/* Skills by category */}
        {categories.map(cat => {
          const catSkills = byCategory.get(cat) ?? [];
          const color = CATEGORY_COLOR[cat] || INK_M;
          return (
            <div key={cat} style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ background: color, padding: '8px 14px', display: 'flex',
                justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: WHITE,
                  textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  {cat}
                </div>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,.7)' }}>{catSkills.length} skills</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, textAlign: 'left', width: 220 }}>Name</th>
                      <th style={{ ...thStyle, textAlign: 'left' }}>Description</th>
                      <th style={{ ...thStyle }}>Type</th>
                      <th style={{ ...thStyle }}>Authority</th>
                      <th style={{ ...thStyle }}>Cost</th>
                      <th style={{ ...thStyle }}>PBS approval</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catSkills.map((s, i) => (
                      <tr key={s.id} style={{ background: i % 2 === 0 ? WHITE : '#FAFAF7' }}>
                        <td style={{ ...tdStyle, fontWeight: 600, fontFamily: 'monospace', fontSize: 10,
                          color: FOREST }}>{s.name}</td>
                        <td style={{ ...tdStyle, color: INK_M, maxWidth: 400 }}>
                          {s.description?.slice(0, 120) ?? '—'}
                          {s.description && s.description.length > 120 ? '…' : ''}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 10, fontWeight: 600,
                            background: (TYPE_COLOR[s.implementation_type ?? ''] || INK_M) + '22',
                            color: TYPE_COLOR[s.implementation_type ?? ''] || INK_M }}>
                            {TYPE_LABEL[s.implementation_type ?? ''] ?? s.implementation_type ?? '—'}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, fontSize: 10, color: INK_M }}>{s.authority_level ?? '—'}</td>
                        <td style={{ ...tdStyle, textAlign: 'center', fontSize: 10, color: INK_M }}>
                          {s.cost_class ?? '—'}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          {s.requires_pbs_approval
                            ? <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>YES</span>
                            : <span style={{ fontSize: 10, color: INK_M }}>No</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </DashboardPage>
  );
}
