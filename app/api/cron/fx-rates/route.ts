// app/api/cron/fx-rates/route.ts
// GET /api/cron/fx-rates  — pulls daily FX rates from Frankfurter (free, ECB-based)
// and upserts into gl.fx_rates. Triggered by Vercel Cron (vercel.json schedule)
// or manually for testing.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(_req: NextRequest) {
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }

  const today = new Date().toISOString().slice(0, 10);

  // 1. Frankfurter — free, no key, USD base + 7 cross rates
  const frankResp = await fetch(
    'https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,THB,CHF,JPY,AUD,SGD,CNY',
    { cache: 'no-store' }
  );
  if (!frankResp.ok) {
    return NextResponse.json({ ok: false, error: `frankfurter ${frankResp.status}` }, { status: 502 });
  }
  const fx = await frankResp.json() as { date: string; base: string; rates: Record<string, number> };

  // 2. Wipe today's frankfurter rows then insert fresh
  await admin.schema('gl').from('fx_rates')
    .delete().eq('rate_date', today).eq('source', 'frankfurter');

  const rows = Object.entries(fx.rates).map(([to, rate]) => ({
    rate_date: today,
    from_currency: 'USD',
    to_currency: to,
    rate,
    source: 'frankfurter',
  }));

  // 3. LAK manual rate from app_settings (Frankfurter doesn't have LAK)
  const { data: lakRow } = await admin.from('app_settings')
    .select('value').eq('key', 'property.fx_lak_usd').maybeSingle();
  if (lakRow?.value) {
    const lakRate = Number(typeof lakRow.value === 'string' ? lakRow.value : lakRow.value);
    if (Number.isFinite(lakRate) && lakRate > 0) {
      await admin.schema('gl').from('fx_rates')
        .delete().eq('rate_date', today).eq('from_currency', 'USD')
        .eq('to_currency', 'LAK').eq('source', 'manual');
      rows.push({
        rate_date: today, from_currency: 'USD', to_currency: 'LAK',
        rate: lakRate, source: 'manual',
      });
    }
  }

  const { error: insErr } = await admin.schema('gl').from('fx_rates').insert(rows);
  if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    date: today,
    inserted: rows.length,
    rates: Object.fromEntries(rows.map(r => [r.to_currency, r.rate])),
    source: { frankfurter: fx.date, lak: 'manual via app_settings' },
  });
}
