'use client';

// app/finance/usali/page.tsx
// Ticket #195 — Finance · USALI — adapt + wire
// Wired to: v_pl_monthly_usali (finance schema, falls back to public schema)

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
interface UsaliRow {
  period_label?: string | null;
  department?: string | null;
  revenue?: number | null;
  expenses?: number | null;
  gross_profit?: number | null;
  gop?: number | null;
  gop_pct?: number | null;
  rooms_revenue?: number | null;
  fb_revenue?: number | null;
  other_revenue?: number | null;
  payroll?: number | null;
  undistributed?: number | null;
  ebitda?: number | null;
  [key: string]: unknown;
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function fmt(v: number | null | undefined, prefix = ''): string {
  if (v == null) return '—';
  const abs = Math.abs(v);
  const formatted =
    abs >= 1_000_000
      ? `${prefix}${(abs / 1_000_000).toFixed(2)}M`
      : abs >= 1_000
      ? `${prefix}${(abs / 1_000).toFixed(1)}K`
      : `${prefix}${abs.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
  return v < 0 ? `\u2212${formatted}` : formatted;
}

function pct(v: number | null | undefined): string {
  if (v == null) return '—';
  return `${(v * 100).toFixed(1)}%`;
}

// ──────────────────────────────────────────────
// KPI tile
// ──────────────────────────────────────────────
function KpiTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div
      style={{
        background: '#0f1117',
        border: '1px solid #1e2230',
        borderRadius: 8,
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <span
        style={{
          fontSize: 11,
          color: '#6b7280',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: '#f9fafb',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
      {sub && (
        <span style={{ fontSize: 11, color: '#9ca3af' }}>{sub}</span>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────
export default function UsaliPage() {
  const [rows, setRows] = useState<UsaliRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    void (async () => {
      // Try public schema first (most common setup)
      const { data, error: err } = await supabase
        .from('v_pl_monthly_usali')
        .select('*')
        .order('period_label', { ascending: false })
        .limit(24);

      if (err) {
        setError(err.message);
      } else {
        setRows((data ?? []) as UsaliRow[]);
      }
      setLoading(false);
    })();
  }, []);

  // ── Aggregate KPIs from loaded rows ──
  const latest = rows[0] ?? null;
  const totalRevenue = rows.reduce((s, r) => s + (r.revenue ?? 0), 0);
  const totalGOP = rows.reduce((s, r) => s + (r.gop ?? 0), 0);
  const totalPayroll = rows.reduce((s, r) => s + (r.payroll ?? 0), 0);
  const totalEbitda = rows.reduce((s, r) => s + (r.ebitda ?? 0), 0);

  // Dynamic columns from first row
  const colKeys: string[] =
    rows.length > 0
      ? Object.keys(rows[0]).filter((k) => k !== '__typename')
      : [
          'period_label',
          'department',
          'revenue',
          'expenses',
          'gop',
          'gop_pct',
          'payroll',
          'ebitda',
        ];

  const LABELS: Record<string, string> = {
    period_label: 'Period',
    department: 'Department',
    revenue: 'Revenue',
    rooms_revenue: 'Rooms Rev',
    fb_revenue: 'F&B Rev',
    other_revenue: 'Other Rev',
    expenses: 'Expenses',
    gross_profit: 'Gross Profit',
    gop: 'GOP',
    gop_pct: 'GOP %',
    payroll: 'Payroll',
    undistributed: 'Undistributed',
    ebitda: 'EBITDA',
  };

  function renderCell(key: string, row: UsaliRow): string {
    const v = row[key];
    if (v == null) return '—';
    if (key === 'gop_pct') return pct(v as number);
    if (typeof v === 'number')
      return fmt(
        v,
        ['revenue', 'rooms_revenue', 'fb_revenue', 'other_revenue', 'gop', 'ebitda', 'payroll', 'expenses', 'gross_profit', 'undistributed'].includes(
          key
        )
          ? '$'
          : ''
      );
    return String(v);
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#060810',
        color: '#f9fafb',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          borderBottom: '1px solid #1e2230',
          padding: '24px 32px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              color: '#6b7280',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 4,
            }}
          >
            Finance · USALI
          </div>
          <h1
            style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#f9fafb' }}
          >
            P&amp;L — Monthly USALI
          </h1>
        </div>
        {latest?.period_label && (
          <span
            style={{
              fontSize: 12,
              color: '#9ca3af',
              background: '#1e2230',
              borderRadius: 6,
              padding: '4px 10px',
            }}
          >
            Latest: {latest.period_label}
          </span>
        )}
      </div>

      <div style={{ padding: '24px 32px' }}>
        {/* ── KPI Row ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 16,
            marginBottom: 28,
          }}
        >
          <KpiTile
            label="Total Revenue"
            value={fmt(totalRevenue, '$')}
            sub="all periods loaded"
          />
          <KpiTile
            label="Total GOP"
            value={fmt(totalGOP, '$')}
            sub={latest ? `${pct(latest.gop_pct)} GOP margin` : undefined}
          />
          <KpiTile label="Total Payroll" value={fmt(totalPayroll, '$')} />
          <KpiTile label="Total EBITDA" value={fmt(totalEbitda, '$')} />
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div
            style={{
              color: '#6b7280',
              padding: '40px 0',
              textAlign: 'center',
            }}
          >
            Loading USALI data…
          </div>
        )}

        {/* ── Error ── */}
        {!loading && error && (
          <div
            style={{
              background: '#1a0a0a',
              border: '1px solid #7f1d1d',
              borderRadius: 8,
              padding: '16px 20px',
              color: '#fca5a5',
              marginBottom: 20,
            }}
          >
            ⚠ Could not load <code>v_pl_monthly_usali</code>: {error}
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && rows.length === 0 && !error && (
          <div
            style={{
              color: '#6b7280',
              padding: '40px 0',
              textAlign: 'center',
            }}
          >
            No USALI data found for this property.
          </div>
        )}

        {/* ── Data table ── */}
        {rows.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 13,
                color: '#e5e7eb',
              }}
            >
              <thead>
                <tr style={{ borderBottom: '2px solid #1e2230' }}>
                  {colKeys.map((k) => (
                    <th
                      key={k}
                      style={{
                        textAlign: 'left',
                        padding: '10px 12px',
                        color: '#6b7280',
                        fontWeight: 600,
                        fontSize: 11,
                        textTransform: 'uppercase',
                        letterSpacing: '0.07em',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {LABELS[k] ?? k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={i}
                    style={{
                      borderBottom: '1px solid #12151e',
                      background: i % 2 === 0 ? 'transparent' : '#0b0e18',
                    }}
                  >
                    {colKeys.map((k) => (
                      <td
                        key={k}
                        style={{
                          padding: '9px 12px',
                          whiteSpace: 'nowrap',
                          color:
                            k === 'period_label' || k === 'department'
                              ? '#f9fafb'
                              : typeof row[k] === 'number' &&
                                (row[k] as number) < 0
                              ? '#f87171'
                              : '#e5e7eb',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {renderCell(k, row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
