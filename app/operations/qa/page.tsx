// app/operations/qa/page.tsx
// PBS 2026-07-08: QA area landing — Overview tab. Server component. Provides a
// GET-style text search (?q=) across public.v_sop_catalog (knowledge.sop_content
// bridge view). Matches on title / dept_code / body_md / short_summary.
// Works without JS: <form method="get">.
//
// Property-scope: shared corp catalog (property_id IS NULL) UNION own-tenant
// rows. Fallback = Namkhan (PROPERTY_ID) for the naked /operations path.
// Tenant delegate at /h/[property_id]/operations/qa mirrors this file.
//
// 2026-07-21 (fix): dropped local qaTabs() — it was replacing the canonical
// Operations top strip with a duplicate of the QA sub-strip. NAV_SUBGROUPS
// (lib/nav-subgroups.ts, parentHref='/operations/sops') already renders the
// SOPs · QA registry · Proposals · Generate · Agent instructions row below,
// so we now feed DashboardPage the canonical 5-item Operations strip.
// Matches the fix already applied to /operations/qa/{registry,proposals,
// generate,agent-instructions} on the same date.

import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import { OPERATIONS_SUBPAGES } from '../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props {
  propertyId?: number;
  searchParams?: { q?: string };
}

interface SopRow {
  sop_code: string;
  title: string;
  dept_code: string;
  short_summary: string | null;
  status: string;
  updated_at: string | null;
  property_id: number | null;
}

const WHITE = '#FFFFFF';
const HAIR  = '#E6DFCC';
const INK   = '#1B1B1B';
const INK_S = '#5A5A5A';
const PRIMARY = '#084838';

function normDept(code: string): string {
  const cu = code.toUpperCase().replace(/^OPS_/, '').replace(/^COMM_/, '');
  const map: Record<string, string> = {
    HOUSEKEEPING: 'Housekeeping',
    F_AND_B: 'F&B', FB: 'F&B',
    FRONT_OFFICE: 'Front Office',
    ENGINEERING: 'Engineering',
    GOVERNANCE: 'Governance',
    PROCUREMENT: 'Procurement',
    HR: 'HR', SPA: 'Spa',
    MARKETING: 'Marketing', REVENUE: 'Revenue', SALES: 'Sales',
    FINANCE: 'Finance', IT: 'IT',
  };
  return map[cu] ?? code;
}

function fmtDate(s: string | null): string {
  if (!s) return '—';
  try {
    return new Date(s).toISOString().slice(0, 10);
  } catch {
    return '—';
  }
}

export default async function QaOverviewPage({ propertyId, searchParams }: Props = {}) {
  const pid = propertyId ?? PROPERTY_ID;
  const q = (searchParams?.q ?? '').trim();

  // Read shared (property_id IS NULL) UNION own-tenant rows from the SOP
  // catalog bridge view. Post-filter for search server-side (row counts are
  // low; scanning ~60 rows is faster than three PostgREST `ilike` calls).
  const { data } = await supabase
    .from('v_sop_catalog')
    .select('sop_code,title,dept_code,short_summary,status,updated_at,property_id')
    .or(`property_id.is.null,property_id.eq.${pid}`)
    .order('updated_at', { ascending: false, nullsFirst: false });

  const all: SopRow[] = (data as SopRow[]) ?? [];
  const scanCount = all.length;

  const rows: SopRow[] = q
    ? all.filter((r) => {
        const hay = [
          r.title ?? '',
          r.dept_code ?? '',
          r.short_summary ?? '',
          r.sop_code ?? '',
        ].join(' ').toLowerCase();
        return hay.includes(q.toLowerCase());
      })
    : all;

  const tabs: DashboardTab[] = OPERATIONS_SUBPAGES.map((s) => ({
    key: s.href,
    label: s.label,
    href: s.href,
    active: s.href === '/operations/sops', // QA parent
  }));

  return (
    <div style={{ background: WHITE, minHeight: '100vh' }}>
      <DashboardPage
        title="Operations · QA · Overview"
        subtitle={`Search the SOP catalog by title, department, summary, or code. ${scanCount} SOPs in scope for this property.`}
        tabs={tabs}
      >
        <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Search form — plain GET, works without JS. */}
          <form method="get" style={{
            display: 'flex', gap: 8, alignItems: 'center',
            padding: 12,
            background: WHITE,
            border: '1px solid ' + HAIR,
            borderRadius: 4,
          }}>
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Search SOPs by title, dept, summary…"
              aria-label="Search SOPs"
              style={{
                flex: 1,
                padding: '8px 10px',
                fontSize: 13,
                fontFamily: 'inherit',
                color: INK,
                background: WHITE,
                border: '1px solid ' + HAIR,
                borderRadius: 4,
                outline: 'none',
              }}
            />
            <button
              type="submit"
              style={{
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: 'inherit',
                color: WHITE,
                background: PRIMARY,
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              Search
            </button>
            {q && (
              <a
                href="?"
                style={{
                  padding: '8px 12px',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  color: INK_S,
                  background: WHITE,
                  border: '1px solid ' + HAIR,
                  borderRadius: 4,
                  textDecoration: 'none',
                }}
              >
                Clear
              </a>
            )}
          </form>

          {/* Result count */}
          <div style={{ fontSize: 12, color: INK_S, padding: '0 4px' }}>
            {q ? (
              <>Showing <b style={{ color: INK }}>{rows.length}</b> of {scanCount} SOPs matching "{q}"</>
            ) : (
              <>Showing all <b style={{ color: INK }}>{scanCount}</b> SOPs · type in the box to search</>
            )}
          </div>

          {/* Result list */}
          {rows.length === 0 ? (
            <div style={{
              padding: 24,
              textAlign: 'center',
              background: WHITE,
              border: '1px solid ' + HAIR,
              borderRadius: 4,
              color: INK_S,
              fontSize: 13,
            }}>
              No SOPs match this search. Try a different term, or check the Registry tab for the full list.
            </div>
          ) : (
            <div style={{
              background: WHITE,
              border: '1px solid ' + HAIR,
              borderRadius: 4,
              overflow: 'hidden',
            }}>
              {rows.map((r, i) => (
                <div key={r.sop_code} style={{
                  display: 'grid',
                  gridTemplateColumns: '110px 1fr 100px',
                  gap: 12,
                  padding: '10px 14px',
                  borderBottom: i < rows.length - 1 ? '1px solid ' + HAIR : 'none',
                  alignItems: 'center',
                }}>
                  <div>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      color: PRIMARY,
                      background: '#F0F5F2',
                      border: '1px solid ' + HAIR,
                      borderRadius: 3,
                    }}>
                      {normDept(r.dept_code)}
                    </span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: INK, marginBottom: 2 }}>
                      {r.title}
                    </div>
                    {r.short_summary && (
                      <div style={{
                        fontSize: 12,
                        color: INK_S,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {r.short_summary}
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: INK_S, marginTop: 2, letterSpacing: '0.04em' }}>
                      {r.sop_code} · status: {r.status}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: INK_S, textAlign: 'right' }}>
                    {fmtDate(r.updated_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DashboardPage>
    </div>
  );
}
