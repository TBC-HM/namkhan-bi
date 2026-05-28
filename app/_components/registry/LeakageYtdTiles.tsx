// app/_components/registry/LeakageYtdTiles.tsx
// PBS 2026-05-28 — ADR-128 honest-leakage swap (brief: leakage-honest-summary-strip)
// Repointed to v_leakage_top_summary_v2. Email/OTA/Phone now report HONEST leakage:
//   - Email = transient-only ADR gap, occupancy-weighted (was blended, contaminated by wholesale).
//   - OTA = OTAs sold below direct (actual loss, was theoretical parity-gap).
//   - Phone = phone ADR below direct.
// Website Discipline tile DROPPED — direct cheaper than OTA is margin-positive, not a loss.
// New "Net OTA/Web Spread" tile is sign-reversed: GREEN when negative (direct < OTA = hotel wins).

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
interface TopV2Row {
  property_id: number; yr: number;
  revenue_ytd: number;
  bedbank_leakage_ytd: number;
  ota_undercut_ytd: number;
  email_realistic_ytd: number;
  phone_leakage_ytd: number;
  net_ota_web_spread_eur: number;
  honest_leakage_ytd: number;
  legacy_total_ytd: number;
  honest_leakage_pct: number;
}

export default async function LeakageYtdTiles({ propertyId }: Props) {
  const [rdRes, topRes] = await Promise.all([
    supabase.from('v_rate_discipline_metrics').select('*').eq('property_id', propertyId).maybeSingle(),
    supabase.from('v_leakage_top_summary_v2').select('*').eq('property_id', propertyId).maybeSingle(),
  ]);
  const rd = (rdRes.data ?? null) as RdRow | null;
  const top = (topRes.data ?? null) as TopV2Row | null;
  if (!rd && !top) return null;

  const ccy: 'USD' | 'EUR' = propertyId === 1000001 ? 'EUR' : 'USD';
  const yr = top?.yr ?? rd?.yr ?? new Date().getFullYear();

  const sevByPct = (pct: number) => (pct > 8 ? 'red' : pct > 3 ? 'amber' : 'green') as 'red' | 'amber' | 'green';
  const sevByAbs = (loss: number, rev: number = 1) => {
    const pct = rev > 0 ? (loss / rev) * 100 : 0;
    return sevByPct(pct);
  };
  // Sign-reversed convention: negative spread = OTAs more expensive than direct = hotel wins margin.
  const sevBySpread = (spread: number): 'red' | 'amber' | 'green' => {
    if (spread < -2000) return 'green';
    if (spread > 2000) return 'red';
    return 'amber';
  };

  const netSpread = Number(top?.net_ota_web_spread_eur ?? 0);

  const tiles = [
    {
      label: 'Revenue YTD',
      value: Math.round(Number(top?.revenue_ytd ?? 0)),
      currency: ccy,
      footnote: `total realised · year ${yr}`,
      status: 'green' as const,
    },
    {
      label: 'Addressable Rate Leakage',
      value: Math.round(Number(top?.honest_leakage_ytd ?? 0)),
      currency: ccy,
      footnote: 'bedbank + OTA undercut + email + phone (excl. website-self)',
      status: sevByPct(Number(top?.honest_leakage_pct ?? 0)),
    },
    {
      label: 'Addressable Leakage %',
      value: `${Number(top?.honest_leakage_pct ?? 0).toFixed(1)}%`,
      footnote: 'honest leakage / revenue · website-self excluded',
      status: sevByPct(Number(top?.honest_leakage_pct ?? 0)),
    },
    {
      label: 'Bedbank Leakage (below floor)',
      value: Math.round(Number(top?.bedbank_leakage_ytd ?? 0)),
      currency: ccy,
      footnote: 'sold below contracted floor',
      status: sevByAbs(Number(top?.bedbank_leakage_ytd ?? 0), Number(top?.revenue_ytd ?? 1)),
    },
    {
      label: 'OTA Undercut',
      value: Math.round(Number(top?.ota_undercut_ytd ?? 0)),
      currency: ccy,
      footnote: `${Math.round(Number(rd?.ota_parity_breach_rn ?? 0)).toLocaleString()} RN · OTAs sold below direct`,
      status: sevByAbs(Number(top?.ota_undercut_ytd ?? 0), Number(top?.revenue_ytd ?? 1)),
    },
    {
      label: 'Net OTA/Web Spread',
      value: Math.round(netSpread),
      currency: ccy,
      footnote: netSpread < 0
        ? 'direct cheaper than OTA · margin-positive'
        : netSpread > 0
          ? 'website undercutting OTA · margin-leak'
          : 'direct ≈ OTA',
      status: sevBySpread(netSpread),
    },
    {
      label: 'Email ADR Gap (occ-adj)',
      value: Math.round(Number(top?.email_realistic_ytd ?? 0)),
      currency: ccy,
      footnote: `${Math.round(Number(rd?.email_breach_rn ?? 0)).toLocaleString()} RN · transient-only, occupancy-weighted`,
      status: sevByAbs(Number(top?.email_realistic_ytd ?? 0), Number(top?.revenue_ytd ?? 1)),
    },
    {
      label: 'Phone ADR Gap',
      value: Math.round(Number(top?.phone_leakage_ytd ?? 0)),
      currency: ccy,
      footnote: `${Math.round(Number(rd?.phone_breach_rn ?? 0)).toLocaleString()} RN · phone ADR below direct`,
      status: sevByAbs(Number(top?.phone_leakage_ytd ?? 0), Number(top?.revenue_ytd ?? 1)),
    },
  ];

  return (
    <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 6, padding: '2px 0 10px', borderBottom: '1px solid var(--hairline, #E6DFCC)' }}>
      <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)' }}>
        Headline · YTD {yr} · Revenue + honest leakage + 5 channel signals
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
        {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
      </div>
    </div>
  );
}
