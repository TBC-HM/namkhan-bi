'use client';

// components/page/FxRatePills.tsx
// USALI task #16 (relocated 2026-05-26) — FX rate pills mounted INSIDE the
// global HeaderPills strip, sibling to temp/air/date/user. Reads
// public.v_fx_rates_latest (service-role-fronted view of gl.fx_rates) with
// the anon client. No layout wrapping; just pills.

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface FxRow {
  rate_date: string;
  from_currency: string;
  to_currency: string;
  rate: number | string;
  source: string;
}

const DISPLAY_ORDER: string[] = ['EUR', 'LAK', 'THB', 'GBP', 'JPY'];

function fmtRate(to: string, raw: number): string {
  if (to === 'LAK') return Math.round(raw).toLocaleString('en-US');
  if (raw >= 100) return raw.toFixed(2);
  if (raw >= 1)   return raw.toFixed(3);
  return raw.toFixed(4);
}

export default function FxRatePills() {
  const [rows, setRows] = useState<FxRow[]>([]);
  const [dt, setDt] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('v_fx_rates_latest')
        .select('rate_date, from_currency, to_currency, rate, source');
      if (cancelled) return;
      const fx = (data ?? []) as FxRow[];
      setRows(fx);
      setDt(fx[0]?.rate_date ?? '');
    })();
    return () => { cancelled = true; };
  }, []);

  if (rows.length === 0) return null;
  const byCcy = new Map<string, FxRow>();
  for (const r of rows) byCcy.set(r.to_currency, r);

  return (
    <>
      {DISPLAY_ORDER.map((to) => {
        const r = byCcy.get(to);
        if (!r) return null;
        const rate = Number(r.rate);
        return (
          <span key={to} title={`USD → ${to} · source ${r.source} · as of ${r.rate_date}`} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 11, padding: '3px 8px', borderRadius: 4,
            border: '1px solid var(--hairline, #E6DFCC)',
            background: 'var(--paper, #FFFFFF)',
            color: 'var(--ink, #1B1B1B)',
            fontVariantNumeric: 'tabular-nums', marginLeft: 4,
          }}>
            <span style={{ color: 'var(--ink-soft, #5A5A5A)', fontWeight: 600 }}>{to}</span>
            <span>{fmtRate(to, rate)}</span>
          </span>
        );
      })}
    </>
  );
}
