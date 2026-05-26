// app/_components/registry/LeakageYtdTiles.tsx
// PBS 2026-05-27 (#255): 4 KPI tiles at top of /leakage showing YTD loss per channel.

import { KpiTile } from '@/app/(cockpit)/_design';
import { supabase } from '@/lib/supabase';

interface Props { propertyId: number }

interface Row {
  property_id: number;
  yr: number;
  ota_parity_loss_ytd: number;
  website_discipline_loss_ytd: number;
  email_leak_ytd: number;
  phone_leak_ytd: number;
}

export default async function LeakageYtdTiles({ propertyId }: Props) {
  const { data } = await supabase
    .from('v_ytd_channel_leak')
    .select('*')
    .eq('property_id', propertyId)
    .maybeSingle();

  const r = (data ?? null) as Row | null;
  if (!r) return null;

  const ccy: 'USD' | 'EUR' = propertyId === 1000001 ? 'EUR' : 'USD';

  const tiles = [
    {
      label: 'OTA Parity Loss',
      value: Math.round(Number(r.ota_parity_loss_ytd ?? 0)),
      currency: ccy,
      footnote: 'YTD · OTAs selling below Website',
      status: Number(r.ota_parity_loss_ytd) > 50000 ? 'red' as const : Number(r.ota_parity_loss_ytd) > 10000 ? 'amber' as const : 'green' as const,
    },
    {
      label: 'Website Discipline',
      value: Math.round(Number(r.website_discipline_loss_ytd ?? 0)),
      currency: ccy,
      footnote: 'YTD · self-undercut vs OTA',
      status: Number(r.website_discipline_loss_ytd) > 25000 ? 'red' as const : Number(r.website_discipline_loss_ytd) > 5000 ? 'amber' as const : 'green' as const,
    },
    {
      label: 'Email Leak',
      value: Math.round(Number(r.email_leak_ytd ?? 0)),
      currency: ccy,
      footnote: 'YTD · Email ADR below Website',
      status: Number(r.email_leak_ytd) > 50000 ? 'red' as const : Number(r.email_leak_ytd) > 10000 ? 'amber' as const : 'green' as const,
    },
    {
      label: 'Phone Leak',
      value: Math.round(Number(r.phone_leak_ytd ?? 0)),
      currency: ccy,
      footnote: 'YTD · Phone ADR below Website',
      status: Number(r.phone_leak_ytd) > 50000 ? 'red' as const : Number(r.phone_leak_ytd) > 10000 ? 'amber' as const : 'green' as const,
    },
  ];

  return (
    <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 6, padding: '2px 0 10px', borderBottom: '1px solid var(--hairline, #E6DFCC)' }}>
      <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)' }}>
        Channel Leak · YTD {r.yr} · estimated revenue lost vs Website baseline
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
      </div>
    </div>
  );
}
