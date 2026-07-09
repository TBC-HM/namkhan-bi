// app/revenue/channels/[source]/promotions/page.tsx
// PBS 2026-07-09 pm: dynamic promotions page — one per OTA source.
// Reads channel_promotions filtered by source slug → channel key.
// Static routes for booking-com + expedia still win over this dynamic route
// (Next.js resolves the static ones first), so their bespoke pages are untouched.

import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import { notFound } from 'next/navigation';
import { PROPERTY_ID } from '@/lib/supabase';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import ChannelPromotionsPanel, { type PromotionRow } from '../../_components/ChannelPromotionsPanel';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// slug ↔ canonical channel + display name for the OTA-native programme
const SOURCE_TO_CHANNEL: Record<string, { channel: string; display: string; programNote: string }> = {
  'booking-com': { channel: 'booking.com', display: 'Booking.com', programNote: 'Genius · Preferred · Country · LOS · Weekend · Last-minute · Early-booker' },
  'expedia':     { channel: 'expedia',     display: 'Expedia',     programNote: 'One Key · MoD · Accelerator · Package+ · Country · LOS' },
  'agoda':       { channel: 'agoda',       display: 'Agoda',       programNote: 'AgodaVIP · Insider Deals · Country · Mobile · LOS' },
  'trip-com':    { channel: 'trip.com',    display: 'Trip.com',    programNote: 'Trip Coins · Preferred · Country · App-only · LOS' },
  'tiket':       { channel: 'tiket',       display: 'Tiket',       programNote: 'Tiket Elite · Country · Flash sale · LOS' },
};

interface Props { params: Promise<{ source: string }> }

export default async function DynamicPromotionsPage({ params }: Props) {
  const { source } = await params;
  const cfg = SOURCE_TO_CHANNEL[source];
  if (!cfg) notFound();

  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('channel_promotions')
    .select('channel, promo_key, label, is_active, cost_pct, cost_flat, notes')
    .eq('property_id', PROPERTY_ID)
    .eq('channel', cfg.channel)
    .order('promo_key');

  const initial = (data ?? []) as PromotionRow[];

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh' }}>
      <DashboardPage title={`${cfg.display} · Promotions`} subtitle={cfg.programNote}>
        <div style={{ gridColumn: '1 / -1' }}>
          <Container title="Activation" subtitle={`Toggle active + set cost per row. ${initial.length} programmes seeded for ${cfg.display}.`}>
            <ChannelPromotionsPanel channel={cfg.channel} propertyId={PROPERTY_ID} initial={initial} />
          </Container>
        </div>
      </DashboardPage>
    </div>
  );
}
