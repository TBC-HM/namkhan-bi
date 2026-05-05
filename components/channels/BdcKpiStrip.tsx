// components/channels/BdcKpiStrip.tsx — 5-tile KPI strip above the 3-chart hero.
// Mirrors the operations/staff page visual language (KpiBox grid).
//   Tile 1: BDC % of hotel revenue (12m)
//   Tile 2: 12m revenue (USD)
//   Tile 3: Realization rate (vs gross attempted)
//   Tile 4: ADR vs hotel avg
//   Tile 5: Cancel rate vs city avg

import { supabase } from '@/lib/supabase';
import KpiBox from '@/components/kpi/KpiBox';

async function fetchAll() {
  const [{ data: share }, { data: funnel }, { data: ranking }] = await Promise.all([
    supabase.from('v_bdc_hero_channel_share').select('*').limit(1).maybeSingle(),
    supabase.from('v_bdc_hero_funnel').select('*').limit(1).maybeSingle(),
    supabase.from('v_bdc_ranking_snapshot').select('cancel_pct, area_avg_cancel_pct').limit(1).maybeSingle(),
  ]);
  return { share, funnel, ranking };
}

export default async function BdcKpiStrip() {
  const { share, funnel, ranking } = await fetchAll();
  if (!share || !funnel) return null;

  const bdcRevSharePct = Number(share.bdc_revenue_share_pct ?? 0);
  const bdcRev = Number(share.bdc_revenue_usd ?? 0);
  const realizationPct = Number(funnel.realization_rate_pct ?? 0);
  const leakedUsd = Number(funnel.leaked_revenue_usd ?? 0);
  const bdcAdr = Number(share.bdc_adr_usd ?? 0);
  const hotelAdr = Number(share.hotel_adr_usd ?? 0);
  const adrPremium = Number(share.bdc_adr_premium_pct ?? 0);
  const cancelMine = ranking ? Number(ranking.cancel_pct ?? 0) : 0;
  const cancelArea = ranking ? Number(ranking.area_avg_cancel_pct ?? 0) : 0;
  const cancelGap = cancelMine - cancelArea;

  return (
    <section className="kpi-strip cols-5" style={{ marginBottom: 14 }}>
      <KpiBox
        value={bdcRevSharePct}
        unit="pct"
        label="% of hotel revenue"
        tooltip={`BDC contributes ${bdcRevSharePct.toFixed(1)}% of total hotel revenue over the 12-month check-in window.`}
      />
      <KpiBox
        value={bdcRev}
        unit="usd"
        label="12-month revenue"
        tooltip="Sum of confirmed (ok-status) BDC revenue across the loaded reservation window."
      />
      <KpiBox
        value={realizationPct}
        unit="pct"
        label="Realization rate"
        tooltip={`confirmed / gross attempted. Leaked revenue from cancels: $${leakedUsd.toLocaleString('en-GB')} over the 12-month window.`}
        state={realizationPct < 70 ? 'data-needed' : 'live'}
        needs={realizationPct < 70 ? `${Math.round(leakedUsd / 1000)}k leaked from cancels.` : undefined}
      />
      <KpiBox
        value={bdcAdr}
        unit="usd"
        label="ADR vs hotel"
        delta={hotelAdr > 0 ? { value: adrPremium, unit: 'pct', period: 'vs hotel avg' } : undefined}
        tooltip={`BDC ADR ${bdcAdr.toFixed(0)} vs hotel-wide ${hotelAdr.toFixed(0)}.`}
      />
      <KpiBox
        value={cancelMine}
        unit="pct"
        label="Cancel rate vs city"
        delta={cancelArea > 0 ? { value: cancelGap, unit: 'pp', period: 'vs city avg' } : undefined}
        state={cancelGap >= 5 ? 'data-needed' : 'live'}
        needs={cancelGap >= 5 ? 'Investigate same-day & long-lead cancel buckets.' : undefined}
        tooltip={`We ${cancelMine.toFixed(1)}% vs city ${cancelArea.toFixed(1)}%. Gap ${cancelGap >= 0 ? '+' : ''}${cancelGap.toFixed(1)}pp.`}
      />
    </section>
  );
}
