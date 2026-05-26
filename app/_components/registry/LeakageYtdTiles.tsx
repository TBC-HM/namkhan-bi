// app/_components/registry/LeakageYtdTiles.tsx
// PBS 2026-05-27 (#259): 8 KPI tiles on top of /leakage:
// Revenue YTD · Total Leakage YTD · Leakage % of Revenue · Bedbank Leakage YTD · OTA Parity · Website Discipline · Email Leak · Phone Leak.

import { KpiTile } from '@/app/(cockpit)/_design';
import { supabase } from '@/lib/supabase';

interface Props { propertyId: number }

interface RdRow {
  property_id: number; yr: number;
  ota_parity_loss_eur: number; ota_parity_breach_rn: number;
  website_self_loss_eur: number; website_self_breach_rn: number;
  email_loss_eur: number; email_breach_rn: number;
  phone_loss_eur: number; phone_breach_rn: number;
}
interface TopRow {
  property_id: number; yr: number;
  revenue_ytd: number;
  bedbank_leakage_ytd: number; bedbank_breach_rn: number;
  total_leakage_ytd: number;
  leakage_pct_of_revenue: number;
}

export default async function LeakageYtdTiles({ propertyId }: Props) {
  const [rdRes, topRes] = await Promise.all([
    supabase.from('v_rate_discipline_metrics').select('*').eq('property_id', propertyId).maybeSingle(),
    supabase.from('v_leakage_top_summary').select('*').eq('property_id', propertyId).maybeSingle(),
  ]);
  const rd = (rdRes.data ?? null) as RdRow | null;
  const top = (topRes.data ?? null) as TopRow | null;
  if (!rd && !top) return null;

  const ccy: 'USD' | 'EUR' = propertyId === 1000001 ? 'EUR' : 'USD';
  const yr = top?.yr ?? rd?.yr ?? new Date().getFullYear();

  const sevByPct = (pct: number) => (pct > 8 ? 'red' : pct > 3 ? 'amber' : 'green') as 'red' | 'amber' | 'green';
  const sevByAbs = (loss: number, rev: number = 1) => {
    const pct = rev > 0 ? (loss / rev) * 100 : 0;
    return sevByPct(pct);
  };
  const mkLoss = (label: string, loss: number, rn: number, hint: string) => ({
    label,
    value: Math.round(Number(loss ?? 0)),
    currency: ccy,
    footnote: `${Math.round(Number(rn ?? 0)).toLocaleString()} RN · ${hint}`,
    status: sevByAbs(Number(loss), Number(top?.revenue_ytd ?? 0)),
  });

  const tiles = [
    {
      label: 'Revenue YTD',
      value: Math.round(Number(top?.revenue_ytd ?? 0)),
      currency: ccy,
      footnote: `total realised · year ${yr}`,
      status: 'green' as const,
    },
    {
      label: 'Total Leakage YTD',
      value: Math.round(Number(top?.total_leakage_ytd ?? 0)),
      currency: ccy,
      footnote: 'sum of 5 leak categories',
      status: sevByPct(Number(top?.leakage_pct_of_revenue ?? 0)),
    },
    {
      label: 'Leakage % of Revenue',
      value: `${Number(top?.leakage_pct_of_revenue ?? 0).toFixed(1)}%`,
      footnote: 'every euro lost vs Website baseline',
      status: sevByPct(Number(top?.leakage_pct_of_revenue ?? 0)),
    },
    {
      label: 'Bedbank Leakage YTD',
      value: Math.round(Number(top?.bedbank_leakage_ytd ?? 0)),
      currency: ccy,
      footnote: `${Math.round(Number(top?.bedbank_breach_rn ?? 0)).toLocaleString()} RN below contracted floor`,
      status: sevByAbs(Number(top?.bedbank_leakage_ytd ?? 0), Number(top?.revenue_ytd ?? 1)),
    },
    mkLoss('OTA Parity Loss', rd?.ota_parity_loss_eur ?? 0, rd?.ota_parity_breach_rn ?? 0, 'OTAs sold below Website'),
    mkLoss('Website Discipline', rd?.website_self_loss_eur ?? 0, rd?.website_self_breach_rn ?? 0, 'Website undercut OTA'),
    mkLoss('Email Leak', rd?.email_loss_eur ?? 0, rd?.email_breach_rn ?? 0, 'Email ADR below Website'),
    mkLoss('Phone Leak', rd?.phone_loss_eur ?? 0, rd?.phone_breach_rn ?? 0, 'Phone ADR below Website'),
  ];

  return (
    <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 6, padding: '2px 0 10px', borderBottom: '1px solid var(--hairline, #E6DFCC)' }}>
      <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)' }}>
        Headline · YTD {yr} · Revenue + total leak + 5 leak categories
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
        {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
      </div>
    </div>
  );
}
