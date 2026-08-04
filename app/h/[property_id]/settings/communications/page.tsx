// app/h/[property_id]/settings/communications/page.tsx
// Sender identity, email footer address (fixes newsletter location bug),
// unsubscribe text, signature. Editable via CommsClient.

import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSettingsTabs } from '@/lib/property-settings-tabs';
import CommsClient from './_client/CommsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CommsSettingsPage({ params }: { params: { property_id: string } }) {
  const pid = Number(params.property_id);
  const sb = getSupabaseAdmin();

  const { data } = await sb
    .schema('property')
    .from('communications')
    .select('*')
    .eq('property_id', pid)
    .maybeSingle();

  const initial = (data as any) ?? { property_id: pid };

  return (
    <DashboardPage
      title="Settings · Communications"
      subtitle={`Sender identity · email footer · newsletter fix · property ${pid}`}
      tabs={getSettingsTabs(pid, 'communications')}
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <Container
          title="Email Identity & Footer"
          subtitle="Sender name · from address · physical footer address (CAN-SPAM required) · unsubscribe text"
        >
          <CommsClient initial={initial} />
        </Container>
      </div>
    </DashboardPage>
  );
}
