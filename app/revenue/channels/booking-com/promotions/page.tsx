// app/revenue/channels/booking-com/promotions/page.tsx
// PBS 2026-07-07: Booking.com promotion activation (Mobile rate + Genius).
// State is source-of-truth for the "Genius" and "Mobile" columns on the day report.

import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import { PROPERTY_ID } from '@/lib/supabase';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import ChannelPromotionsPanel, { type PromotionRow } from '../../_components/ChannelPromotionsPanel';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function BookingComPromotionsPage() {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('channel_promotions')
    .select('channel, promo_key, label, is_active, cost_pct, cost_flat, notes')
    .eq('property_id', PROPERTY_ID)
    .eq('channel', 'booking.com')
    .order('promo_key');

  const initial = (data ?? []) as PromotionRow[];

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh' }}>
      <DashboardPage title="Booking.com · Promotions" subtitle="Activate Mobile rate + Genius programme · cost visible on the day report">
        <div style={{ gridColumn: '1 / -1' }}>
          <Container title="Activation" subtitle="Toggle active + set cost — save per row. Green dot = active (day report cell will be green).">
            <ChannelPromotionsPanel channel="booking.com" propertyId={PROPERTY_ID} initial={initial} />
          </Container>
        </div>
      </DashboardPage>
    </div>
  );
}
