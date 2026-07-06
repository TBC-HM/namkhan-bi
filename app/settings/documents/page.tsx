// app/settings/documents/page.tsx
// PBS 2026-07-06: full document registry — every dms.documents row with an
// inline reassignment dropdown so you can move a doc to the right Gold container
// (which drives what shows up on /marketing/docs, /operations/sustainability, etc.).
import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';
import { DashboardPage, KpiTile, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import DocsUploadButtons from '@/app/_components/DocsUploadButtons';
import RegistryClient from './_components/RegistryClient';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

interface Row {
  doc_id: string; property_id: number | null; title: string;
  doc_type: string; doc_subtype: string | null;
  file_name: string | null; storage_bucket: string | null; storage_path: string | null;
  mime: string | null; file_size_bytes: number | null;
  created_at: string; updated_at: string;
  project: string | null; author: string | null; summary: string | null;
  public_url: string | null;
}

const HAIR='#E6DFCC'; const INK='#1B1B1B'; const INK_M='#5A5A5A'; const GREEN='#084838';

export default async function DocRegistryPage() {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from('v_documents_registry')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(5000);
  const rows: Row[] = (data as Row[]) ?? [];

  const byType = new Map<string, number>();
  for (const r of rows) byType.set(r.doc_type, (byType.get(r.doc_type) ?? 0) + 1);
  const withProperty = rows.filter(r => r.property_id !== null).length;

  const tiles: KpiTileProps[] = [
    { label: 'Total docs',        value: rows.length,   size: 'sm' },
    { label: 'With property_id',  value: withProperty,  size: 'sm' },
    { label: 'Unique doc_types',  value: byType.size,   size: 'sm' },
    { label: 'Marketing',         value: byType.get('marketing') ?? 0,  size: 'sm' },
    { label: 'Partner',           value: byType.get('partner') ?? 0,    size: 'sm' },
    { label: 'HR docs',           value: byType.get('hr_doc') ?? 0,     size: 'sm' },
    { label: 'Vendor docs',       value: byType.get('vendor_doc') ?? 0, size: 'sm' },
    { label: 'Templates',         value: byType.get('template') ?? 0,   size: 'sm' },
  ];

  const tabs: DashboardTab[] = [
    { key: '/settings', label: 'Settings', href: '/settings', active: false },
    { key: '/settings/documents', label: 'Documents', href: '/settings/documents', active: true },
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
      <DashboardPage title="Settings · Documents registry" subtitle={`${rows.length.toLocaleString()} docs in dms.documents · reassign container to move a doc between /marketing/docs, /operations/sustainability, HR area`} tabs={tabs}>
        <div style={{ gridColumn:'1 / -1', display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <div style={{ fontSize:11, color:INK_M }}>Change a doc&apos;s <code>doc_type</code>/<code>doc_subtype</code> here and it moves to the matching container on next reload.</div>
          <DocsUploadButtons />
        </div>

        <div style={{ gridColumn:'1 / -1', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:8 }}>
          {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>

        <div style={{ gridColumn:'1 / -1' }}>
          <RegistryClient initialRows={rows} />
        </div>
      </DashboardPage>
    </div>
  );
}
