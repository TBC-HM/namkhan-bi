'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { KpiBox } from '@/components/kpi/KpiBox';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChannelRow {
  channel: string;
  room_nights: number | null;
  gross_revenue_usd: number | null;
  commission_usd: number | null;
  net_revenue_usd: number | null;
  adr_usd: number | null;
  share_pct: number | null;
}

// ---------------------------------------------------------------------------
// Supabase client (public anon — read-only, RLS applies)
// ---------------------------------------------------------------------------

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(value: number | null | undefined, prefix = ''): string {
  if (value == null) return '—';
  return `${prefix}${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function fmtPct(value: number | null | undefined): string {
  if (value == null) return '—';
  return `${value.toFixed(1)}%`;
}

function fmtNeg(value: number | null | undefined, prefix = ''): string {
  if (value == null) return '—';
  const formatted = `${prefix}${Math.abs(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  return value < 0 ? `\u2212${formatted}` : formatted; // U+2212 true minus
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ChannelsPage() {
  const [rows, setRows] = useState<ChannelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const { data, error } = await supabase
        .from('mv_channel_economics')
        .select('channel, room_nights, gross_revenue_usd, commission_usd, net_revenue_usd, adr_usd, share_pct')
        .order('gross_revenue_usd', { ascending: false });

      if (error) {
        setError(error.message);
      } else {
        setRows((data as ChannelRow[]) ?? []);
      }
      setLoading(false);
    }

    fetchData();
  }, []);

  // ---------------------------------------------------------------------------
  // Derived KPIs
  // ---------------------------------------------------------------------------

  const totalGross = rows.reduce((s, r) => s + (r.gross_revenue_usd ?? 0), 0);
  const totalNet   = rows.reduce((s, r) => s + (r.net_revenue_usd ?? 0), 0);
  const totalComm  = rows.reduce((s, r) => s + (r.commission_usd ?? 0), 0);
  const totalNights = rows.reduce((s, r) => s + (r.room_nights ?? 0), 0);
  const blendedAdr = totalNights > 0 ? totalGross / totalNights : null;
  const commPct    = totalGross > 0 ? (totalComm / totalGross) * 100 : null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <main style={{ padding: 'var(--space-6, 1.5rem)', fontFamily: 'var(--font-sans, sans-serif)' }}>
      <h1
        style={{
          fontSize: 'var(--t-2xl)',
          letterSpacing: 'var(--ls-extra)',
          color: 'var(--brass)',
          marginBottom: 'var(--space-6, 1.5rem)',
          textTransform: 'uppercase',
        }}
      >
        Channel Economics
      </h1>

      {/* KPI Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 'var(--space-4, 1rem)',
          marginBottom: 'var(--space-8, 2rem)',
        }}
      >
        <KpiBox label="Gross Revenue" value={fmt(totalGross, '$')} />
        <KpiBox label="Net Revenue"   value={fmt(totalNet, '$')} />
        <KpiBox label="Commission"    value={fmt(totalComm, '$')} />
        <KpiBox label="Room Nights"   value={fmt(totalNights)} />
        <KpiBox label="Blended ADR"   value={fmt(blendedAdr, '$')} />
        <KpiBox label="Commission %"  value={fmtPct(commPct)} />
      </div>

      {/* State: loading / error / empty */}
      {loading && (
        <p style={{ color: 'var(--muted)', fontSize: 'var(--t-sm)' }}>Loading channel data…</p>
      )}
      {!loading && error && (
        <p style={{ color: 'var(--danger)', fontSize: 'var(--t-sm)' }}>Error: {error}</p>
      )}
      {!loading && !error && rows.length === 0 && (
        <p style={{ color: 'var(--muted)', fontSize: 'var(--t-sm)' }}>No channel data available.</p>
      )}

      {/* Table */}
      {!loading && !error && rows.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 'var(--t-sm)',
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: '2px solid var(--brass)',
                  textAlign: 'left',
                  color: 'var(--brass)',
                  letterSpacing: 'var(--ls-extra)',
                  textTransform: 'uppercase',
                  fontSize: 'var(--t-xs)',
                }}
              >
                <th style={{ padding: '0.5rem 0.75rem' }}>Channel</th>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Room Nights</th>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Gross Rev</th>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Commission</th>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Net Rev</th>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>ADR</th>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Share</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.channel ?? i}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    backgroundColor: i % 2 === 0 ? 'transparent' : 'var(--surface-alt, rgba(0,0,0,0.02))',
                  }}
                >
                  <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>
                    {row.channel ?? '—'}
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                    {fmt(row.room_nights)}
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                    {fmt(row.gross_revenue_usd, '$')}
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: 'var(--danger)' }}>
                    {fmtNeg(row.commission_usd ? -row.commission_usd : null, '$')}
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                    {fmt(row.net_revenue_usd, '$')}
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                    {fmt(row.adr_usd, '$')}
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                    {fmtPct(row.share_pct)}
                  </td>
                </tr>
              ))}
            </tbody>

            {/* Totals footer */}
            <tfoot>
              <tr
                style={{
                  borderTop: '2px solid var(--brass)',
                  fontWeight: 700,
                  color: 'var(--brass)',
                }}
              >
                <td style={{ padding: '0.5rem 0.75rem' }}>Total</td>
                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{fmt(totalNights)}</td>
                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{fmt(totalGross, '$')}</td>
                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: 'var(--danger)' }}>
                  {fmtNeg(-totalComm, '$')}
                </td>
                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{fmt(totalNet, '$')}</td>
                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{fmt(blendedAdr, '$')}</td>
                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </main>
  );
}
