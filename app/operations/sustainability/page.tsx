// app/operations/sustainability/page.tsx
// PBS 2026-07-06: dedicated sustainability page — Travelife + SLH Considerate
// + greenhouse goals + toolkits. Reuses DocContainer + DocPreviewModal primitives.
import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';
import { DashboardPage, KpiTile, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import DocsUploadButtons from '@/app/_components/DocsUploadButtons';
import SustainabilityClient from './_components/SustainabilityClient';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface Row {
  doc_id: string; title: string; doc_type: string; doc_subtype: string | null;
  file_name: string | null; storage_bucket: string | null; storage_path: string | null;
  mime: string | null; file_size_bytes: number | null; updated_at: string | null;
}

const HAIR='#E6DFCC'; const INK='#1B1B1B'; const INK_M='#5A5A5A'; const CREAM='#F7F0E1'; const GREEN='#084838'; const MOSS='#2D6A4F';

// Static sustainability KPIs (Phase 1 — will wire to real reporting later)
const KPIS = [
  { label: 'Travelife status',   value: 'Certified',    footnote: 'Undated Gold', status: 'green' as const },
  { label: 'SLH Considerate',    value: 'Member',        footnote: 'since 2022' },
  { label: 'Greenhouse goal',    value: '−40%',          footnote: 'by 2030 vs 2019' },
  { label: 'Single-use plastic', value: 'Phased out',    footnote: 'in-room + F&B', status: 'green' as const },
];

export default async function SustainabilityPage() {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from('v_sustainability_docs')
    .select('*')
    .eq('property_id', PROPERTY_ID)
    .order('updated_at', { ascending: false });
  const rows: Row[] = (data as Row[]) ?? [];

  const withUrl = rows.map(r => ({
    ...r,
    _url: r.storage_bucket && r.storage_path
      ? `https://kpenyneooigsyuuomgct.supabase.co/storage/v1/object/public/${r.storage_bucket}/${r.storage_path}`
      : '',
  }));

  const travelife  = withUrl.filter(r => (r.title ?? '').toLowerCase().includes('travelife') || r.doc_subtype === 'certification_requirements');
  const slhConsid  = withUrl.filter(r => (r.title ?? '').toLowerCase().match(/considerate|slh|stay small/i));
  const ghg        = withUrl.filter(r => r.doc_subtype === 'sustainability_goals' || (r.title ?? '').toLowerCase().match(/greenhouse|co2|carbon|emission/i));
  const toolkits   = withUrl.filter(r => r.doc_subtype === 'sustainability_toolkit');
  const covered = new Set([...travelife, ...slhConsid, ...ghg, ...toolkits].map(r => r.doc_id));
  const other = withUrl.filter(r => !covered.has(r.doc_id));

  // Get ops tabs from cfg
  const tabs: DashboardTab[] = [
    { key: '/operations', label: 'HoD', href: '/operations', active: false },
    { key: '/operations/sustainability', label: 'Sustainability', href: '/operations/sustainability', active: true },
  ];

  return (
    <div className="guest-paper-scope" style={{ background:'#FFFFFF', minHeight:'100vh' }}>
      <style>{`
        .guest-paper-scope, .guest-paper-scope * {
          --card:#FFFFFF; --border:#E6DFCC; --paper:#FFFFFF; --paper-warm:#FFFFFF;
          --paper-deep:#F5F0E1; --hairline:#E6DFCC; --ink:#1B1B1B; --ink-soft:#3A3A3A;
          --ink-mute:#5A5A5A; --ink-faint:#8A8A8A; --brass:#1F3A2E; --primary:#1F3A2E;
          --surf:#FFFFFF; --surf-1:#FFFFFF; --surf-2:#FAFAF7; --surf-3:#F5F0E1;
          --border-2:#E6DFCC; --border-3:#C8C0A6; --text-0:#1B1B1B; --text-1:#1B1B1B;
          --text-2:#3A3A3A; --text-3:#5A5A5A; --text-dim:#5A5A5A; --text-place:#8A8A8A;
          --accent:#1F3A2E; --accent-2:#C79A6B; --bg:#FFFFFF; --bg-1:#FFFFFF; --bg-2:#FAFAF7;
        }
      `}</style>
      <DashboardPage title="Operations · Sustainability" subtitle={`Travelife · SLH Considerate · greenhouse goals · toolkits — ${rows.length} docs`} tabs={tabs}>
        <div style={{ gridColumn:'1 / -1', display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <div style={{ fontSize:11, color:INK_M }}>Certifications, toolkits, goal papers, single-use policy — everything you send to Travelife auditors, SLH network + your team.</div>
          <DocsUploadButtons />
        </div>

        {/* Travelife panel (primitive) */}
        <div style={{ gridColumn:'1 / -1' }}>
          <div style={{ background:CREAM, border:'1px solid '+HAIR, borderLeft:'3px solid '+MOSS, borderRadius:6, padding:'14px 18px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10 }}>
              <div>
                <div style={{ fontSize:14, fontWeight:600, color:INK }}>Travelife · Undated Gold</div>
                <div style={{ fontSize:12, color:INK_M, marginTop:2 }}>Global sustainability certification for tour operators + hotels — assessed on 200+ criteria (environment · labour · animal welfare · community).</div>
              </div>
              <div style={{ padding:'4px 12px', fontSize:10, fontWeight:700, letterSpacing:'0.10em', textTransform:'uppercase', color:MOSS, border:'1px solid '+MOSS, background:'#FFFFFF', borderRadius:3 }}>Certified</div>
            </div>
          </div>
        </div>

        {/* KPI strip */}
        <div style={{ gridColumn:'1 / -1', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:8 }}>
          {KPIS.map((k, i) => <KpiTile key={i} label={k.label} value={k.value} size="sm" footnote={k.footnote} status={k.status} />)}
        </div>

        {/* Doc containers (client, collapsible + preview modal) */}
        <div style={{ gridColumn:'1 / -1' }}>
          <SustainabilityClient
            sections={[
              { key: 'travelife',  label: 'Travelife certification',          desc: 'Requirements · audits · undated gold', docs: travelife },
              { key: 'slh',        label: 'SLH Considerate Collection',       desc: 'Stay Small Stay Considerate toolkits + brand assets', docs: slhConsid },
              { key: 'ghg',        label: 'Greenhouse & carbon goals',        desc: 'Emission reduction goals + KPIs', docs: ghg },
              { key: 'toolkits',   label: 'Sustainability toolkits',          desc: 'Single-use plastic · local sourcing · water · waste', docs: toolkits },
              { key: 'other',      label: 'Other sustainability docs',        desc: 'Anything sustainability-tagged not in the specific buckets above', docs: other },
            ]}
          />
        </div>
      </DashboardPage>
    </div>
  );
}
