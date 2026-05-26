// app/_components/registry/RateDisciplineTrio.tsx
// PBS 2026-05-26 (#253): three side-by-side rate-discipline boxes on /leakage.
// Box 1 — OTA parity: OTA vs Website (positive = Website premium, healthy).
// Box 2 — Website cheaper than OTA: same pair, framed as self-undercut risk.
// Box 3 — Direct channels (Website / Email / Phone): cross-channel ADR consistency.
// Year pill strip 24/25/26 shared across all 3 (?rd_yr=2026).

import { Container } from '@/app/(cockpit)/_design';
import { supabase } from '@/lib/supabase';

interface Props {
  propertyId: number;
  searchParams?: Record<string, string | string[] | undefined>;
}

interface ChannelRow {
  property_id: number;
  month_label: string;
  yr: number;
  ota_adr: number | null;
  website_adr: number | null;
  email_adr: number | null;
  phone_adr: number | null;
  walkin_adr: number | null;
  bedbank_adr: number | null;
}

function avg(nums: Array<number | null | undefined>): number {
  const arr = nums.filter((n): n is number => n != null && Number.isFinite(n) && n > 0);
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdev(nums: number[]): number {
  if (nums.length < 2) return 0;
  const m = nums.reduce((a, b) => a + b, 0) / nums.length;
  const v = nums.reduce((s, x) => s + (x - m) ** 2, 0) / (nums.length - 1);
  return Math.sqrt(v);
}

export default async function RateDisciplineTrio({ propertyId, searchParams }: Props) {
  const ccy: '$' | '€' = propertyId === 1000001 ? '€' : '$';
  const rdYrRaw = String(searchParams?.rd_yr ?? new Date().getFullYear());
  const rdYr = /^20\d{2}$/.test(rdYrRaw) ? Number(rdYrRaw) : new Date().getFullYear();

  const { data } = await supabase
    .from('v_monthly_adr_by_channel')
    .select('*')
    .eq('property_id', propertyId)
    .eq('yr', rdYr)
    .order('month_label', { ascending: true });

  const rows = (data ?? []) as ChannelRow[];

  // Box 1 — OTA parity (compare OTA vs Website)
  const otaMeanA = avg(rows.map((r) => r.ota_adr));
  const websiteMean = avg(rows.map((r) => r.website_adr));
  const box1Diff = websiteMean > 0 ? ((otaMeanA - websiteMean) / websiteMean) * 100 : 0;
  // Discipline: positive = OTA priced AT/ABOVE website (good parity).
  // Negative = OTA undercutting our website (breach).
  const box1Discipline = -box1Diff; // invert so positive=good (no breach)

  // Box 2 — Website cheaper than OTA (same pair, frame as direct self-undercut)
  const otaMeanB = otaMeanA;
  const websiteMeanB = websiteMean;
  // Discipline: positive when Website >= OTA (no self-undercut). Negative when Website < OTA.
  const box2Diff = otaMeanB > 0 ? ((websiteMeanB - otaMeanB) / otaMeanB) * 100 : 0;
  const box2Discipline = box2Diff;

  // Box 4 — Website vs Phone — pre-compute means used by box 4
  const phoneMean = avg(rows.map((r) => r.phone_adr));
  const box4Diff = phoneMean > 0 ? ((websiteMean - phoneMean) / phoneMean) * 100 : 0;
  const box4Discipline = box4Diff; // positive = Website premium over Phone

  // Box 3 — Direct channels consistency (Website / Email / Phone)
  const directMonthly = rows
    .map((r) => [r.website_adr, r.email_adr, r.phone_adr]
      .filter((x): x is number => x != null && x > 0))
    .filter((arr) => arr.length >= 2);
  const cvs = directMonthly.map((arr) => {
    const m = arr.reduce((a, b) => a + b, 0) / arr.length;
    return m > 0 ? (stdev(arr) / m) * 100 : 0;
  });
  const avgCv = cvs.length ? cvs.reduce((a, b) => a + b, 0) / cvs.length : 0;
  // Discipline: positive when channels are tight (low CV). 50 = perfectly aligned, 0 = 50% spread, negative when spread > 50%.
  const box3Discipline = 50 - avgCv;

  const yearPills = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)' }}>Year:</span>
      {(['2024', '2025', '2026'] as const).map((y) => {
        const isActive = String(rdYr) === y;
        const sp = new URLSearchParams();
        for (const [k, v] of Object.entries(searchParams ?? {})) {
          if (k === 'rd_yr') continue;
          if (typeof v === 'string') sp.set(k, v);
        }
        sp.set('rd_yr', y);
        return (
          <a key={y} href={`?${sp.toString()}#rate-discipline`} style={{
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

  const fullRow: React.CSSProperties = { gridColumn: '1 / -1' };
  return (
    <div style={{ ...fullRow, display: 'flex', flexDirection: 'column', gap: 8 }} id="rate-discipline">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
        <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)' }}>
          Rate Discipline · {rdYr} · year-over-year channel ADR comparison
        </div>
        {yearPills}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        <DisciplineBox
          title="OTA parity breaches"
          subtitle={`${rdYr} · OTA vs Website`}
          channelA="OTA"
          channelB="Website"
          adrA={Math.round(otaMeanA)}
          adrB={Math.round(websiteMean)}
          discipline={box1Discipline}
          diffPct={box1Diff}
          ccy={ccy}
          rowCount={rows.filter((r) => (r.ota_adr ?? 0) > 0 && (r.website_adr ?? 0) > 0).length}
          interpretation={box1Discipline >= 0 ? 'No breach · OTAs not undercutting' : 'BREACH · OTAs selling cheaper than Website'}
        />
        <DisciplineBox
          title="Website cheaper than OTA"
          subtitle={`${rdYr} · self-undercut watch`}
          channelA="Website"
          channelB="OTA"
          adrA={Math.round(websiteMean)}
          adrB={Math.round(otaMeanA)}
          discipline={box2Discipline}
          diffPct={box2Diff}
          ccy={ccy}
          rowCount={rows.filter((r) => (r.ota_adr ?? 0) > 0 && (r.website_adr ?? 0) > 0).length}
          interpretation={box2Discipline >= 0 ? 'Website premium intact' : 'SELF-UNDERCUT · Website lower than OTA average'}
        />
        <DisciplineBox
          title="Direct channels spread"
          subtitle={`${rdYr} · Website / Email / Phone`}
          channelA="Direct mix"
          channelB="ideal=tight"
          adrA={Math.round(websiteMean)}
          adrB={Math.round(avg(rows.map((r) => r.email_adr).concat(rows.map((r) => r.phone_adr))))}
          discipline={box3Discipline}
          diffPct={avgCv}
          ccy={ccy}
          rowCount={directMonthly.length}
          interpretation={box3Discipline >= 25 ? 'Tight · channels aligned' : box3Discipline >= 0 ? 'Moderate spread' : 'WIDE spread · inconsistent direct pricing'}
        />
        <DisciplineBox
          title="Website vs Phone"
          subtitle={`${rdYr} · phone-channel discipline`}
          channelA="Website"
          channelB="Phone"
          adrA={Math.round(websiteMean)}
          adrB={Math.round(phoneMean)}
          discipline={box4Discipline}
          diffPct={box4Diff}
          ccy={ccy}
          rowCount={rows.filter((r) => (r.phone_adr ?? 0) > 0 && (r.website_adr ?? 0) > 0).length}
          interpretation={box4Discipline >= 0 ? 'Website premium intact' : 'PHONE LEAK · Phone selling below Website'}
        />
      </div>
    </div>
  );
}

interface BoxProps {
  title: string;
  subtitle: string;
  channelA: string;
  channelB: string;
  adrA: number;
  adrB: number;
  discipline: number;
  diffPct: number;
  ccy: '$' | '€';
  rowCount: number;
  interpretation: string;
}

function DisciplineBox({ title, subtitle, channelA, channelB, adrA, adrB, discipline, diffPct, ccy, rowCount, interpretation }: BoxProps) {
  const sign = discipline >= 0 ? '+' : '';
  const color = discipline >= 0 ? 'var(--ok, #2E7D32)' : 'var(--alert, #B83A3A)';
  return (
    <Container title={title} subtitle={subtitle}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 4px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <span style={{ fontSize: 26, fontWeight: 700, color, fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}>
            {sign}{discipline.toFixed(1)}
          </span>
          <span style={{ fontSize: 11, color: 'var(--ink-soft, #5A5A5A)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Rate Discipline
          </span>
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--ink-soft, #5A5A5A)', textTransform: 'uppercase' }}>{channelA}</div>
            <div style={{ fontWeight: 600 }}>{ccy}{adrA.toLocaleString()}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--ink-soft, #5A5A5A)', textTransform: 'uppercase' }}>{channelB}</div>
            <div style={{ fontWeight: 600 }}>{ccy}{adrB.toLocaleString()}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--ink-soft, #5A5A5A)', textTransform: 'uppercase' }}>% diff</div>
            <div style={{ fontWeight: 600, color }}>{sign}{diffPct.toFixed(1)}%</div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic', borderTop: '1px solid var(--hairline, #E6DFCC)', paddingTop: 6 }}>
          {interpretation} · {rowCount} month{rowCount === 1 ? '' : 's'} of data
        </div>
      </div>
    </Container>
  );
}
