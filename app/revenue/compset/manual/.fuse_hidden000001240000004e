// app/revenue/compset/manual/page.tsx
// Source: public.competitor_set + public.competitor_property + public.competitor_rates
// Lets owner manage manual peer set + log weekly rate observations.

import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { ManualRateEntry } from '../_components/ManualRateEntry';

export const dynamic = 'force-dynamic';

type Peer = {
  comp_id: string;
  property_name: string;
  star_rating: number | null;
  rooms: number | null;
  bdc_url: string | null;
  notes: string | null;
};

type SetRow = { set_id: string; set_name: string; notes: string | null };

type ExistingRate = {
  comp_id: string;
  stay_date: string;
  rate_usd: number;
  channel: string | null;
  shop_date: string;
};

export default async function ManualCompsetPage() {
  // Resolve the manual set for this property
  const { data: setRow } = await supabase
    .from('competitor_set')
    .select('set_id, set_name, notes')
    .eq('property_id', 260955)
    .eq('set_type', 'manual')
    .maybeSingle();

  const s = setRow as unknown as SetRow | null;
  if (!s) {
    return <div className="p-8 text-stone-700">Manual set not configured.</div>;
  }

  const { data: peers } = await supabase
    .from('competitor_property')
    .select('comp_id, property_name, star_rating, rooms, bdc_url, notes')
    .eq('set_id', s.set_id)
    .eq('is_active', true)
    .order('property_name');

  // Forward dates: today + next 6 days
  const today = new Date();
  const dates = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d.toISOString().slice(0, 10);
  });

  // Existing rate observations for the next 7 days
  const peerList = (peers as unknown as Peer[]) ?? [];
  const compIds = peerList.map((p) => p.comp_id);
  const existingResp =
    compIds.length > 0
      ? await supabase
          .from('competitor_rates')
          .select('comp_id, stay_date, rate_usd, channel, shop_date')
          .in('comp_id', compIds)
          .gte('stay_date', dates[0])
          .lte('stay_date', dates[dates.length - 1])
      : { data: [] as ExistingRate[] };
  const existingRates = (existingResp.data as unknown as ExistingRate[]) ?? [];

  return (
    <div className="space-y-8 px-8 py-6">
      <nav className="text-[11px] uppercase tracking-[0.16em] text-stone-500">
        <Link href="/revenue/compset" className="hover:text-stone-900">
          ← Comp set overview
        </Link>
      </nav>

      <header>
        <h1 className="font-serif text-3xl text-stone-900">{s.set_name}</h1>
        <p className="mt-2 text-sm text-stone-600">{s.notes}</p>
        <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-stone-500">
          Log peer rates for the next 7 days. Update weekly. Source: Booking.com
          lowest available rate (1 guest, refundable).
        </p>
      </header>

      <ManualRateEntry
        peers={peerList}
        dates={dates}
        existing={existingRates}
        setId={s.set_id}
      />
    </div>
  );
}
