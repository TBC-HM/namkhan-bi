// app/_components/registry/GrossShareByTier.tsx
// PBS 2026-05-29 — Full-page primitive at the bottom of /channels.
// Replaces the deactivated channel_economics container.
// Title: "Gross Revenue Share by Tier" · Subtitle: "Share of gross by channel tier · {scope}"
// Month dropdown in the Container action slot (URL: ?gst_month=YYYY-MM or absent = all months).

import { Container, Chart } from '@/app/(cockpit)/_design';
import { supabase } from '@/lib/supabase';
import ChannelGstMonthDropdown from './ChannelGstMonthDropdown';

interface Props {
  propertyId: number;
  searchParams?: Record<string, string | string[] | undefined>;
}

interface Row {
  property_id: number;
  month_label: string;
  tier: string;
  gross_revenue: number;
  reservations: number;
  room_nights: number;
  gross_share_pct: number;
  adr: number;
}

const TIER_COLORS: Record<string, string> = {
  Direct: '#1F3A2E', OTA: '#B8542A', Wholesale: '#B8A878',
  Other: '#9C9C9C', 'Walk-In': '#5B7A5A', Internal: '#3A7CA5', Corporate: '#8A2A1D',
};

export default async function GrossShareByTier({ propertyId, searchParams }: Props) {
  const { data: rows } = await supabase
    .from('v_gross_share_by_tier_monthly')
    .select('*')
    .eq('property_id', propertyId);
  const allRows = (rows ?? []) as Row[];
  const months = Array.from(new Set(allRows.map((r) => r.month_label))).sort();

  const requested = String(searchParams?.gst_month ?? 'all');
  const selectedMonth = requested === 'all'
    ? 'all'
    : (months.includes(requested) ? requested : 'all');

  // Aggregate: either the single selected month, or sum across all months.
  const aggMap = new Map<string, { tier: string; gross_revenue: number; reservations: number; room_nights: number }>();
  for (const r of allRows) {
    if (selectedMonth !== 'all' && r.month_label !== selectedMonth) continue;
    const slot = aggMap.get(r.tier) ?? { tier: r.tier, gross_revenue: 0, reservations: 0, room_nights: 0 };
    slot.gross_revenue += Number(r.gross_revenue ?? 0);
    slot.reservations += Number(r.reservations ?? 0);
    slot.room_nights += Number(r.room_nights ?? 0);
    aggMap.set(r.tier, slot);
  }
  const totalRevenue = Array.from(aggMap.values()).reduce((s, r) => s + r.gross_revenue, 0);
  const tierData = Array.from(aggMap.values())
    .map((r) => ({
      tier: r.tier,
      gross_revenue: r.gross_revenue,
      gross_share_pct: totalRevenue > 0 ? Math.round((r.gross_revenue / totalRevenue) * 1000) / 10 : 0,
      reservations: r.reservations,
      room_nights: r.room_nights,
      adr: r.room_nights > 0 ? Math.round(r.gross_revenue / r.room_nights) : 0,
    }))
    .sort((a, b) => b.gross_share_pct - a.gross_share_pct);

  const action = (
    <ChannelGstMonthDropdown
      selectedMonth={selectedMonth}
      months={months}
    />
  );

  const subtitleSuffix = selectedMonth === 'all' ? '· all months on file' : `· ${selectedMonth}`;
  const thStyle: React.CSSProperties = { textAlign: 'left', padding: '7px 12px', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)', borderBottom: '1px solid var(--hairline, #E6DFCC)' };
  const thR: React.CSSProperties = { ...thStyle, textAlign: 'right' };
  const tdL: React.CSSProperties = { padding: '6px 12px', fontSize: 12 };
  const tdR: React.CSSProperties = { padding: '6px 12px', fontSize: 12, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };

  return (
    <div style={{ gridColumn: '1 / -1', marginTop: 12 }} id="gst-tier">
      <Container
        title="Gross Revenue Share by Tier"
        subtitle={`Share of gross by channel tier ${subtitleSuffix}`}
        action={action}
      >
        <div style={{ padding: 12 }}>
          <Chart
            variant="bar"
            data={tierData}
            xKey="tier"
            series={[{ key: 'gross_share_pct', label: 'Share of gross (%)', color: '#1F3A2E' }]}
            height={240}
            empty={{ title: 'No tier data for this period' }}
            formatY={(v: number) => `${Number(v).toFixed(1)}%`}
          />
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 12 }}>
            <thead>
              <tr style={{ background: '#FAFAF7' }}>
                <th style={thStyle}>Tier</th>
                <th style={thR}>Share %</th>
                <th style={thR}>Gross Rev</th>
                <th style={thR}>Reservations</th>
                <th style={thR}>Room Nights</th>
                <th style={thR}>ADR</th>
              </tr>
            </thead>
            <tbody>
              {tierData.map((r) => {
                const color = TIER_COLORS[r.tier] ?? '#5A5A5A';
                return (
                  <tr key={r.tier} style={{ borderTop: '1px solid var(--hairline, #E6DFCC)' }}>
                    <td style={tdL}>
                      <span style={{ display: 'inline-block', width: 8, height: 8, background: color, borderRadius: 2, marginRight: 8, verticalAlign: 'middle' }} />
                      <strong>{r.tier}</strong>
                    </td>
                    <td style={{ ...tdR, fontWeight: 600 }}>{r.gross_share_pct.toFixed(1)}%</td>
                    <td style={tdR}>{r.gross_revenue.toLocaleString()}</td>
                    <td style={tdR}>{r.reservations.toLocaleString()}</td>
                    <td style={tdR}>{r.room_nights.toLocaleString()}</td>
                    <td style={tdR}>{r.adr.toLocaleString()}</td>
                  </tr>
                );
              })}
              {tierData.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 16, fontStyle: 'italic', color: 'var(--ink-soft, #5A5A5A)', textAlign: 'center' }}>
                    No tier data for this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Container>
    </div>
  );
}
