// app/holding/it2/fleet/skills/page.tsx
// Skills Registry — version tracking, call history, health status
import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const WHITE = '#FFFFFF'; const HAIR = '#E6DFCC'; const INK = '#1B1B1B';
const INK_M = '#5A5A5A'; const CREAM = '#F5F0E1'; const FOREST = '#084838';
const AMBER = '#B48A3A'; const RED = '#B03826'; const OK = '#0E7A4B';

interface Skill {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  authority_level: number | null;
  requires_pbs_approval: boolean;
  active: boolean;
  version: number;
  updated_at: string;
  created_at: string;
  calls_total: number;
  last_called_at: string | null;
}

type PageProps = { searchParams?: Record<string, string | string[] | undefined> };

async function getSkills(category?: string, active?: boolean): Promise<Skill[]> {
  const admin = getSupabaseAdmin();
  let q = admin.from('v_cap_skills_registry').select('*');
  if (active !== undefined) q = q.eq('active', active);
  if (category) q = q.eq('category', category);
  q = q.order('name', { ascending: true });
  
  const { data, error } = await q;
  if (error) { 
    console.error('[skills registry]', error); 
    return []; 
  }
  return (data ?? []) as Skill[];
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  const date = new Date(d);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

function getHealthStatus(skill: Skill): { status: string; color: string; label: string } {
  if (skill.calls_total === 0) {
    return { status: 'never_run', color: INK_M, label: 'Never run' };
  }
  
  const daysSinceCall = skill.last_called_at 
    ? Math.floor((new Date().getTime() - new Date(skill.last_called_at).getTime()) / (1000 * 60 * 60 * 24))
    : 999;
  
  if (daysSinceCall > 30) {
    return { status: 'stale', color: AMBER, label: 'Stale (30+ days)' };
  }
  
  return { status: 'active', color: OK, label: 'Active' };
}

export default async function SkillsPage({ searchParams }: PageProps) {
  const sp = searchParams ?? {};
  const category = typeof sp['category'] === 'string' ? sp['category'] : undefined;
  const showInactive = sp['show_inactive'] === 'true';
  
  const allSkills = await getSkills();
  const filtered = await getSkills(category, showInactive ? undefined : true);
  
  const categories = Array.from(new Set(allSkills.map(s => s.category).filter(Boolean))).sort() as string[];
  const totalActive = allSkills.filter(s => s.active).length;
  const totalCalls = allSkills.reduce((sum, s) => sum + s.calls_total, 0);
  const neverRun = allSkills.filter(s => s.calls_total === 0).length;
  const stale = allSkills.filter(s => {
    if (!s.last_called_at) return false;
    const days = Math.floor((new Date().getTime() - new Date(s.last_called_at).getTime()) / (1000 * 60 * 60 * 24));
    return days > 30;
  }).length;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: CREAM }}>
      {/* Header */}
      <div style={{ backgroundColor: WHITE, borderBottom: `1px solid ${HAIR}`, padding: '1.5rem 2rem' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 600, color: INK }}>
              Skills Registry
            </h1>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <Link 
                href="/holding/it2/fleet/team"
                style={{ 
                  padding: '0.5rem 1rem', 
                  backgroundColor: WHITE, 
                  color: INK, 
                  border: `1px solid ${HAIR}`,
                  borderRadius: '4px',
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                ← Agents
              </Link>
            </div>
          </div>
          
          {/* Stats bar */}
          <div style={{ display: 'flex', gap: '2rem', fontSize: '0.875rem', color: INK_M }}>
            <div>
              <strong style={{ color: INK }}>{totalActive}</strong> active skills
            </div>
            <div>
              <strong style={{ color: INK }}>{totalCalls.toLocaleString()}</strong> total calls
            </div>
            <div>
              <strong style={{ color: AMBER }}>{neverRun}</strong> never run
            </div>
            <div>
              <strong style={{ color: AMBER }}>{stale}</strong> stale (30+ days)
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ backgroundColor: WHITE, borderBottom: `1px solid ${HAIR}`, padding: '1rem 2rem' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.875rem', color: INK_M, fontWeight: 500 }}>Filter:</span>
          
          <Link
            href="/holding/it2/fleet/skills"
            style={{
              padding: '0.375rem 0.75rem',
              backgroundColor: !category ? FOREST : 'transparent',
              color: !category ? WHITE : INK,
              border: `1px solid ${!category ? FOREST : HAIR}`,
              borderRadius: '4px',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            All
          </Link>
          
          {categories.map(cat => (
            <Link
              key={cat}
              href={`/holding/it2/fleet/skills?category=${cat}${showInactive ? '&show_inactive=true' : ''}`}
              style={{
                padding: '0.375rem 0.75rem',
                backgroundColor: category === cat ? FOREST : 'transparent',
                color: category === cat ? WHITE : INK,
                border: `1px solid ${category === cat ? FOREST : HAIR}`,
                borderRadius: '4px',
                textDecoration: 'none',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              {cat}
            </Link>
          ))}
          
          <div style={{ marginLeft: 'auto' }}>
            <Link
              href={`/holding/it2/fleet/skills${category ? `?category=${category}` : ''}${showInactive ? '' : (category ? '&' : '?') + 'show_inactive=true'}`}
              style={{
                padding: '0.375rem 0.75rem',
                backgroundColor: showInactive ? FOREST : 'transparent',
                color: showInactive ? WHITE : INK,
                border: `1px solid ${showInactive ? FOREST : HAIR}`,
                borderRadius: '4px',
                textDecoration: 'none',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              {showInactive ? 'Hide' : 'Show'} inactive
            </Link>
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ backgroundColor: WHITE, borderRadius: '8px', border: `1px solid ${HAIR}`, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: CREAM, borderBottom: `1px solid ${HAIR}` }}>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: INK_M, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Name
                </th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: INK_M, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Category
                </th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: INK_M, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Version
                </th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 600, color: INK_M, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Calls
                </th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: INK_M, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Last called
                </th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: INK_M, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Updated
                </th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: INK_M, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Health
                </th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: INK_M, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Auth
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((skill, idx) => {
                const health = getHealthStatus(skill);
                return (
                  <tr 
                    key={skill.id}
                    style={{ 
                      borderBottom: idx < filtered.length - 1 ? `1px solid ${HAIR}` : 'none',
                      opacity: skill.active ? 1 : 0.5,
                    }}
                  >
                    <td style={{ padding: '1rem', fontSize: '0.875rem' }}>
                      <Link 
                        href={`/holding/it2/fleet/skills/${skill.id}`}
                        style={{ 
                          color: FOREST, 
                          textDecoration: 'none', 
                          fontWeight: 500,
                          fontFamily: 'monospace',
                        }}
                      >
                        {skill.name}
                      </Link>
                      {skill.description && (
                        <div style={{ fontSize: '0.75rem', color: INK_M, marginTop: '0.25rem' }}>
                          {skill.description}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '1rem', fontSize: '0.875rem', color: INK }}>
                      {skill.category || '—'}
                    </td>
                    <td style={{ padding: '1rem', fontSize: '0.875rem', color: INK }}>
                      <span style={{ 
                        fontFamily: 'monospace',
                        backgroundColor: CREAM,
                        padding: '0.125rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                      }}>
                        v{skill.version}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', fontSize: '0.875rem', color: INK, textAlign: 'right', fontFamily: 'monospace' }}>
                      {skill.calls_total.toLocaleString()}
                    </td>
                    <td style={{ padding: '1rem', fontSize: '0.875rem', color: INK_M }}>
                      {formatDate(skill.last_called_at)}
                    </td>
                    <td style={{ padding: '1rem', fontSize: '0.875rem', color: INK_M }}>
                      {formatDate(skill.updated_at)}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '0.25rem 0.625rem',
                        backgroundColor: health.color + '15',
                        color: health.color,
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                      }}>
                        {health.label}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      {skill.requires_pbs_approval && (
                        <span style={{
                          display: 'inline-block',
                          padding: '0.25rem 0.5rem',
                          backgroundColor: AMBER + '15',
                          color: AMBER,
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                        }}>
                          PBS
                        </span>
                      )}
                      {skill.authority_level && skill.authority_level > 1 && (
                        <span style={{
                          display: 'inline-block',
                          padding: '0.25rem 0.5rem',
                          backgroundColor: RED + '15',
                          color: RED,
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          marginLeft: '0.25rem',
                        }}>
                          L{skill.authority_level}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {filtered.length === 0 && (
            <div style={{ padding: '3rem', textAlign: 'center', color: INK_M }}>
              No skills found.
            </div>
          )}
        </div>
        
        <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: INK_M }}>
          Showing {filtered.length} skill{filtered.length !== 1 ? 's' : ''} 
          {category && ` in category "${category}"`}
          {!showInactive && ' (active only)'}
        </div>
      </div>
    </div>
  );
}
