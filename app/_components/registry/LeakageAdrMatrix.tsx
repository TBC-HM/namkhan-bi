// app/_components/registry/LeakageAdrMatrix.tsx
// PBS 2026-05-26 (#252): ADR analytics matrix on /leakage.
// Rows = canonical room categories, Cols = ADR buckets (<200..>=2000),
// Cells = roomnight counts. Click a cell to drill into reservations.
// URL state: ?adr_month=YYYY-MM &adr_drill=ROOM:BUCKET

import { Container } from '@/app/(cockpit)/_design';
import { supabase } from '@/lib/supabase';

interface Props {
  propertyId: number;
  searchParams?: Record<string, string | string[] | undefined>;
}

interface MatrixRow {
  property_id: number;
  month_label: string;
  room_category: string;
  rn_lt_200: number;
  rn_lt_300: number;
  rn_lt_400: number;
  rn_lt_500: number;
  rn_lt_600: number;
  rn_lt_800: number;
  rn_lt_1000: number;
  rn_lt_1500: number;
  rn_lt_2000: number;
  rn_gte_2000: number;
  rn_total: number;
}

interface DrillRow {
  guest_name: string;
  source_name: string;
  rate_plan: string;
  nights: number;
  adr: number;
  total_amount: number;
  booking_window_days: number | null;
}

const BUCKETS: Array<{ key: keyof MatrixRow; col: string; label: string }> = [
  { key: 'rn_lt_200',  col: 'lt_200',  label: '< 200' },
  { key: 'rn_lt_300',  col: 'lt_300',  label: '< 300' },
  { key: 'rn_lt_400',  col: 'lt_400',  label: '< 400' },
  { key: 'rn_lt_500',  col: 'lt_500',  label: '< 500' },
  { key: 'rn_lt_600',  col: 'lt_600',  label: '< 600' },
  { key: 'rn_lt_800',  col: 'lt_800',  label: '< 800' },
  { key: 'rn_lt_1000', col: 'lt_1000', label: '< 1000' },
  { key: 'rn_lt_1500', col: 'lt_1500', label: '< 1500' },
  { key: 'rn_lt_2000', col: 'lt_2000', label: '< 2000' },
  { key: 'rn_gte_2000', col: 'gte_2000', label: '>= 2000' },
];

export default async function LeakageAdrMatrix({ propertyId, searchParams }: Props) {
  const ccy: '$' | '€' = propertyId === 1000001 ? '€' : '$';
  const todayMonth = new Date().toISOString().slice(0, 7);
  const selectedMonth = String(searchParams?.adr_month ?? todayMonth);
  const drill = String(searchParams?.adr_drill ?? '');

  // Fetch matrix rows for the property + selected month
  const { data: matrixData } = await supabase
    .from('v_adr_bucket_matrix')
    .select('*')
    .eq('property_id', propertyId)
    .eq('month_label', selectedMonth)
    .order('rn_total', { ascending: false });

  // Fetch available months for the dropdown (this property only)
  const { data: monthsData } = await supabase
    .from('v_adr_bucket_matrix')
    .select('month_label')
    .eq('property_id', propertyId)
    .order('month_label', { ascending: false });

  const months = Array.from(new Set((monthsData ?? []).map((r) => r.month_label as string)));
  const rows = (matrixData ?? []) as MatrixRow[];

  // Drill rows if user clicked a cell
  let drillRows: DrillRow[] = [];
  let drillRoom = '';
  let drillBucket = '';
  if (drill && drill.includes(':')) {
    const [r, b] = drill.split(':');
    drillRoom = r;
    drillBucket = b;
    const { data: drillData } = await supabase
      .from('v_adr_bucket_drill')
      .select('guest_name, source_name, rate_plan, nights, adr, total_amount, booking_window_days')
      .eq('property_id', propertyId)
      .eq('month_label', selectedMonth)
      .eq('room_category', drillRoom)
      .eq('bucket_key', drillBucket)
      .order('total_amount', { ascending: false })
      .limit(200);
    drillRows = (drillData ?? []) as DrillRow[];
  }

  const fullRow: React.CSSProperties = { gridColumn: '1 / -1' };

  const linkBase = (m: string, d?: string) => {
    const params = new URLSearchParams();
    params.set('adr_month', m);
    if (d) params.set('adr_drill', d);
    return `?${params.toString()}#adr-matrix`;
  };

  return (
    <div style={{ ...fullRow, display: 'flex', flexDirection: 'column', gap: 8 }} id="adr-matrix">
      <Container title="ADR Analytics · roomnight bucket matrix" subtitle={`month=${selectedMonth} · click any cell to drill into reservations`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 4px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)' }}>Month:</span>
          {months.slice(0, 36).map((m) => {
            const isActive = m === selectedMonth;
            return (
              <a key={m} href={linkBase(m)} style={{
                padding: '3px 9px', borderRadius: 4, border: '1px solid var(--hairline, #E6DFCC)',
                textDecoration: 'none', fontSize: 11,
                color: isActive ? 'var(--paper, #FFFFFF)' : 'var(--ink, #1B1B1B)',
                background: isActive ? 'var(--primary, #1F3A2E)' : 'transparent',
                fontWeight: isActive ? 600 : 400,
              }}>{m}</a>
            );
          })}
        </div>

        {rows.length === 0 ? (
          <div style={{ padding: 24, fontSize: 13, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>
            No reservation-night data for {selectedMonth}.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--hairline, #E6DFCC)' }}>
                  <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600 }}>Room category</th>
                  {BUCKETS.map((b) => (
                    <th key={b.key} style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 600, color: 'var(--ink-soft, #5A5A5A)' }}>
                      {ccy}{b.label}
                    </th>
                  ))}
                  <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 600, background: 'var(--surface-alt, #F4EFE0)' }}>Total RN</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.room_category} style={{ borderBottom: '1px solid var(--hairline, #E6DFCC)' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{r.room_category}</td>
                    {BUCKETS.map((b) => {
                      const val = Number(r[b.key] ?? 0);
                      if (val === 0) {
                        return <td key={b.key} style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--ink-faint, #B5B5B5)' }}>—</td>;
                      }
                      const drillKey = `${r.room_category}:${b.col}`;
                      const isActive = drill === drillKey;
                      return (
                        <td key={b.key} style={{ padding: '8px 10px', textAlign: 'right', background: isActive ? 'var(--primary, #1F3A2E)' : 'transparent' }}>
                          <a href={linkBase(selectedMonth, drillKey)} style={{
                            color: isActive ? 'var(--paper, #FFFFFF)' : 'var(--accent, #B8542A)',
                            textDecoration: 'underline', fontWeight: 600,
                          }}>{val}</a>
                        </td>
                      );
                    })}
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, background: 'var(--surface-alt, #F4EFE0)' }}>{r.rn_total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Container>

      {drill && (
        <Container title={`Drill · ${drillRoom} · ${BUCKETS.find(x => x.col === drillBucket)?.label ?? drillBucket} · ${selectedMonth}`} subtitle={`${drillRows.length} reservation${drillRows.length === 1 ? '' : 's'} · sorted by total revenue`}>
          {drillRows.length === 0 ? (
            <div style={{ padding: 24, fontSize: 13, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>
              No reservations in this bucket.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--hairline, #E6DFCC)' }}>
                    <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600 }}>Guest</th>
                    <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600 }}>Source</th>
                    <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600 }}>Rate plan</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 600 }}>Nights</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 600 }}>ADR</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 600 }}>Total</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 600 }}>Booking window</th>
                  </tr>
                </thead>
                <tbody>
                  {drillRows.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--hairline, #E6DFCC)' }}>
                      <td style={{ padding: '8px 10px' }}>{r.guest_name}</td>
                      <td style={{ padding: '8px 10px' }}>{r.source_name}</td>
                      <td style={{ padding: '8px 10px' }}>{r.rate_plan}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>{r.nights}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>{ccy}{Number(r.adr).toLocaleString()}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>{ccy}{Number(r.total_amount).toLocaleString()}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>{r.booking_window_days != null ? `${r.booking_window_days}d` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Container>
      )}
    </div>
  );
}
