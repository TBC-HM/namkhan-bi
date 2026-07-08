// app/operations/qa/registry/page.tsx
// PBS 2026-07-08: QA area · Registry tab. Full SOP register in a table.
// Dept, title, purpose (short_summary), status, updated_at. Server component.
// No filtering — search lives on the Overview tab. Property-scoped:
// shared corp catalog UNION own-tenant rows. Tenant delegate mirrors this.

import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { supabase, PROPERTY_ID } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props { propertyId?: number }

interface SopRow {
  sop_code: string;
  title: string;
  dept_code: string;
  short_summary: string | null;
  status: string;
  version: string | null;
  updated_at: string | null;
  property_id: number | null;
}

const WHITE = '#FFFFFF';
const HAIR  = '#E6DFCC';
const INK   = '#1B1B1B';
const INK_S = '#5A5A5A';
const PRIMARY = '#084838';

function qaTabs(pid: number, active: 'overview' | 'registry' | 'generate' | 'proposals'): DashboardTab[] {
  const base = pid === PROPERTY_ID ? '' : `/h/${pid}`;
  return [
    { key: `${base}/operations/qa`,           label: 'Overview',  href: `${base}/operations/qa`,           active: active === 'overview'  },
    { key: `${base}/operations/qa/registry`,  label: 'Registry',  href: `${base}/operations/qa/registry`,  active: active === 'registry'  },
    { key: `${base}/operations/qa/generate`,  label: 'Generate',  href: `${base}/operations/qa/generate`,  active: active === 'generate'  },
    { key: `${base}/operations/qa/proposals`, label: 'Proposals', href: `${base}/operations/qa/proposals`, active: active === 'proposals' },
  ];
}

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

export default async function QaRegistryPage({ propertyId }: Props = {}) {
  const pid = propertyId ?? PROPERTY_ID;

  const { data } = await supabase
    .from('v_sop_catalog')
    .select('sop_code,title,dept_code,short_summary,status,version,updated_at,property_id')
    .or(`property_id.is.null,property_id.eq.${pid}`)
    .order('dept_code', { ascending: true })
    .order('title',     { ascending: true });

  const rows: SopRow[] = (data as SopRow[]) ?? [];
  const distinctDepts = new Set(rows.map((r) => r.dept_code)).size;

  const tabs = qaTabs(pid, 'registry');

  const th: React.CSSProperties = {
    padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600,
    letterSpacing: '0.06em', textTransform: 'uppercase',
    color: INK_S, borderBottom: '1px solid ' + HAIR, background: WHITE,
    whiteSpace: 'nowrap',
  };
  const td: React.CSSProperties = {
    padding: '8px 12px', fontSize: 12, color: INK,
    borderBottom: '1px solid ' + HAIR, verticalAlign: 'top',
  };

  return (
    <div style={{ background: WHITE, minHeight: '100vh' }}>
      <DashboardPage
        title="Operations · QA · Registry"
        subtitle={`Full SOP register · ${rows.length} SOPs across ${distinctDepts} departments · shared corp catalog + own-property.`}
        tabs={tabs}
      >
        <div style={{ gridColumn: '1 / -1' }}>
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
              No SOPs in the register for this property yet. Use the Generate tab to draft one, or Proposals to see AI-suggested SOPs.
            </div>
          ) : (
            <div style={{
              background: WHITE,
              border: '1px solid ' + HAIR,
              borderRadius: 4,
              overflowX: 'auto',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: 130 }} />
                  <col />
                  <col />
                  <col style={{ width: 90 }} />
                  <col style={{ width: 70 }} />
                  <col style={{ width: 110 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={th}>Dept</th>
                    <th style={th}>Title</th>
                    <th style={th}>Purpose</th>
                    <th style={th}>Status</th>
                    <th style={th}>Version</th>
                    <th style={{ ...th, textAlign: 'right' }}>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.sop_code}>
                      <td style={td}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 6px',
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
                      </td>
                      <td style={td}>
                        <div style={{ fontWeight: 600, color: INK }}>{r.title}</div>
                        <div style={{ fontSize: 10, color: INK_S, marginTop: 2, letterSpacing: '0.04em' }}>
                          {r.sop_code}
                        </div>
                      </td>
                      <td style={{ ...td, color: INK_S }}>
                        {r.short_summary ?? '—'}
                      </td>
                      <td style={td}>{r.status}</td>
                      <td style={td}>{r.version ?? '—'}</td>
                      <td style={{ ...td, textAlign: 'right', color: INK_S, whiteSpace: 'nowrap' }}>
                        {fmtDate(r.updated_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DashboardPage>
    </div>
  );
}
