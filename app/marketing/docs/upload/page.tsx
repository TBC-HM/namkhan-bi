// app/marketing/docs/upload/page.tsx
// PBS 2026-07-06: guided doc upload landing. Presents drag-drop into the
// dms-documents bucket + doc_type/doc_subtype metadata form so the file
// lands cleanly categorized.
import Link from 'next/link';
import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { DEPT_CFG } from '@/lib/dept-cfg';
import DocsUploadForm from './_components/DocsUploadForm';

export const dynamic = 'force-dynamic';

const HAIR='#E6DFCC'; const INK='#1B1B1B'; const INK_M='#5A5A5A'; const CREAM='#F7F0E1'; const GREEN='#084838';
const SUPABASE_STORAGE_URL = 'https://supabase.com/dashboard/project/kpenyneooigsyuuomgct/storage/buckets/dms-documents';

export default function DocsUploadPage() {
  const cfg = DEPT_CFG.marketing;
  const tabs: DashboardTab[] = cfg.subPages.map((s: { href: string; label: string }) => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/marketing/docs',
  }));

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
      <DashboardPage title="Marketing · Documents · Upload" subtitle="Drop a doc + pick container so it lands cleanly categorized" tabs={tabs}>
        <div style={{ gridColumn:'1 / -1' }}>
          <Link href="/marketing/docs" style={{ fontSize:12, color:GREEN, textDecoration:'none', fontWeight:600 }}>← Back to docs</Link>
        </div>
        <div style={{ gridColumn:'1 / -1', padding:'12px 16px', background:CREAM, border:'1px solid '+HAIR, borderLeft:'3px solid '+GREEN, borderRadius:6, fontSize:12, color:INK, lineHeight:1.6 }}>
          <strong>Two ways to upload:</strong>{' '}
          Guided flow below writes to <code>dms-documents</code> bucket + registers a row in <code>dms.documents</code> with the right <code>doc_type/doc_subtype</code>. If you prefer raw drag-drop into Supabase Storage without any metadata, use{' '}
          <a href={SUPABASE_STORAGE_URL} target="_blank" rel="noreferrer" style={{ color:GREEN, fontWeight:600 }}>Supabase Storage ↗</a>{' '}
          (you can then edit the metadata later on this page).
        </div>
        <div style={{ gridColumn:'1 / -1' }}>
          <DocsUploadForm />
        </div>
      </DashboardPage>
    </div>
  );
}
