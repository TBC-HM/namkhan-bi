// app/operations/spa/_shared/data.ts
// Spa module v1 (build/spa-module, 2026-07-30) — server-side fetch helpers.
// Updated 2026-08-13 for tier support (spa-module-v1-slice-day-pass-tiers).
// AUDIT-FIRST: reads only public.v_* bridges. v_property_spa_treatments and
// v_dept_top_seller_trend are LIVE today; v_spa_treatment_bookings /
// v_spa_therapists / v_spa_rooms are PROPOSED (db/proposed/build-spa-module)
// — until that DDL is approved+applied every helper degrades to
// { bridgeMissing: true } instead of crashing the page.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const PROPERTY_TZ: Record<number, string> = {
  260955: 'Asia/Vientiane',
  1000001: 'Europe/Madrid',
};