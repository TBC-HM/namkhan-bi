// app/_components/finance/FxRateHub.tsx
// USALI task #16 — FX rate hub for the Finance header chrome.
// Async server component. Reads gl.fx_rates for the most recent rate_date
// and renders a compact strip of USD-base rate pills (EUR, LAK, THB, GBP,
// JPY, SGD, CNY, CHF). Source: frankfurter (daily) + manual override (LAK).

import { supabaseGl } from '@/lib/supabase-gl';

interface FxRow {
  rate_date: string;
  from_currency: string;
  to_currency: string;
  rate: number | string;
  source: string;
}

// Order matters: anchor currencies first, then trade partners.
const DISPLAY_ORDER = ['EUR', 'LAK', 'THB', 'GBP', 'JPY', 'SGD', 'CNY', 'CHF'] as const;

function fmtRate(to: string, raw: number): string {
  if (to === 'LAK') return Math.round(raw).toLocaleString('en-US');
  if (raw >= 100) return raw.toFixed(2);
  if (raw >= 1) return raw.toFixed(3);
  return raw.toFixed(4);
}

export default async function FxRateHub() {
  // Get the latest available rate_date
  const { data: latestRow } = await supabaseGl
    .from('fx_rates')
    .select('rate_date')
    .order('rate_date', { ascending: false })
    .limit(1)
    .single();
  const latestDate = (latestRow as { rate_date?: string } | null)?.rate_date;
  if (!latestDate) {
    return (
      <div style={{ padding: '6px 14px', fontSize: 11, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>
        FX rate hub: no rates on file in <code>gl.fx_rates</code>.
      </div>
    );
  }

  const { data: rows } = await supabaseGl
    .from('fx_rates')
    .select('rate_date, from_currency, to_currency, rate, source')
    .eq('rate_date', latestDate)
    .eq('from_currency', 'USD');
  const fxRows = (rows ?? []) as FxRow[];
  const byCcy = new Map<string, FxRow>();
  for (const r of fxRows) byCcy.set(r.to_currency, r);

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
      padding: '8px 14px',
      borderBottom: '1px solid var(--hairline, #E6DFCC)',
      background: 'var(--paper, #FFFFFF)',
      fontFamily: 'inherit',
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)', marginRight: 4 }}>
        FX · 1 USD =
      </div>
      {DISPLAY_ORDER.map((to) => {
        const r = byCcy.get(to);
        if (!r) return null;
        const rate = Number(r.rate);
        const isManual = r.source === 'manual';
        return (
          <span key={to} title={`source: ${r.source} · ${r.rate_date}`} style={{
            fontSize: 12, padding: '3px 9px', borderRadius: 4,
            border: '1px solid var(--hairline, #E6DFCC)',
            background: 'var(--paper, #FFFFFF)',
            color: 'var(--ink, #1B1B1B)',
            fontVariantNumeric: 'tabular-nums',
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <span style={{ color: 'var(--ink-soft, #5A5A5A)', fontWeight: 600 }}>{to}</span>
            <span>{fmtRate(to, rate)}</span>
            {isManual && (
              <span title="manual override" style={{ fontSize: 9, color: 'var(--terracotta, #B8542A)', fontWeight: 700 }}>·M</span>
            )}
          </span>
        );
      })}
      <span style={{ fontSize: 10, color: 'var(--ink-soft, #5A5A5A)', marginLeft: 'auto' }}>as of {latestDate}</span>
    </div>
  );
}
