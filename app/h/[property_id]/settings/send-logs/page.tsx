// app/h/[property_id]/settings/send-logs/page.tsx
// PBS 2026-07-18 · Send Logs moved out of the Property sidebar into a
// sibling top-level tab (Property · Guardrails · Send Logs). Renders the
// existing SendLogsPanel which fetches its own data client-side from
// public.v_all_sends_unified.
// PBS 2026-07-20 · Rate Plans tab inserted between Media and Guardrails.
import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import SendLogsPanel from '@/components/settings/panels/SendLogsPanel';
import { getSettingsTabs } from '@/lib/property-settings-tabs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function SendLogsPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  return (
    <DashboardPage
      title="Settings · Send Logs"
      subtitle={`Every send out · all areas · property ${propertyId}`}
      tabs={getSettingsTabs(propertyId, 'send_logs')}
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Send Logs" subtitle="revenue reports · guest newsletters · sales outbound · marketing campaigns · reputation digests">
          <SendLogsPanel propertyId={propertyId} />
        </Container>
      </div>
    </DashboardPage>
  );
}
