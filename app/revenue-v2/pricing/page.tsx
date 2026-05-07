import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── Types ──────────────────────────────────────────────────────────────────

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
  const sign = v < 0 ? '−' : '';
  return `${sign}$${Math.abs(v).toFixed(2)}`;
}

function fmtLak(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  const sign = v < 0 ? '−' : '';
  return `${sign}₭${Math.abs(Math.round(v)).toLocaleString()}`;
}

function fmtPct(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  const pct = v <= 1 ? v * 100 : v;
  return `${pct.toFixed(1)}%`;
}

// ─── Column config ───────────────────────────────────────────────────────────

type ColKey = keyof Omit<BarLadderRow, never>;

const COLUMNS: { key: ColKey; header: string }[] = [
  { key: 'stay_date',       header: 'Stay Date'   },
  { key: 'room_type',       header: 'Room Type'   },
  { key: 'bar_level',       header: 'BAR Level'   },
  { key: 'bar_rate_usd',    header: 'BAR (USD)'   },
  { key: 'bar_rate_lak',    header: 'BAR (LAK)'   },
  { key: 'occ_pct',         header: 'Occ %'       },
  { key: 'rooms_available', header: 'Avail'        },
  { key: 'rooms_sold',      header: 'Sold'         },
  { key: 'channel',         header: 'Channel'      },
  { key: 'notes',           header: 'Notes'        },
];

// ─── Cell renderer (top-level fn — safe for server components) ───────────────

function renderCell(row: BarLadderRow, key: ColKey): string {
  const v = row[key as string];
  if (key === 'bar_rate_usd') return fmtUsd(v as number | null);
  if (key === 'bar_rate_lak') return fmtLak(v as number | null);
  if (key === 'occ_pct')      return fmtPct(v as number | null);
  return dash(v);
}

// ─── Data fetch ──────────────────────────────────────────────────────────────

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

// ─── KPI helpers (top-level — avoids lambda-in-JSX complexity) ───────────────

function avgUsd(rows: BarLadderRow[]): string {
  if (!rows.length) return '—';
  const sum = rows.reduce((s, r) => s + (r.bar_rate_usd ?? 0), 0);
  return fmtUsd(sum / rows.length);
}

function avgOcc(rows: BarLadderRow[]): string {
  if (!rows.length) return '—';
  const sum = rows.reduce((s, r) => s + (r.occ_pct ?? 0), 0);
  return fmtPct(sum / rows.length);
}

function totalAvail(rows: BarLadderRow[]): string {
  const sum = rows.reduce((s, r) => s + (r.rooms_available ?? 0), 0);
  return sum === 0 ? '—' : String(sum);
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function PricingPage() {
  const rows = await fetchBarLadder();

  return (
    <main style={{ padding: '24px', background: 'var(--surface-1, #0a0a0a)', minHeight: '100vh', color: 'var(--text-1, #f5f5f5)' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{
          fontFamily: "'Fraunces', serif",
          fontStyle: 'italic',
          fontSize: 'var(--t-2xl, 1.75rem)',
          color: 'var(--brass, #b8973a)',
          margin: 0,
        }}>
          BAR Ladder — Pricing
        </h1>
        <p style={{ fontSize: 'var(--t-sm, 0.75rem)', color: 'var(--text-2, #a0a0a0)', marginTop: 6 }}>
          Source: public.v_bar_ladder · {rows.length} rows · live
        </p>
      </div>

      {/* ── KPI strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
        {(
          [
            { label: 'Total Rows',       value: String(rows.length) },
            { label: 'Avg BAR (USD)',     value: avgUsd(rows)        },
            { label: 'Avg Occ %',        value: avgOcc(rows)        },
            { label: 'Rooms Available',  value: totalAvail(rows)    },
          ] as { label: string; value: string }[]
        ).map((kpi) => (
          <div key={kpi.label} style={{
            background: 'var(--surface-2, #1a1a1a)',
            border: '1px solid var(--border, #2a2a2a)',
            borderRadius: 8,
            padding: '14px 18px',
          }}>
            <div style={{ fontSize: 'var(--t-sm, 0.75rem)', color: 'var(--text-2, #a0a0a0)', marginBottom: 4 }}>
              {kpi.label}
            </div>
            <div style={{ fontSize: 'var(--t-lg, 1.25rem)', fontWeight: 600, color: 'var(--brass, #b8973a)' }}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* ── Table ── */}
      {rows.length === 0 ? (
        <p style={{ color: 'var(--text-2, #a0a0a0)', fontStyle: 'italic' }}>
          No data returned from v_bar_ladder. Check view exists and is populated.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 'var(--t-sm, 0.8rem)',
          }}>
            <thead>
              <tr>
                {COLUMNS.map((col) => (
                  <th key={col.key as string} style={{
                    textAlign: 'left',
                    padding: '10px 12px',
                    borderBottom: '1px solid var(--border, #2a2a2a)',
                    color: 'var(--text-2, #a0a0a0)',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                  }}>
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border, #1e1e1e)' }}>
                  {COLUMNS.map((col) => (
                    <td key={col.key as string} style={{
                      padding: '9px 12px',
                      color: col.key === 'stay_date' ? 'var(--text-1, #f5f5f5)' : 'var(--text-2, #c0c0c0)',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
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
