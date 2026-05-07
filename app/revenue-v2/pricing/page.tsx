import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── Types ───────────────────────────────────────────────────────────────────
interface BarLadderRow {
  stay_date?: string | null;
  room_type?: string | null;
  bar_level?: string | null;
  bar_rate_usd?: number | null;
  bar_rate_lak?: number | null;
  occ_pct?: number | null;
  rooms_available?: number | null;
  rooms_sold?: number | null;
  channel?: string | null;
  notes?: string | null;
  [key: string]: unknown;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function dash(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
}

function fmtUsd(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  const sign = v < 0 ? '\u2212' : '';
  return `${sign}$${Math.abs(v).toFixed(2)}`;
}

function fmtLak(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  const sign = v < 0 ? '\u2212' : '';
  return `${sign}₭${Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function fmtPct(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  const pct = v <= 1 ? v * 100 : v;
  return `${pct.toFixed(1)}%`;
}

// ─── Data fetcher (server-side, service role) ─────────────────────────────────
async function fetchBarLadder(): Promise<BarLadderRow[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const { data, error } = await supabase
    .from('v_bar_ladder')
    .select('*')
    .order('stay_date', { ascending: true })
    .limit(120);

  if (error) {
    console.error('[pricing/page] v_bar_ladder error:', error.message);
    return [];
  }
  return (data ?? []) as BarLadderRow[];
}

// ─── Column config ────────────────────────────────────────────────────────────
const COLUMNS: { key: keyof BarLadderRow; header: string }[] = [
  { key: 'stay_date', header: 'Stay Date' },
  { key: 'room_type', header: 'Room Type' },
  { key: 'bar_level', header: 'BAR Level' },
  { key: 'bar_rate_usd', header: 'BAR (USD)' },
  { key: 'bar_rate_lak', header: 'BAR (LAK)' },
  { key: 'occ_pct', header: 'Occ %' },
  { key: 'rooms_available', header: 'Avail' },
  { key: 'rooms_sold', header: 'Sold' },
  { key: 'channel', header: 'Channel' },
  { key: 'notes', header: 'Notes' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function PricingPage() {
  const rows = await fetchBarLadder();

  function renderCell(row: BarLadderRow, key: keyof BarLadderRow): string {
    const v = row[key];
    if (key === 'bar_rate_usd') return fmtUsd(v as number | null);
    if (key === 'bar_rate_lak') return fmtLak(v as number | null);
    if (key === 'occ_pct') return fmtPct(v as number | null);
    return dash(v);
  }

  return (
    <main style={{ padding: '24px 32px' }}>
      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontFamily: 'Fraunces, serif',
            fontStyle: 'italic',
            color: 'var(--brass)',
            fontSize: 'var(--t-2xl)',
            margin: 0,
          }}
        >
          BAR Ladder — Pricing
        </h1>
        <p style={{ fontSize: 'var(--t-sm)', color: 'var(--muted)', marginTop: 4 }}>
          Source: public.v_bar_ladder · {rows.length} rows · live
        </p>
      </div>

      {/* ── KPI strip ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 32,
        }}
      >
        {[
          { label: 'Total Rows', value: String(rows.length) },
          {
            label: 'Avg BAR (USD)',
            value: fmtUsd(
              rows.length
                ? rows.reduce((s, r) => s + (r.bar_rate_usd ?? 0), 0) / rows.length
                : null,
            ),
          },
          {
            label: 'Avg Occ %',
            value: fmtPct(
              rows.length
                ? rows.reduce((s, r) => s + (r.occ_pct ?? 0), 0) / rows.length
                : null,
            ),
          },
          {
            label: 'Rooms Available',
            value: dash(rows.reduce((s, r) => s + (r.rooms_available ?? 0), 0) || null),
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '16px 20px',
            }}
          >
            <div style={{ fontSize: 'var(--t-sm)', color: 'var(--muted)', marginBottom: 4 }}>
              {kpi.label}
            </div>
            <div
              style={{
                fontSize: 'var(--t-2xl)',
                fontWeight: 600,
                color: 'var(--foreground)',
              }}
            >
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* ── Table ── */}
      {rows.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 'var(--t-sm)' }}>
          No data returned from v_bar_ladder. Check view exists and is populated.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 'var(--t-sm)',
            }}
          >
            <thead>
              <tr>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key as string}
                    style={{
                      textAlign: 'left',
                      padding: '10px 12px',
                      borderBottom: '2px solid var(--border)',
                      color: 'var(--muted)',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={i}
                  style={{
                    background: i % 2 === 0 ? 'var(--surface)' : 'transparent',
                  }}
                >
                  {COLUMNS.map((col) => (
                    <td
                      key={col.key as string}
                      style={{
                        padding: '9px 12px',
                        borderBottom: '1px solid var(--border)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {renderCell(row, col.key)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
