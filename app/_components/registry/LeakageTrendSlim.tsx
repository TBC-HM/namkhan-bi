// app/_components/registry/LeakageTrendSlim.tsx
// PBS 2026-05-27 (#258): slim full-page-width Leakage Trend chart — monthly total leakage since opening.

import { Container, Chart } from '@/app/(cockpit)/_design';
import { supabase } from '@/lib/supabase';

interface Props { propertyId: number }

interface Row {
  property_id: number;
  month_label: string;
  yr: number;
  total_leakage: number;
  ota_parity_loss: number;
  website_self_loss: number;
  email_loss: number;
  phone_loss: number;
}

export default async function LeakageTrendSlim({ propertyId }: Props) {
  const { data } = await supabase
    .from('v_leakage_monthly_total')
    .select('*')
    .eq('property_id', propertyId)
    .gte('month_label', '2024-01')
    .order('month_label', { ascending: true });

  const rows = (data ?? []) as Row[];
  const chartData = rows.map((r) => ({
    month: r.month_label,
    total: Math.round(Number(r.total_leakage ?? 0)),
    ota: Math.round(Number(r.ota_parity_loss ?? 0)),
    website: Math.round(Number(r.website_self_loss ?? 0)),
    email: Math.round(Number(r.email_loss ?? 0)),
    phone: Math.round(Number(r.phone_loss ?? 0)),
  }));

  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <Container title="Leakage Trend" subtitle="monthly total leakage · since 2024-01 · all 4 channel categories combined">
        <Chart
          variant="bar"
          data={chartData}
          xKey="month"
          series={[
            { key: 'total',   label: 'Total leakage', color: '#B83A3A' },
            { key: 'email',   label: 'Email',         color: '#B8542A' },
            { key: 'website', label: 'Website self',  color: '#B8A878' },
            { key: 'ota',     label: 'OTA parity',    color: '#1F3A2E' },
            { key: 'phone',   label: 'Phone',         color: '#6E8B65' },
          ]}
          height={200}
          empty={{ title: 'No leakage data yet' }}
        />
      </Container>
    </div>
  );
}
