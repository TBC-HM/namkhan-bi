// lib/rules/operations.ts v1
// PBS 2026-07-07: Operations HoD conclusion rules.
// Consumes operator-editable thresholds from public.guardrails (domain='operations').

import type { Insight } from '@/app/_components/ConclusionBlock';

export interface OperationsTargets {
  fnb_capture_target?: number;      // gte % — F&B capture of in-house room-nights
  spa_capture_target?: number;      // gte %
  activities_capture?: number;      // gte %
  housekeeping_lag_min?: number;    // lte minutes — max acceptable lag
}

export interface OperationsContext {
  // Live data
  occToday: number;
  capacity: number;
  occPct: number;
  checkIns: number;
  checkOuts: number;

  // Capture rates today (from v_ancillary_capture_daily or similar)
  fnbCaptureToday: number | null;      // %
  spaCaptureToday: number | null;      // %
  activitiesCaptureToday: number | null; // %

  // Targets
  targets: OperationsTargets;
}

type Rule = (ctx: OperationsContext) => Insight | Insight[] | null;

const FB: Required<OperationsTargets> = {
  fnb_capture_target: 60,
  spa_capture_target: 20,
  activities_capture: 40,
  housekeeping_lag_min: 30,
};
const T = (ctx: OperationsContext, k: keyof OperationsTargets) => ctx.targets[k] ?? FB[k];

// Rule 1 — F&B capture below target
const ruleFnbCapture: Rule = (ctx) => {
  if (ctx.fnbCaptureToday == null || ctx.checkIns === 0) return null;
  const target = T(ctx, 'fnb_capture_target');
  if (ctx.fnbCaptureToday >= target) return null;
  return {
    key: 'fnb_capture_low',
    priority: ctx.fnbCaptureToday < target * 0.5 ? 'critical' : 'warning',
    guardrail: 'fixed',
    title: `F&B capture ${ctx.fnbCaptureToday.toFixed(0)}% today — below ${target}% target`,
    body: 'Missed F&B is missed TRevPAR. Check whether the greeter is offering the tasting menu, and whether the pre-stay email is teasing the restaurant.',
    evidence: `Target ≥ ${target}%`,
    action: 'See F&B →',
    href: '/operations/restaurant',
  };
};

// Rule 2 — Spa capture below target
const ruleSpaCapture: Rule = (ctx) => {
  if (ctx.spaCaptureToday == null) return null;
  const target = T(ctx, 'spa_capture_target');
  if (ctx.spaCaptureToday >= target) return null;
  return {
    key: 'spa_capture_low',
    priority: 'warning',
    guardrail: 'fixed',
    title: `Spa capture ${ctx.spaCaptureToday.toFixed(0)}% today — below ${target}% target`,
    body: 'Spa is the highest-margin ancillary. If capture is weak, check whether the welcome kit mentions availability + pricing.',
    evidence: `Target ≥ ${target}%`,
    action: 'See spa →',
    href: '/operations/spa',
  };
};

// Rule 3 — Activities capture below target
const ruleActivitiesCapture: Rule = (ctx) => {
  if (ctx.activitiesCaptureToday == null) return null;
  const target = T(ctx, 'activities_capture');
  if (ctx.activitiesCaptureToday >= target) return null;
  return {
    key: 'activities_capture_low',
    priority: 'info',
    guardrail: 'fixed',
    title: `Activities capture ${ctx.activitiesCaptureToday.toFixed(0)}% today — below ${target}% target`,
    body: 'Activities drive stay memorability + repeat rate. Weak capture usually = weak concierge push at check-in.',
    evidence: `Target ≥ ${target}%`,
    action: 'See activities →',
    href: '/operations/activities',
  };
};

// Rule 4 — Heavy check-in day (info) — signal to prep team + amenities
const ruleHeavyCheckIn: Rule = (ctx) => {
  if (ctx.checkIns < 6) return null;
  return {
    key: 'heavy_check_in_day',
    priority: 'info',
    guardrail: 'fixed',
    title: `${ctx.checkIns} check-ins today — heavy arrival day`,
    body: 'Coordinate transfers, room readiness, welcome kits + amenity presentation. Consider staffing an extra concierge slot.',
    evidence: `≥ 6 check-ins triggers this signal`,
    action: 'See arrivals →',
    href: '/front-office/arrivals',
  };
};

// Rule 5 — Sold out signal (positive)
const ruleSoldOut: Rule = (ctx) => {
  if (ctx.capacity === 0 || ctx.occToday < ctx.capacity) return null;
  return {
    key: 'ops_sold_out',
    priority: 'positive',
    guardrail: 'fixed',
    title: `Full house tonight · ${ctx.occToday}/${ctx.capacity}`,
    body: 'Every room occupied — lean into upsell (transfer, spa, F&B) and coordinate with front-office for smooth turnover.',
  };
};

const RULES: Rule[] = [
  ruleFnbCapture,
  ruleSpaCapture,
  ruleActivitiesCapture,
  ruleHeavyCheckIn,
  ruleSoldOut,
];

export function evaluateOperationsRules(ctx: OperationsContext): Insight[] {
  const out: Insight[] = [];
  for (const rule of RULES) {
    try {
      const r = rule(ctx);
      if (!r) continue;
      if (Array.isArray(r)) out.push(...r);
      else out.push(r);
    } catch { /* silently skip broken rule */ }
  }
  return out;
}
