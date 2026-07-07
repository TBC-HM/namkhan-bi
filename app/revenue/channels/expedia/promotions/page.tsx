// app/revenue/channels/expedia/promotions/page.tsx
// PBS 2026-07-07: Expedia promotion activation (Mob B&E · EXP Accel · P+ BAR).

import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import { PROPERTY_ID } from '@/lib/supabase';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import ChannelPromotionsPanel, { type PromotionRow } from '../../_components/ChannelPromotionsPanel';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ExpediaPromotionsPage() {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('channel_promotions')
    .select('channel, promo_key, label, is_active, cost_pct, cost_flat, notes')
    .eq('property_id', PROPERTY_ID)
    .eq('channel', 'expedia')
    .order('promo_key');

  const initial = (data ?? []) as PromotionRow[];

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh' }}>
      <DashboardPage title="Expedia · Promotions" subtitle="Activate Mobile Book & Expedia · Expedia Accelerator · Package+ BAR">
        <div style={{ gridColumn: '1 / -1' }}>
          <Container title="Activation" subtitle="Toggle active + set cost — save per row. Green dot = active (day report cell will be green).">
            <ChannelPromotionsPanel channel="expedia" propertyId={PROPERTY_ID} initial={initial} />
          </Container>
        </div>
      </DashboardPage>
    </div>
  );
}
