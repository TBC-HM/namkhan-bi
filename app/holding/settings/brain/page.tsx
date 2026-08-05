// app/holding/settings/brain/page.tsx
// PBS 2026-08-02 — Holding brain: ONLY docs where property_id IS NULL.
// propertyId=0 sentinel triggers the IS NULL filter in fn_brain_search/vec/docfind.
// No cross-tenant retrieval. Namkhan/Donna accessed via /h/[pid]/settings/brain.
// 2026-08-05 · BrainClient replaced with CentralChat (brief central-chat-missing-ui-features).

import { DashboardPage } from '@/app/(cockpit)/_design';
import CentralChat from '@/components/chat/CentralChat';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { settingsTabs } from '@/app/holding/settings/_components/tabs';

export default function HoldingBrainPage() {
  return (
    <DashboardPage
      title="Holding Brain"
      subtitle="54 holding-wide docs only · no Namkhan · no Donna · enter property settings for property-specific brains"
      tabs={settingsTabs('brain')}
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <CentralChat mode="second-brain" moduleScope="brain" propertyId={0} />
      </div>
    </DashboardPage>
  );
}