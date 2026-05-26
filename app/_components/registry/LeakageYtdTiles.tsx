// app/_components/registry/LeakageYtdTiles.tsx
// PBS 2026-05-27 (#255 + #256 + #257): 6 KPI tiles on top of /leakage.
// Tile 1 — Revenue YTD (anchor for sizing the leak).
// Tile 2 — Bedbank Leakage YTD (sum of est_leakage_eur on bedbank contracts).
// Tiles 3-6 — channel leaks from per-(room × month) breach detection.

import { KpiTile } from '@/app/(cockpit)/_design';
import { supabase } from '@/lib/supabase';

interface Props { propertyId: number }

interface RdRow {
  property_id: number;
  yr: number;
  ota_parity_loss_eur: number;
  ota_parity_breach_rn: number;
  website_self_loss_eur: number;
  website_self_breach_rn: number;
  email_loss_eur: number;
  email_breach_rn: number;
  phone_loss_eur: number;
  phone_breach_rn: number;
}

interface TopRow {
  property_id: number;
  yr: number;
  revenue_ytd: number;
  bedbank_leakage_ytd: number;
  bedbank_breach_rn: number;
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

  const status = (loss: number, rev: number = 1) => {
    const pct = rev > 0 ? (loss / rev) * 100 : 0;
    return (pct > 5 ? 'red' : pct > 1 ? 'amber' : 'green') as 'red' | 'amber' | 'green';
  };

  const mkLoss = (label: string, loss: number, rn: number, hint: string) => ({
    label,
    value: Math.round(Number(loss ?? 0)),
    currency: ccy,
    footnote: `${Math.round(Number(rn ?? 0)).toLocaleString()} RN · ${hint}`,
    status: status(Number(loss), Number(top?.revenue_ytd ?? 0)),
  });

  const tiles = [
    {
      label: 'Revenue YTD',
      value: Math.round(Number(top?.revenue_ytd ?? 0)),
      currency: ccy,
      footnote: `total realised revenue · year ${yr}`,
      status: 'green' as const,
    },
    {
      label: 'Bedbank Leakage YTD',
      value: Math.round(Number(top?.bedbank_leakage_ytd ?? 0)),
      currency: ccy,
      footnote: `${Math.round(Number(top?.bedbank_breach_rn ?? 0)).toLocaleString()} RN below contracted floor`,
      status: status(Number(top?.bedbank_leakage_ytd ?? 0), Number(top?.revenue_ytd ?? 1)),
    },
    mkLoss('OTA Parity Loss', rd?.ota_parity_loss_eur ?? 0, rd?.ota_parity_breach_rn ?? 0, 'OTAs sold below Website rate — direct-bookings walked'),
    mkLoss('Website Discipline', rd?.website_self_loss_eur ?? 0, rd?.website_self_breach_rn ?? 0, 'we undercut our own OTA listings'),
    mkLoss('Email Leak', rd?.email_loss_eur ?? 0, rd?.email_breach_rn ?? 0, 'Email ADR below Website'),
    mkLoss('Phone Leak', rd?.phone_loss_eur ?? 0, rd?.phone_breach_rn ?? 0, 'Phone ADR below Website'),
  ];

  return (
    <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 6, padding: '2px 0 10px', borderBottom: '1px solid var(--hairline, #E6DFCC)' }}>
      <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)' }}>
        Headline · YTD {yr} · revenue + leak categories (size leaks vs total)
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
      </div>
    </div>
  );
}
