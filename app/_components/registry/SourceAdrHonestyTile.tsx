// app/_components/registry/SourceAdrHonestyTile.tsx
// Brief leakage-source-adr-honesty-tile (goal 41): expose blended vs transient-paid
// ADR per source. Blended ADR lies when comp/group/wholesale RN hide inside a
// channel — this tile shows the top offenders (ABS(gap) >= 20, RN >= 50).
// Mounted via PageRenderer's kpiStrip slot on /h/[property_id]/revenue/leakage.
// Data: public.v_source_adr_kpi (values in property PMS currency: USD 260955 / EUR 1000001).
// Year state: ?sa_yr=YYYY (RateDisciplineTrio pill pattern), default = current year in property TZ.

import { Container } from '@/app/(cockpit)/_design';
import { supabase } from '@/lib/supabase';

interface Props {
  propertyId: number;
  searchParams?: Record<string, string | string[] | undefined>;
}

interface Row {
  property_id: number;
  yr: number;
  source_name: string;
  total_rn: number | string;
  blended_adr: number | null;
  real_adr: number | null;
  lift_gap_eur: number | null;
  pct_comp: number | string | null;
  pct_group: number | string | null;
  pct_wholesale: number | string | null;
  pct_transient: number | string | null;
}

const GAP_THRESHOLD = 20; // native unit per property (USD Namkhan / EUR Donna)
const RN_THRESHOLD = 50;

function propertyYearNow(propertyId: number): number {
  const tz = propertyId === 1000001 ? 'Europe/Madrid' : 'Asia/Vientiane';
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric' }).format(new Date()));
}

function fmtMoney(n: number, sym: string): string {
  return `${sym}${Math.round(n).toLocaleString('en-US')}`;
}

export default async function SourceAdrHonestyTile({ propertyId, searchParams }: Props) {
  const sym: '$' | '€' = propertyId === 1000001 ? '€' : '$';
  const defaultYr = propertyYearNow(propertyId);
  const saYrRaw = String(searchParams?.sa_yr ?? defaultYr);
  const saYr = /^20\d{2}$/.test(saYrRaw) ? Number(saYrRaw) : defaultYr;

  const { data, error } = await supabase
    .from('v_source_adr_kpi')
    .select('*')
    .eq('property_id', propertyId)
    .eq('yr', saYr);

  if (error) return null;
  const rows = (data ?? []) as Row[];

  const qualifying = rows
    .filter((r) =>
      Number(r.total_rn) >= RN_THRESHOLD &&
      r.lift_gap_eur !== null &&
      Math.abs(Number(r.lift_gap_eur)) >= GAP_THRESHOLD)
    .sort((a, b) => Math.abs(Number(b.lift_gap_eur)) - Math.abs(Number(a.lift_gap_eur)))
    .slice(0, 3);

  // Fully-contaminated source (no transient-paid baseline): largest by RN, if any.
  const noBaseline = rows
    .filter((r) => Number(r.total_rn) >= RN_THRESHOLD && (r.real_adr === null || r.lift_gap_eur === null))
    .sort((a, b) => Number(b.total_rn) - Number(a.total_rn))[0];

  if (qualifying.length === 0 && !noBaseline) return null;

  const yearPills = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)' }}>Year:</span>
      {(['2024', '2025', '2026'] as const).map((y) => {
        const isActive = String(saYr) === y;
        const sp = new URLSearchParams();
        for (const [k, v] of Object.entries(searchParams ?? {})) {
          if (k === 'sa_yr') continue;
          if (typeof v === 'string') sp.set(k, v);
        }
        sp.set('sa_yr', y);
        return (
          <a key={y} href={`?${sp.toString()}#source-adr-honesty`} style={{
            padding: '2px 9px', borderRadius: 999, border: '1px solid var(--hairline, #E6DFCC)',
            textDecoration: 'none', fontSize: 11,
            color: isActive ? 'var(--paper, #FFFFFF)' : 'var(--ink, #1B1B1B)',
            background: isActive ? 'var(--primary, #1F3A2E)' : 'transparent',
            fontWeight: isActive ? 600 : 400,
          }}>{y}</a>
        );
      })}
    </div>
  );

  return (
    <div id="source-adr-honesty" style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
        <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)' }}>
          Source ADR Honesty · {saYr} · blended vs transient-paid ADR (gap ≥ {sym}{GAP_THRESHOLD}, RN ≥ {RN_THRESHOLD})
        </div>
        {yearPills}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
        {qualifying.map((r) => {
          const gap = Number(r.lift_gap_eur);
          // gap < 0: blended > real — the blended ADR is lying HIGH → bad.
          // gap > 0: real > blended — the blended ADR is lying LOW → upside.
          const gapColor = gap < 0 ? 'var(--st-bad, #A13C2F)' : 'var(--st-good, #2E8A6F)';
          const pctTransient = r.pct_transient === null ? null : Math.round(Number(r.pct_transient));
          return (
            <Container key={r.source_name} title={r.source_name} subtitle={`${Number(r.total_rn).toLocaleString('en-US')} RN`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '6px 4px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: 15, textDecoration: 'line-through', color: 'var(--ink-soft, #5A5A5A)',
                    fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                  }}>
                    {r.blended_adr === null ? '—' : fmtMoney(Number(r.blended_adr), sym)}
                  </span>
                  <span style={{
                    fontSize: 22, fontWeight: 700, color: 'var(--ink, #1B1B1B)',
                    fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                  }}>
                    {r.real_adr === null ? '—' : fmtMoney(Number(r.real_adr), sym)}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: gapColor, fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}>
                    {gap > 0 ? '+' : '−'}{fmtMoney(Math.abs(gap), sym)}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--ink-soft, #5A5A5A)' }}>
                  % of channel RN that is transient-paid: {pctTransient === null ? '—' : `${pctTransient}%`}
                </div>
              </div>
            </Container>
          );
        })}
      </div>
      {noBaseline && (
        <div style={{ fontSize: 10, fontStyle: 'italic', color: 'var(--ink-soft, #5A5A5A)' }}>
          {noBaseline.source_name}: {Number(noBaseline.total_rn).toLocaleString('en-US')} RN, no transient-paid baseline
        </div>
      )}
    </div>
  );
}
