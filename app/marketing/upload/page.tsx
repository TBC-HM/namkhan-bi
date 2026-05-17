// app/marketing/upload/page.tsx
//
// PBS 2026-05-16: swapped the green PanelHero for the canonical <Page>
// shell so it matches the cockpit family.

import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import UploadDropzone from '@/components/marketing/UploadDropzone';
import { MARKETING_SUBPAGES } from '../_subpages';
import TabStrip, { INFO_TABS } from '@/app/finance/_components/TabStrip';

export const dynamic = 'force-dynamic';

export default function UploadPage() {
  return (
    <Page
      eyebrow="Marketing · Upload"
      title={<>Drop <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>files</em></>}
      subPages={MARKETING_SUBPAGES}
    >
      <TabStrip tabs={INFO_TABS} activeKey="library" />

      <Panel
        title="Drag-drop ingestion"
        eyebrow="auto-tagged · QC-checked · ICP-routed"
      >
        <div style={{ padding: 14 }}>
          <UploadDropzone />
        </div>
      </Panel>

      <div style={{
        marginTop: 14,
        padding: '10px 12px',
        fontSize: 'var(--t-xs)',
        color: 'var(--text-mute, #9b907a)',
        fontStyle: 'italic',
        borderTop: '1px solid var(--border-1, #1f1c15)',
      }}>
        Uses the signed-URL flow · direct-to-Supabase Storage · up to 500 MB / file. Auto-tagger + Reality Check run on every upload. JPEG · PNG · HEIC · WebP · CR2 · NEF · ARW · DNG.
      </div>
    </Page>
  );
}
