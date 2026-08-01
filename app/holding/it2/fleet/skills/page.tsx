// app/holding/it2/fleet/skills/page.tsx
// Skills Registry — all platform capabilities from cockpit.cap_skills.
// Filters via URL search params (server-side). IT2 layout provides nav chrome.
import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const WHITE = '#FFFFFF'; const HAIR = '#E6DFCC'; const INK = '#1B1B1B';
const INK_M = '#5A5A5A'; const CREAM = '#F5F0E1'; const FOREST = '#084838';
const AMBER = '#B48A3A'; const RED = '#B03826';

const SURFACE_COLOR: Record<string, string> = {
  user_facing: '#0E7A4B', agent_internal: '#5A5A5A', backend: '#1A3A5C',
};
const SURFACE_LABEL: Record<string, string> = {
  user_facing: 'User-facing', agent_internal: 'Agent internal', backend: 'Background',
};
const TYPE_LABEL: Record<string, string> = {
  ts_handler: 'API route', sql_function: 'SQL fn', edge_function: 'Edge fn',
};

interface Skill {
  id: string; name: string; description: string | null;
  category: string | null; implementation_type: string | null;
  authority_level: string | null; requires_pbs_approval: boolean;
  cost_class: string | null; surface: string | null; serves_module: string | null;
}

type PageProps = { searchParams?: Record<string, string | string[] | undefined> };

async function getSkills(surface?: string, mod?: string, cat?: string): Promise<Skill[]> {
  const admin = getSupabaseAdmin();
  let q = admin.from('cockpit_skills_catalog')
    .select('id,name,description,category,implementation_type,authority_level,requires_pbs_approval,cost_class,surface,serves_module')
    .eq('active', true)
    .order('serves_module', { ascending: true })
    .order('name', { ascending: true });
  if (surface) q = q.eq('surface', surface);
  if (mod) q = q.eq('serves_module', mod);
  if (cat) q = q.eq('category', cat);
  const { data, error } = await q;
  if (error) { console.error('[skills]', error); return []; }
  return (data ?? []) as Skill[];
}

export default async function SkillsPage({ searchParams }: PageProps) {
  const sp = searchParams ?? {};
  const surface = typeof sp['surface'] === 'string' ? sp['surface'] : undefined;
  const mod = typeof sp['module'] === 'string' ? sp['module'] : undefined;
  const cat = typeof sp['category'] === 'string' ? sp['category'] : undefined;

  const [allSkills, filtered] = await Promise.all([
    getSkills(), getSkills(surface, mod, cat),
  ]);

  const surfaces = Array.from(new Set(allSkills.map(s => s.surface).filter(Boolean))) as string[];
  const modules  = Array.from(new Set(allSkills.map(s => s.serves_module).filter(Boolean))).sort() as string[];
  const cats     = Array.from(new Set(allSkills.map(s => s.category).filter(Boolean))).sort() as string[];

  const byModule = new Map<string, Skill[]>();
  for (const s of filtered) {
    const m = s.serves_module ?? 'Uncategorized';
    byModule.set(m, [...(byModule.get(m) ?? []), s]);
  }

  const surfaceCounts: Record<string, number> = {};
  for (const s of allSkills) if (s.surface) surfaceCounts[s.surface] = (surfaceCounts[s.surface] ?? 0) + 1;

  function url(params: Record<string, string | undefined>): string {
    const p = new URLSearchParams();
    const base: Record<string, string | undefined> = { surface, module: mod, category: cat };
    Object.entries({ ...base, ...params }).forEach(([k, v]) => { if (v) p.set(k, v); });
    const s = p.toString();
    return '/holding/it2/fleet/skills' + (s ? '?' + s : '');
  }

  const isFiltered = !!(surface || mod || cat);

  return (
    <div style={{ padding: '16px 24px', background: WHITE, minHeight: '100vh' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: INK, marginBottom: 4 }}>Platform Skills Registry</h1>
      <p style={{ fontSize: 12, color: INK_M, marginBottom: 20 }}>
        {filtered.length} of {allSkills.length} skills · cockpit.cap_skills · auto-updates when new skills ship
      </p>

      {/* Surface filter */}
      <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, padding: '12px 16px', marginBottom: 12 }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '.08em', color: INK_M, marginBottom: 10, fontWeight: 600 }}>Filter by surface</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: 8 }}>
          <Link href={url({ surface: undefined, module: undefined, category: undefined })}
            style={{ fontSize: 11, padding: '4px 12px', borderRadius: 20, textDecoration: 'none', fontWeight: 500,
              background: !isFiltered ? INK : CREAM, color: !isFiltered ? WHITE : INK_M }}>
            All ({allSkills.length})
          </Link>
          {surfaces.map(s => (
            <Link key={s} href={url({ surface: s === surface ? undefined : s, module: undefined })}
              style={{ fontSize: 11, padding: '4px 12px', borderRadius: 20, textDecoration: 'none', fontWeight: 500,
                background: surface === s ? (SURFACE_COLOR[s] || INK_M) : CREAM,
                color: surface === s ? WHITE : (SURFACE_COLOR[s] || INK_M) }}>
              {SURFACE_LABEL[s] ?? s} ({surfaceCounts[s] ?? 0})
            </Link>
          ))}
        </div>
        <div style={{ fontSize: 10, color: INK_M }}>
          <strong style={{ color: '#0E7A4B' }}>User-facing</strong>: shown to PBS or hotel staff ·
          <strong style={{ color: '#5A5A5A' }}> Agent internal</strong>: agents gather context, invisible ·
          <strong style={{ color: '#1A3A5C' }}> Background</strong>: automatic, fully invisible
        </div>
      </div>

      {/* Module + Category filters */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, padding: '10px 14px' }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '.08em', color: INK_M, marginBottom: 8, fontWeight: 600 }}>Module</div>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
            {modules.map(m => (
              <Link key={m} href={url({ module: m === mod ? undefined : m })}
                style={{ fontSize: 10, padding: '3px 9px', borderRadius: 20, textDecoration: 'none', fontWeight: 500,
                  background: mod === m ? FOREST : CREAM, color: mod === m ? WHITE : INK_M }}>
                {m}
              </Link>
            ))}
          </div>
        </div>
        <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, padding: '10px 14px' }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '.08em', color: INK_M, marginBottom: 8, fontWeight: 600 }}>Category</div>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
            {cats.map(c => (
              <Link key={c} href={url({ category: c === cat ? undefined : c })}
                style={{ fontSize: 10, padding: '3px 9px', borderRadius: 20, textDecoration: 'none', fontWeight: 500,
                  background: cat === c ? '#084838' : CREAM, color: cat === c ? WHITE : INK_M }}>
                {c}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Skills by module */}
      {filtered.length === 0 ? (
        <div style={{ padding: 24, background: CREAM, borderRadius: 4, textAlign: 'center' as const, fontSize: 13, color: INK_M }}>No skills match.</div>
      ) : (
        Array.from(byModule.keys()).sort().map(moduleName => {
          const mSkills = byModule.get(moduleName) ?? [];
          return (
            <div key={moduleName} style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, overflow: 'hidden', marginBottom: 14 }}>
              <div style={{ background: FOREST, padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: WHITE }}>{moduleName}</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,.7)' }}>{mSkills.length}</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                  <thead><tr>
                    {['Name','Description','Surface','Type','Authority','Cost','PBS'].map(h => (
                      <th key={h} style={{ padding: '6px 10px', fontSize: 10, textTransform: 'uppercase' as const,
                        letterSpacing: '.06em', color: INK_M, background: CREAM, borderBottom: `1px solid ${HAIR}`,
                        textAlign: 'left' as const }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {mSkills.map((s, i) => {
                      const surfColor = SURFACE_COLOR[s.surface ?? ''] || INK_M;
                      return (
                        <tr key={s.id} style={{ background: i % 2 === 0 ? WHITE : '#FAFAF7' }}>
                          <td style={{ padding: '6px 10px', borderBottom: `1px solid ${HAIR}`, fontSize: 10, fontWeight: 600, fontFamily: 'monospace', color: FOREST, verticalAlign: 'top' as const }}>{s.name}</td>
                          <td style={{ padding: '6px 10px', borderBottom: `1px solid ${HAIR}`, fontSize: 11, color: INK_M, maxWidth: 340, verticalAlign: 'top' as const }}>
                            {s.description ? s.description.slice(0,100) + (s.description.length > 100 ? '…' : '') : '—'}
                          </td>
                          <td style={{ padding: '6px 10px', borderBottom: `1px solid ${HAIR}`, textAlign: 'center' as const, verticalAlign: 'top' as const }}>
                            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 10, fontWeight: 700, whiteSpace: 'nowrap' as const,
                              background: surfColor + '20', color: surfColor }}>
                              {SURFACE_LABEL[s.surface ?? ''] ?? '—'}
                            </span>
                          </td>
                          <td style={{ padding: '6px 10px', borderBottom: `1px solid ${HAIR}`, fontSize: 9, color: INK_M, verticalAlign: 'top' as const }}>{TYPE_LABEL[s.implementation_type ?? ''] ?? s.implementation_type ?? '—'}</td>
                          <td style={{ padding: '6px 10px', borderBottom: `1px solid ${HAIR}`, fontSize: 10, color: INK_M, verticalAlign: 'top' as const }}>{s.authority_level?.replace(/_/g,' ') ?? '—'}</td>
                          <td style={{ padding: '6px 10px', borderBottom: `1px solid ${HAIR}`, fontSize: 10, color: INK_M, verticalAlign: 'top' as const }}>{s.cost_class ?? '—'}</td>
                          <td style={{ padding: '6px 10px', borderBottom: `1px solid ${HAIR}`, textAlign: 'center' as const, verticalAlign: 'top' as const }}>
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
