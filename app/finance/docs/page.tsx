// app/finance/docs/page.tsx
// PBS 2026-07-06: Documents registry surfaced under Administration (label
// change from Finance). Full dms.documents view with inline container
// reassignment. Same code path as /settings/documents — this URL is the
// canonical Administration entry.
import TenantLink from '@/components/nav/TenantLink';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { DashboardPage, KpiTile, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import DocsUploadButtons from '@/app/_components/DocsUploadButtons';
import RegistryClient from '@/app/settings/documents/_components/RegistryClient';
import { FINANCE_SUBPAGES } from '@/app/finance/_subpages';

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

export default async function AdminDocsPage() {
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
    { label: 'Total docs',        value: rows.length,                    size: 'sm' },
    { label: 'With property_id',  value: withProperty,                   size: 'sm' },
    { label: 'Unique doc_types',  value: byType.size,                    size: 'sm' },
    { label: 'Marketing',         value: byType.get('marketing') ?? 0,   size: 'sm' },
    { label: 'Partner',           value: byType.get('partner') ?? 0,     size: 'sm' },
    { label: 'HR docs',           value: byType.get('hr_doc') ?? 0,      size: 'sm' },
    { label: 'Vendor docs',       value: byType.get('vendor_doc') ?? 0,  size: 'sm' },
    { label: 'Templates',         value: byType.get('template') ?? 0,    size: 'sm' },
  ];

  const tabs: DashboardTab[] = FINANCE_SUBPAGES.map((s: { href: string; label: string }) => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/finance/docs',
  }));

  return (
    <div style={{ background:'#FFFFFF', minHeight:'100vh' }}>
      <DashboardPage title="Administration · Documents registry" subtitle={`${rows.length.toLocaleString()} docs across every dept — reassign a container to move a doc to /marketing/docs · /operations/sustainability · future HR / vendors pages`} tabs={tabs}>
        <div style={{ gridColumn:'1 / -1', display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <div style={{ fontSize:11, color:INK_M }}>
            Change a doc&apos;s <code>doc_type</code>/<code>doc_subtype</code> here and it moves to the matching container on next reload.
            {' '}Old finance legal register still lives at <TenantLink href="/finance/legal" style={{ color:GREEN }}>Finance · Legal</TenantLink>.
          </div>
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
