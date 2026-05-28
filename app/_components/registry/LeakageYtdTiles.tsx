// app/_components/registry/LeakageYtdTiles.tsx
// PBS 2026-05-28 — ADR-128 honest-leakage swap + dynamic action descriptors
// 8 YTD headline tiles bound to v_leakage_top_summary_v2.
// Footnotes are PULLED LIVE from v_leakage_action_pointers (one row/property):
// each tile surfaces the single largest breach (month + room + €) so sales/
// revenue managers see the actionable target, not generic prose.

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
  legacy_total_ex_email_ytd: number;
  honest_leakage_pct: number;
}
interface PointerRow {
  property_id: number;
  ota_top_month: string | null;    ota_top_room: string | null;    ota_top_eur: number | null;
  spread_top_month: string | null; spread_top_room: string | null; spread_top_eur: number | null;
  email_top_category: string | null; email_top_rn: number | null; email_top_adr: number | null; email_top_baseline: number | null; email_top_eur: number | null;
  phone_top_month: string | null;  phone_top_room: string | null;  phone_top_eur: number | null;
  bedbank_top_month: string | null; bedbank_top_room: string | null; bedbank_top_partner: string | null; bedbank_top_eur: number | null;
  top_addressable_channel: string | null; top_addressable_eur: number | null;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtMonth = (s: string | null) => {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})$/.exec(s);
  if (!m) return s;
  return `${MONTHS[parseInt(m[2], 10) - 1]} ${m[1]}`;
};
const fmtCcy = (n: number | null | undefined, ccy: 'USD' | 'EUR') => {
  if (n == null) return '—';
  const sym = ccy === 'EUR' ? '€' : '$';
  return `${sym}${Math.round(Number(n)).toLocaleString()}`;
};

export default async function LeakageYtdTiles({ propertyId }: Props) {
  const [rdRes, topRes, ptRes] = await Promise.all([
    supabase.from('v_rate_discipline_metrics').select('*').eq('property_id', propertyId).maybeSingle(),
    supabase.from('v_leakage_top_summary_v2').select('*').eq('property_id', propertyId).maybeSingle(),
    supabase.from('v_leakage_action_pointers').select('*').eq('property_id', propertyId).maybeSingle(),
  ]);
  const rd = (rdRes.data ?? null) as RdRow | null;
  const top = (topRes.data ?? null) as TopV2Row | null;
  const pt = (ptRes.data ?? null) as PointerRow | null;
  if (!rd && !top) return null;

  const ccy: 'USD' | 'EUR' = propertyId === 1000001 ? 'EUR' : 'USD';
  const yr = top?.yr ?? rd?.yr ?? new Date().getFullYear();

  const sevByPct = (pct: number) => (pct > 8 ? 'red' : pct > 3 ? 'amber' : 'green') as 'red' | 'amber' | 'green';
  const sevByAbs = (loss: number, rev: number = 1) => {
    const pct = rev > 0 ? (loss / rev) * 100 : 0;
    return sevByPct(pct);
  };
  // Sign-reversed: negative spread = direct cheaper than OTA = hotel wins margin.
  const sevBySpread = (spread: number): 'red' | 'amber' | 'green' => {
    if (spread < -2000) return 'green';
    if (spread > 2000) return 'red';
    return 'amber';
  };

  const netSpread = Number(top?.net_ota_web_spread_eur ?? 0);

  // Dynamic, action-oriented footnotes — one specific fix per tile
  const fnRevenue = `${yr} realised · YTD through today`;
  const fnAddressable = pt?.top_addressable_channel && pt?.top_addressable_eur
    ? `biggest fix: ${pt.top_addressable_channel} · ${fmtCcy(pt.top_addressable_eur, ccy)}`
    : 'sum of bedbank + OTA undercut + email + phone';
  const fnAddressablePct = `${fmtCcy(Number(top?.honest_leakage_ytd ?? 0), ccy)} ÷ revenue · honest formula`;
  const fnBedbank = pt?.bedbank_top_partner && pt?.bedbank_top_room
    ? `worst line: ${pt.bedbank_top_partner} · ${pt.bedbank_top_room} · ${fmtMonth(pt.bedbank_top_month)}`
    : 'sold below contracted floor';
  const fnOta = pt?.ota_top_month && pt?.ota_top_room
    ? `worst: ${fmtMonth(pt.ota_top_month)} · ${pt.ota_top_room} · ${fmtCcy(pt.ota_top_eur, ccy)} (${Math.round(Number(rd?.ota_parity_breach_rn ?? 0)).toLocaleString()} RN ytd)`
    : `${Math.round(Number(rd?.ota_parity_breach_rn ?? 0)).toLocaleString()} RN · OTAs sold below direct`;
  const fnSpread = netSpread < 0
    ? (pt?.spread_top_month && pt?.spread_top_room
        ? `winning most: ${fmtMonth(pt.spread_top_month)} · ${pt.spread_top_room} · ${fmtCcy(pt.spread_top_eur, ccy)}`
        : 'direct cheaper than OTA · margin-positive')
    : netSpread > 0
      ? 'website undercutting OTA · margin-leak'
      : 'direct ≈ OTA';
  const fnEmail = pt?.email_top_category
    ? `${pt.email_top_category} · ${(pt.email_top_rn ?? 0).toLocaleString()} RN @ ${fmtCcy(pt.email_top_adr, ccy)} vs baseline ${fmtCcy(pt.email_top_baseline, ccy)}`
    : `${Math.round(Number(rd?.email_breach_rn ?? 0)).toLocaleString()} RN · transient-only, occ-weighted`;
  const fnPhone = pt?.phone_top_month && pt?.phone_top_room
    ? `worst: ${fmtMonth(pt.phone_top_month)} · ${pt.phone_top_room} · ${fmtCcy(pt.phone_top_eur, ccy)}`
    : `${Math.round(Number(rd?.phone_breach_rn ?? 0)).toLocaleString()} RN · phone ADR below direct`;

  const tiles = [
    { label: 'Revenue YTD', value: Math.round(Number(top?.revenue_ytd ?? 0)), currency: ccy, footnote: fnRevenue, status: 'green' as const },
    { label: 'Addressable Rate Leakage', value: Math.round(Number(top?.honest_leakage_ytd ?? 0)), currency: ccy, footnote: fnAddressable, status: sevByPct(Number(top?.honest_leakage_pct ?? 0)) },
    { label: 'Addressable Leakage %', value: `${Number(top?.honest_leakage_pct ?? 0).toFixed(1)}%`, footnote: fnAddressablePct, status: sevByPct(Number(top?.honest_leakage_pct ?? 0)) },
    { label: 'Bedbank Leakage (below floor)', value: Math.round(Number(top?.bedbank_leakage_ytd ?? 0)), currency: ccy, footnote: fnBedbank, status: sevByAbs(Number(top?.bedbank_leakage_ytd ?? 0), Number(top?.revenue_ytd ?? 1)) },
    { label: 'OTA Undercut', value: Math.round(Number(top?.ota_undercut_ytd ?? 0)), currency: ccy, footnote: fnOta, status: sevByAbs(Number(top?.ota_undercut_ytd ?? 0), Number(top?.revenue_ytd ?? 1)) },
    { label: 'Net OTA/Web Spread', value: Math.round(netSpread), currency: ccy, footnote: fnSpread, status: sevBySpread(netSpread) },
    { label: 'Email ADR Gap (occ-adj)', value: Math.round(Number(top?.email_realistic_ytd ?? 0)), currency: ccy, footnote: fnEmail, status: sevByAbs(Number(top?.email_realistic_ytd ?? 0), Number(top?.revenue_ytd ?? 1)) },
    { label: 'Phone ADR Gap', value: Math.round(Number(top?.phone_leakage_ytd ?? 0)), currency: ccy, footnote: fnPhone, status: sevByAbs(Number(top?.phone_leakage_ytd ?? 0), Number(top?.revenue_ytd ?? 1)) },
  ];

  return (
    <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 6, padding: '2px 0 10px', borderBottom: '1px solid var(--hairline, #E6DFCC)' }}>
      <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)' }}>
        Headline · YTD {yr} · Revenue + honest leakage + 5 channel signals · each tile surfaces its biggest single driver
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
        {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
      </div>
    </div>
  );
}
