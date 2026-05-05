// lib/data-bdc-attention.ts — derive "what needs attention" cards from BDC data
// Server-side rules engine. Each rule reads the latest snapshot and returns
// 0..1 cards. Cards have severity, $ impact estimate, and recommended action.

import {
  getBdcCountryInsights,
  getBdcBookWindowInsights,
  getBdcGeniusMonthly,
  getBdcPaceMonthly,
  getBdcRankingSnapshot,
} from './data-bdc';
import {
  getBdcPromos,
  getBdcCountryReal12m,
  getBdcCancelCohort,
  getBdcLeadTimeBuckets,
} from './data-bdc-extra';

export type AttentionSeverity = 'critical' | 'warn' | 'info' | 'positive';

export interface AttentionCard {
  rule: string;
  severity: AttentionSeverity;
  title: string;
  evidence: string;
  recommendation: string;
  impact_usd_per_year?: number | null;
  scope: string; // e.g. 'country=Germany', 'window=0-1d', 'global'
}

const fmtUsd = (n: number | null | undefined) => {
  if (n == null || !isFinite(n)) return '—';
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
};

export async function getBdcAttentionCards(): Promise<AttentionCard[]> {
  const [countries, windows, genius, pace, ranking, promos, countriesReal, leadTime] = await Promise.all([
    getBdcCountryInsights(50).catch(() => []),
    getBdcBookWindowInsights().catch(() => []),
    getBdcGeniusMonthly().catch(() => []),
    getBdcPaceMonthly().catch(() => []),
    getBdcRankingSnapshot().catch(() => null),
    getBdcPromos().catch(() => []),
    getBdcCountryReal12m().catch(() => []),
    getBdcLeadTimeBuckets().catch(() => []),
  ]);

  const cards: AttentionCard[] = [];

  // ─── Rule 1 — cancel rate vs area average ──────────────────────────────
  if (ranking && ranking.cancel_pct > 0 && ranking.area_avg_cancel_pct > 0) {
    const delta = ranking.cancel_pct - ranking.area_avg_cancel_pct;
    if (delta >= 5) {
      // Rough $ impact: each 1pp cancel above norm × annual revenue exposure
      // Annual revenue from BDC ≈ bookings × ADR × LOS (using snapshot averages)
      // We don't have annual revenue here, so cite a placeholder estimate
      cards.push({
        rule: 'cancel_above_market',
        severity: 'critical',
        title: `Cancel rate ${ranking.cancel_pct.toFixed(1)}% vs city ${ranking.area_avg_cancel_pct.toFixed(1)}% (+${delta.toFixed(1)}pp)`,
        evidence: `Booking.com flags us ${delta.toFixed(1)}pp above city average. That excess cancel volume is a direct revenue leak — and BDC penalizes ranking when cancel > area avg.`,
        recommendation: 'Tighten same-day & non-refundable policy on 0-1 day book window. Consider deposit-on-book for Genius rate. Audit recent cancellations for source pattern.',
        scope: 'global',
      });
    }
  }

  // ─── Rule 2 — Genius dependency ────────────────────────────────────────
  const recentGeniusMonths = genius.filter((g) => g.genius_pct >= 80).length;
  if (genius.length > 0 && recentGeniusMonths >= 2) {
    let avgGenius = 0;
    for (const g of genius) avgGenius += g.genius_pct;
    avgGenius = avgGenius / genius.length;
    cards.push({
      rule: 'genius_dependency_high',
      severity: 'warn',
      title: `Genius dependency averaging ${avgGenius.toFixed(0)}% — pricing risk`,
      evidence: `${recentGeniusMonths} of ${genius.length} reported months ≥ 80% Genius bookings. If Genius status drops, the Genius discount baked into your ADR collapses overnight.`,
      recommendation: 'Diversify acquisition: push direct + Mobile non-Genius rates. Audit Genius rate parity with non-Genius BAR. Test removing Genius from low-demand months to measure dependency.',
      scope: 'global',
    });
  }

  // ─── Rule 3 — country share gaps (we under-index vs market) ────────────
  const ranked = countries
    .filter((c) => c.market_reservation_pct != null && c.my_reservation_pct != null)
    .map((c) => ({
      country: c.country,
      my: c.my_reservation_pct ?? 0,
      market: c.market_reservation_pct ?? 0,
      adr: c.my_adr_usd ?? 0,
      delta: (c.my_reservation_pct ?? 0) - (c.market_reservation_pct ?? 0),
    }))
    .filter((c) => c.market >= 5) // only large enough markets
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 3);

  for (const c of ranked) {
    if (c.delta < -3) {
      cards.push({
        rule: 'country_under_index',
        severity: 'warn',
        title: `Under-indexed in ${c.country}: ${c.my.toFixed(1)}% vs market ${c.market.toFixed(1)}%`,
        evidence: `City peers capture ${c.market.toFixed(1)}% of BDC reservations from ${c.country}; we're at ${c.my.toFixed(1)}% (${c.delta.toFixed(1)}pp gap). At our ADR ${fmtUsd(c.adr)}, closing half this gap = real revenue.`,
        recommendation: `Run Country-targeted promo (BDC Marketing → Country campaigns) for ${c.country}. Translate top 5 reviews into local language. Consider local-language landing on Booking site listing.`,
        scope: `country=${c.country}`,
      });
    }
  }

  // ─── Rule 4 — country share opportunities (we over-index — protect lead) ─
  const winners = countries
    .filter((c) => c.market_reservation_pct != null && c.my_reservation_pct != null)
    .map((c) => ({
      country: c.country,
      my: c.my_reservation_pct ?? 0,
      market: c.market_reservation_pct ?? 0,
      delta: (c.my_reservation_pct ?? 0) - (c.market_reservation_pct ?? 0),
    }))
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 1);

  for (const w of winners) {
    if (w.delta >= 3) {
      cards.push({
        rule: 'country_over_index',
        severity: 'positive',
        title: `Strong lead in ${w.country}: +${w.delta.toFixed(1)}pp vs market`,
        evidence: `We capture ${w.my.toFixed(1)}% of BDC ${w.country} demand vs market ${w.market.toFixed(1)}%. This is your moat.`,
        recommendation: `Defend it: keep ${w.country}-language landing copy fresh, monitor compset for matching campaigns, ensure top reviews stay visible.`,
        scope: `country=${w.country}`,
      });
    }
  }

  // ─── Rule 5 — pace months down vs LY ───────────────────────────────────
  const downMonths = pace.filter((p) => p.rn_diff_pct < -20);
  if (downMonths.length > 0) {
    const worst = downMonths.reduce((a, b) => (b.rn_diff_pct < a.rn_diff_pct ? b : a));
    const sumGap = downMonths.reduce((s, m) => s + (m.rn_last_year - m.rn_current) * (m.adr_current_usd || 0), 0);
    cards.push({
      rule: 'pace_below_ly',
      severity: 'critical',
      title: `${downMonths.length} stay months pacing >20% below LY (worst: ${worst.stay_year_month} ${worst.rn_diff_pct.toFixed(1)}%)`,
      evidence: `Total OTB-vs-LY gap across these months ≈ ${fmtUsd(sumGap)} at current ADR. BDC pace data, not full hotel pace — but signals demand softness on Booking.`,
      recommendation: `Run Mobile + Last-minute campaigns for ${worst.stay_year_month}. Test a rate reduction paired with a minimum LOS restriction. Push direct nurture to LY guests with similar stay window.`,
      scope: `pace=${downMonths.map((m) => m.stay_year_month).join(',')}`,
    });
  }

  // ─── Rule 6 — book-window cancel curve hot spots ───────────────────────
  for (const w of windows) {
    const cancelDelta = w.my_cancel_pct - w.compset_cancel_pct;
    if (cancelDelta >= 3 && w.my_reservation_pct >= 10) {
      cards.push({
        rule: 'book_window_cancel_excess',
        severity: 'warn',
        title: `${w.window_label}: cancel ${w.my_cancel_pct.toFixed(1)}% vs compset ${w.compset_cancel_pct.toFixed(1)}%`,
        evidence: `${w.my_reservation_pct.toFixed(0)}% of bookings come from this window with cancel ${cancelDelta.toFixed(1)}pp above compset. Outsized cancel concentration here.`,
        recommendation: `Test stricter cancel policy for this lead-time bucket. Add deposit requirement on bookings made within ${w.window_label}.`,
        scope: `window=${w.window_label}`,
      });
    }
  }

  // ─── Rule 7 — funnel page→book conversion below area avg ───────────────
  if (ranking && ranking.area_avg_conversion_pct != null && ranking.page_to_book_pct < ranking.area_avg_conversion_pct - 0.05) {
    cards.push({
      rule: 'funnel_conversion_low',
      severity: 'warn',
      title: `Page→book ${ranking.page_to_book_pct.toFixed(2)}% vs area ${ranking.area_avg_conversion_pct.toFixed(2)}%`,
      evidence: `Visitors reach our property page but convert below area average. Means content, photos, price perception, or cancel policy is losing the close.`,
      recommendation: `Audit photo gallery quality + count. Re-write description for top destination keywords. A/B test rate fences vs straight BAR.`,
      scope: 'global',
    });
  }

  // ─── Rule 8 — review score vs area (positive lever) ────────────────────
  if (ranking && ranking.review_score - ranking.area_avg_review_score >= 0.5) {
    cards.push({
      rule: 'review_score_lead',
      severity: 'positive',
      title: `Review score ${ranking.review_score.toFixed(1)} vs area ${ranking.area_avg_review_score.toFixed(1)} (+${(ranking.review_score - ranking.area_avg_review_score).toFixed(1)})`,
      evidence: `Premium review score is your single biggest pricing lever on BDC. Below 9.0 = ranking penalty; above 9.0 = visibility boost + ADR justification.`,
      recommendation: `Use this in property description, push score badge prominently in photos. Reply to every review (response rate is a separate ranking signal).`,
      scope: 'global',
    });
  }

  // ─── Rule 9 — kill-cancel-heavy promos (real promo data) ───────────────
  const killers = promos
    .filter((p) => (p.cancel_rate_pct ?? 0) >= 40 && (p.bookings ?? 0) >= 10);
  for (const p of killers) {
    cards.push({
      rule: 'promo_cancel_heavy',
      severity: 'warn',
      title: `Promo "${p.name}" → ${p.cancel_rate_pct?.toFixed(0)}% cancel rate (${p.bookings} bookings)`,
      evidence: `${p.bookings} bookings @ ${p.discount_pct}% discount, ${p.canceled_room_nights} of ${p.room_nights} room nights cancelled. Bringing in volume that doesn't materialize.`,
      recommendation: `Tighten this promo — add deposit requirement, restrict to LOS ≥ 2, or kill if ROI doesn't justify the cancel ops cost. Active promos: ${promos.filter((x) => x.status === 'active').length}.`,
      scope: `promo=${p.name}`,
    });
  }

  // ─── Rule 10 — low-confirm-rate countries (real reservation data) ──────
  const lowConfirm = countriesReal
    .filter((c) => c.bookings_total >= 10 && (c.confirm_rate_pct ?? 100) < 60)
    .sort((a, b) => (a.confirm_rate_pct ?? 0) - (b.confirm_rate_pct ?? 0))
    .slice(0, 3);
  for (const c of lowConfirm) {
    cards.push({
      rule: 'country_low_confirm',
      severity: 'warn',
      title: `${c.country_iso2.toUpperCase()} confirm rate ${c.confirm_rate_pct?.toFixed(0)}% (${c.bookings_ok}/${c.bookings_total} bookings)`,
      evidence: `${c.bookings_cancelled} of ${c.bookings_total} bookings from ${c.country_iso2.toUpperCase()} cancel. Avg ADR ${c.avg_adr_usd != null ? '$' + c.avg_adr_usd.toFixed(0) : '—'}, lead time ${c.avg_lead_days?.toFixed(0)}d.`,
      recommendation: `Audit policy for this market — possibly tighten cancel terms for ${c.country_iso2.toUpperCase()}-origin bookings. Consider deposit-on-book for lead time > 30d from this market.`,
      scope: `country=${c.country_iso2}`,
    });
  }

  // ─── Rule 11 — high-leverage lead-time buckets with high cancel ────────
  const hotBuckets = leadTime
    .filter((b) => b.window_label !== '—' && b.bookings_total >= 30 && b.cancel_pct >= 35);
  for (const b of hotBuckets) {
    cards.push({
      rule: 'leadtime_bucket_cancel',
      severity: 'warn',
      title: `${b.window_label} bookings cancel ${b.cancel_pct.toFixed(0)}% (${b.bookings_total} bookings)`,
      evidence: `Real reservation data: ${b.bookings_cancelled} of ${b.bookings_total} ${b.window_label} bookings cancel. This is concentrated cancel risk by lead time.`,
      recommendation: `Add 50% deposit-on-book for ${b.window_label} bookings. Or test non-refundable rate fence for this window.`,
      scope: `lead_time=${b.window_label}`,
    });
  }

  // Sort: critical → warn → info → positive
  const sevOrder: Record<AttentionSeverity, number> = { critical: 0, warn: 1, info: 2, positive: 3 };
  cards.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);

  return cards;
}
