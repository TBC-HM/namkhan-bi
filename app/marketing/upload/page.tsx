// app/marketing/upload/page.tsx
// PBS 2026-07-05: migrated from Page shell to DashboardPage. Preserves UploadDropzone.
import Link from 'next/link';
import UploadDropzone from '@/components/marketing/UploadDropzone';
import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../_subpages';

export const dynamic = 'force-dynamic';

const HAIR='#E6DFCC'; const INK='#1B1B1B'; const INK_M='#5A5A5A'; const CREAM='#F7F0E1'; const GREEN='#084838';

export default function UploadPage() {
  const tabs: DashboardTab[] = MARKETING_SUBPAGES.map(s => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/marketing/upload',
  }));

  return (
    <div style={{ background:'#FFFFFF', minHeight:'100vh' }}>
      <DashboardPage title="Marketing · Upload" subtitle="Drag-drop ingestion · auto-tagged · QC-checked · ICP-routed" tabs={tabs}>
        <div style={{ gridColumn:'1 / -1', padding:'10px 14px', background:CREAM, border:'1px solid '+HAIR, borderLeft:'3px solid '+GREEN, borderRadius:6, fontSize:12, color:INK, lineHeight:1.6 }}>
          Photos/videos land in <code>media-raw</code> bucket → registered in <code>media.media_assets</code> → routed to /marketing/gallery. If you want the polished media library, jump to <Link href="/marketing/gallery" style={{ color:GREEN }}>Media library →</Link>
        </div>
        <div style={{ gridColumn:'1 / -1', border:'1px solid '+HAIR, borderRadius:6, background:'#FFFFFF', padding:20 }}>
          <UploadDropzone />
        </div>
      </DashboardPage>
    </div>
  );
}
