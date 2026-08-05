// app/h/[property_id]/settings/brain/page.tsx
// PBS 2026-07-24 · property-level brain console.
// 2026-08-04 · canonical tabs via getSettingsTabs.
// 2026-08-05 · BrainClient replaced with CentralChat (brief central-chat-missing-ui-features).

import { DashboardPage } from '@/app/(cockpit)/_design';
import { getSettingsTabs } from '@/lib/property-settings-tabs';
import CentralChat from '@/components/chat/CentralChat';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PropertyBrainSettingsPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  return (
    <DashboardPage
      title="Settings · Brain"
      subtitle={`Company document brain · scoped second-brain chat · property ${propertyId}`}
      tabs={getSettingsTabs(propertyId, 'brain')}
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <CentralChat mode="second-brain" moduleScope="brain" propertyId={propertyId} />
      </div>
    </DashboardPage>
  );
}