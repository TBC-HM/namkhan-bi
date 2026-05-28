// app/_components/registry/LeakageAdrMatrix.tsx
// PBS 2026-05-28: renamed "ADR Analytics" → "Price Spread". All canonical
// room categories now render (even when 0 RN in the selected month — shown
// as em-dashes). Month picker is a dropdown in the Container action slot.
// OTHER category excluded from the display.
//
// URL state: ?adr_month=YYYY-MM &adr_drill=ROOM:BUCKET

import { Container } from '@/app/(cockpit)/_design';
import { supabase } from '@/lib/supabase';
import AdrMonthDropdown from './AdrMonthDropdown';

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

const CATEGORY_ORDER = ['DBL', 'JR_SUITE', 'SUITE', 'PENTHOUSE', 'VILLA', 'GLAMPING'];

const FRIENDLY_CAT: Record<string, string> = {
  DBL: 'Double', JR_SUITE: 'Junior Suite', SUITE: 'Suite',
  PENTHOUSE: 'Penthouse', VILLA: 'Villa', GLAMPING: 'Glamping',
};

export default async function LeakageAdrMatrix({ propertyId, searchParams }: Props) {
  const ccy: '$' | '€' = propertyId === 1000001 ? '€' : '$';
  const todayMonth = new Date().toISOString().slice(0, 7);
  const selectedMonth = String(searchParams?.adr_month ?? todayMonth);
  const drill = String(searchParams?.adr_drill ?? '');

  // 1. Matrix rows for the selected month
  const { data: matrixData } = await supabase
    .from('v_adr_bucket_matrix')
    .select('*')
    .eq('property_id', propertyId)
    .eq('month_label', selectedMonth)
    .order('rn_total', { ascending: false });

  // 2. All distinct months for this property — drives the dropdown
  const { data: monthsData } = await supabase
    .from('v_adr_bucket_matrix')
    .select('month_label')
    .eq('property_id', propertyId)
    .order('month_label', { ascending: false });

  // 3. All distinct categories EVER seen for this property (so empty months
  //    still render a row per category with em-dashes — PBS 2026-05-28).
  const { data: catData } = await supabase
    .from('v_adr_bucket_matrix')
    .select('room_category')
    .eq('property_id', propertyId);

  const months = Array.from(new Set((monthsData ?? []).map((r) => r.month_label as string)));
  const rows = (matrixData ?? []) as MatrixRow[];
  const rowByCategory = new Map<string, MatrixRow>();
  for (const r of rows) rowByCategory.set(r.room_category, r);

  // Build the canonical category list — exclude OTHER (data-quality noise),
  // sort by canonical order, then alpha for any unknowns.
  const seenCats = Array.from(new Set(((catData ?? []) as Array<{ room_category: string }>).map((r) => r.room_category)))
    .filter((c) => c && c !== 'OTHER');
  const allCategories = seenCats.sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a); const ib = CATEGORY_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  // 4. Drill if requested
  let drillRows: DrillRow[] = [];
  let drillRoom = '';
  let drillBucket = '';
  if (drill && drill.includes(':')) {
    const [r, b] = drill.split(':');
    drillRoom = r; drillBucket = b;
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

  const dropdownAction = (
    <AdrMonthDropdown
      selectedMonth={selectedMonth}
      months={months}
      preserveParams={{ adr_drill: drill || undefined }}
    />
  );

  return (
    <div style={{ ...fullRow, display: 'flex', flexDirection: 'column', gap: 8 }} id="adr-matrix">
      <Container
        title="Price Spread"
        subtitle={`Room-night counts by ADR bucket · ${selectedMonth} · click any cell to drill into reservations`}
        action={dropdownAction}
      >
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
              {allCategories.map((cat) => {
                const r = rowByCategory.get(cat);
                const hasData = !!r;
                return (
                  <tr key={cat} style={{ borderBottom: '1px solid var(--hairline, #E6DFCC)', opacity: hasData ? 1 : 0.55 }}>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--ink-soft, #5A5A5A)' }}>{cat}</span>
                      {FRIENDLY_CAT[cat] && (
                        <span style={{ marginLeft: 6, fontWeight: 500, color: 'var(--ink, #1B1B1B)' }}>· {FRIENDLY_CAT[cat]}</span>
                      )}
                    </td>
                    {BUCKETS.map((b) => {
                      if (!hasData) {
                        return <td key={b.key} style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--ink-faint, #B5B5B5)' }}>—</td>;
                      }
                      const val = Number(r![b.key] ?? 0);
                      if (val === 0) {
                        return <td key={b.key} style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--ink-faint, #B5B5B5)' }}>—</td>;
                      }
                      const drillKey = `${cat}:${b.col}`;
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
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, background: 'var(--surface-alt, #F4EFE0)' }}>
                      {hasData ? r!.rn_total : <span style={{ color: 'var(--ink-faint, #B5B5B5)' }}>—</span>}
                    </td>
                  </tr>
                );
              })}
              {allCategories.length === 0 && (
                <tr>
                  <td colSpan={BUCKETS.length + 2} style={{ padding: 24, fontSize: 13, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic', textAlign: 'center' }}>
                    No reservation-night data on file for this property.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
