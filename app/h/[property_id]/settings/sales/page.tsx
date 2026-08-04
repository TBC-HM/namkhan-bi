// app/h/[property_id]/settings/sales/page.tsx
// Sales & Groups — group thresholds, discount authority tiers, SLA, contacts.
// Also surfaces key fields from property.policies for reference.

import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSettingsTabs } from '@/lib/property-settings-tabs';
import SalesClient from './_client/SalesClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function PolicyField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div style={{ display: 'flex', gap: 8, padding: '7px 0', borderBottom: '1px solid #F5F1EA' }}>
      <span style={{ width: 220, flexShrink: 0, fontSize: 12, color: '#5A5A5A', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 13, color: value ? '#1B1B1B' : '#B0A896', fontStyle: value ? 'normal' : 'italic' }}>
        {value || '—'}
      </span>
    </div>
  );
}

export default async function SalesSettingsPage({ params }: { params: { property_id: string } }) {
  const pid = Number(params.property_id);
  const sb = getSupabaseAdmin();

  const [salesRes, polRes] = await Promise.all([
    sb.schema('property').from('sales_config').select('*').eq('property_id', pid).maybeSingle(),
    sb.schema('property').from('policies').select(
      'check_in_time, check_out_time, recommended_min_nights, group_payment_terms, group_booking_terms, cancellation_policy, selling_approach'
    ).eq('property_id', pid).maybeSingle(),
  ]);

  const initial = (salesRes.data as any) ?? { property_id: pid };
  const pol = polRes.data as any;

  return (
    <DashboardPage
      title="Settings · Sales & Groups"
      subtitle={`Group thresholds · discount tiers · SLA · contacts · property ${pid}`}
      tabs={getSettingsTabs(pid, 'sales')}
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <Container
          title="Sales Configuration"
          subtitle="Group booking thresholds · discount authority · inquiry SLA · group contact"
        >
          <SalesClient initial={initial} />
        </Container>
      </div>

      {pol && (
        <div style={{ gridColumn: '1 / -1', marginTop: 16 }}>
          <Container title="Policy Reference" subtitle="From property policies — edit in Property tab">
            <div style={{ padding: '4px 16px 12px' }}>
              <PolicyField label="Check-in Time"         value={pol.check_in_time} />
              <PolicyField label="Check-out Time"        value={pol.check_out_time} />
              <PolicyField label="Recommended Min Nights" value={pol.recommended_min_nights?.toString()} />
              <PolicyField label="Selling Approach"      value={pol.selling_approach} />
              <PolicyField label="Group Payment Terms"   value={pol.group_payment_terms} />
              <PolicyField label="Group Booking Terms"   value={pol.group_booking_terms} />
              <PolicyField label="Cancellation Policy"   value={pol.cancellation_policy} />
            </div>
          </Container>
        </div>
      )}
    </DashboardPage>
  );
}
