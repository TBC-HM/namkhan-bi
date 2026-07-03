// app/operations/sops/page.tsx
// PBS 2026-07-03: SOP catalog — 56 real SOPs from public.v_sop_catalog,
// grouped by department, with KPI strip + audience + version + summary.

import { DashboardPage, KpiTile, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import { supabase } from '@/lib/supabase';
import { DEPT_CFG } from '@/lib/dept-cfg';

interface SopRow {
  sop_code: string; title: string; dept_code: string;
  primary_audience: string | null; short_summary: string | null;
  language: string; status: string; version: string;
  visual_required: boolean;
  kb_links_count: number | null; legal_links_count: number | null; susty_links_count: number | null;
  created_at: string; updated_at: string;
}

function normDept(code: string): string {
  const cu = code.toUpperCase().replace(/^OPS_/, '').replace(/^COMM_/, '');
  const map: Record<string,string> = {
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

export const dynamic = 'force-dynamic';
export const revalidate = 60;

const WHITE='#FFFFFF'; const HAIR='#E6DFCC'; const INK='#1B1B1B';
const INK_S='#3A3A3A'; const INK_M='#5A5A5A'; const CREAM='#F5F0E1';

export default async function OperationsSopsPage() {
  const { data } = await supabase.from('v_sop_catalog').select('*').order('sop_code');
  const sops: SopRow[] = (data as SopRow[]) ?? [];

  const byDept = new Map<string, SopRow[]>();
  for (const s of sops) {
    const key = normDept(s.dept_code);
    if (!byDept.has(key)) byDept.set(key, []);
    byDept.get(key)!.push(s);
  }
  const deptGroups = Array.from(byDept.entries()).sort((a, b) => b[1].length - a[1].length);

  const cfg = DEPT_CFG.operations;
  const tabs: DashboardTab[] = cfg.subPages.map((s: any) => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/operations/sops',
  }));

  const tiles: KpiTileProps[] = [
    { label: 'Total SOPs',   value: sops.length, size: 'sm' },
    { label: 'Active',       value: sops.filter(s => s.status === 'active').length, size: 'sm' },
    { label: 'With visuals', value: sops.filter(s => s.visual_required).length, size: 'sm' },
    { label: 'KB-linked',    value: sops.filter(s => (s.kb_links_count ?? 0) > 0).length, size: 'sm' },
    { label: 'Departments',  value: deptGroups.length, size: 'sm' },
  ];

  return (
    <div style={{ background: WHITE, minHeight: '100vh' }}>
      <DashboardPage
        title="Operations · SOPs"
        subtitle={`${sops.length} Standard Operating Procedures across ${deptGroups.length} departments.`}
        tabs={tabs}
      >
        <div style={{ gridColumn:'1 / -1', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:8 }}>
          {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>

        <div style={{ gridColumn:'1 / -1', display:'flex', flexWrap:'wrap', gap:6 }}>
          {deptGroups.map(([dept, list]) => (
            <a key={dept} href={`#${dept}`} style={{
              padding:'6px 12px', background:CREAM, color:INK_S,
              border:'1px solid '+HAIR, borderRadius:99, fontSize:11, textDecoration:'none', fontWeight:500,
            }}>{dept} · {list.length}</a>
          ))}
        </div>

        {deptGroups.map(([dept, list]) => (
          <div key={dept} id={dept} style={{ gridColumn:'1 / -1' }}>
            <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:INK_M, margin:'12px 2px 8px' }}>
              {dept} · {list.length} SOP{list.length === 1 ? '' : 's'}
            </div>
            <div style={{ background:WHITE, border:'1px solid '+HAIR, borderRadius:6, overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr>
                    <th style={th}>Code</th>
                    <th style={th}>Title</th>
                    <th style={th}>Audience</th>
                    <th style={th}>Summary</th>
                    <th style={{...th, textAlign:'right', width:70 }}>Ver.</th>
                    <th style={{...th, textAlign:'right', width:80 }}>Links</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map(s => (
                    <tr key={s.sop_code} style={{ borderBottom:'1px solid '+CREAM }}>
                      <td style={{ padding:'8px 12px', color:INK, fontFamily:'ui-monospace, SFMono-Regular, monospace', fontSize:11 }}>{s.sop_code}</td>
                      <td style={{ padding:'8px 12px', color:INK, fontWeight:600 }}>{s.title}</td>
                      <td style={{ padding:'8px 12px', color:INK_M, fontSize:11 }}>{s.primary_audience ?? '—'}</td>
                      <td style={{ padding:'8px 12px', color:INK_S, fontSize:11, lineHeight:1.4, maxWidth:400 }}>{s.short_summary}</td>
                      <td style={{ padding:'8px 12px', textAlign:'right', color:INK_M, fontFamily:'ui-monospace, SFMono-Regular, monospace', fontSize:11 }}>{s.version}</td>
                      <td style={{ padding:'8px 12px', textAlign:'right', color:INK_M, fontSize:10 }}>
                        {(s.kb_links_count ?? 0) > 0 && <span title="Knowledge base links">KB·{s.kb_links_count}</span>}
                        {(s.legal_links_count ?? 0) > 0 && <span title="Legal links" style={{ marginLeft:6 }}>Legal·{s.legal_links_count}</span>}
                        {(s.susty_links_count ?? 0) > 0 && <span title="Sustainability links" style={{ marginLeft:6 }}>Susty·{s.susty_links_count}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </DashboardPage>
    </div>
  );
}

const th: React.CSSProperties = { padding:'8px 12px', textAlign:'left', fontSize:10, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:'#3A3A3A', borderBottom:'1px solid #E6DFCC' };
