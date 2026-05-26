// app/_components/registry/LeakageYtdTiles.tsx
// PBS 2026-05-27 (#255 + #256): 4 YTD loss tiles on top of /leakage,
// reading per-(room × month) breach detection from v_rate_discipline_metrics.

import { KpiTile } from '@/app/(cockpit)/_design';
import { supabase } from '@/lib/supabase';

interface Props { propertyId: number }

interface Row {
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

export default async function LeakageYtdTiles({ propertyId }: Props) {
  const { data } = await supabase
    .from('v_rate_discipline_metrics')
    .select('*')
    .eq('property_id', propertyId)
    .maybeSingle();

  const r = (data ?? null) as Row | null;
  if (!r) return null;

  const ccy: 'USD' | 'EUR' = propertyId === 1000001 ? 'EUR' : 'USD';

  const mk = (label: string, loss: number, rn: number, hint: string) => ({
    label,
    value: Math.round(Number(loss ?? 0)),
    currency: ccy,
    footnote: `YTD · ${Math.round(Number(rn ?? 0)).toLocaleString()} room-nights · ${hint}`,
    status: (Number(loss) > 50000 ? 'red' : Number(loss) > 10000 ? 'amber' : 'green') as 'red' | 'amber' | 'green',
  });

  const tiles = [
    mk('OTA Parity Loss', r.ota_parity_loss_eur, r.ota_parity_breach_rn, 'OTAs sold below Website rate'),
    mk('Website Discipline', r.website_self_loss_eur, r.website_self_breach_rn, 'Website undercut OTA rate'),
    mk('Email Leak', r.email_loss_eur, r.email_breach_rn, 'Email ADR below Website'),
    mk('Phone Leak', r.phone_loss_eur, r.phone_breach_rn, 'Phone ADR below Website'),
  ];

  return (
    <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 6, padding: '2px 0 10px', borderBottom: '1px solid var(--hairline, #E6DFCC)' }}>
      <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)' }}>
        Channel Leak · YTD {r.yr} · revenue lost vs Website baseline (per room category × month)
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
      </div>
    </div>
  );
}
