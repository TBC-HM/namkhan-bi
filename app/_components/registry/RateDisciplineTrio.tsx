// app/_components/registry/RateDisciplineTrio.tsx
// PBS 2026-05-27 (#259): 5 rate-discipline boxes (added Bedbank Leak). Tightened layout for 5-in-a-row.

import { Container } from '@/app/(cockpit)/_design';
import { supabase } from '@/lib/supabase';

interface Props {
  propertyId: number;
  searchParams?: Record<string, string | string[] | undefined>;
}

interface Row {
  property_id: number; yr: number;
  ota_parity_pairs: number; ota_parity_breach_pairs: number; ota_parity_breach_rn: number; ota_parity_loss_eur: number;
  website_self_pairs: number; website_self_breach_pairs: number; website_self_breach_rn: number; website_self_loss_eur: number;
  email_pairs: number; email_breach_pairs: number; email_breach_rn: number; email_loss_eur: number;
  phone_pairs: number; phone_breach_pairs: number; phone_breach_rn: number; phone_loss_eur: number;
  bedbank_pairs: number; bedbank_breach_pairs: number; bedbank_breach_rn: number; bedbank_loss_eur: number;
}

export default async function RateDisciplineTrio({ propertyId, searchParams }: Props) {
  const ccy: '$' | '€' = propertyId === 1000001 ? '€' : '$';
  const rdYrRaw = String(searchParams?.rd_yr ?? new Date().getFullYear());
  const rdYr = /^20\d{2}$/.test(rdYrRaw) ? Number(rdYrRaw) : new Date().getFullYear();

  const { data } = await supabase
    .from('v_rate_discipline_metrics')
    .select('*')
    .eq('property_id', propertyId)
    .maybeSingle();
  const r = (data ?? null) as Row | null;

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
  if (!r) {
    return (
      <div style={fullRow}>
        <Container title="Rate Discipline" subtitle={`${rdYr} · no comparable data`}>
          <div style={{ padding: 18, fontSize: 12, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>
            No reservation data for {rdYr}.
          </div>
        </Container>
      </div>
    );
  }

  const disciplineFromBreach = (breachPairs: number, totalPairs: number) => {
    if (!totalPairs) return 0;
    return Math.round(100 - (breachPairs / totalPairs) * 100);
  };

  return (
    <div style={{ ...fullRow, display: 'flex', flexDirection: 'column', gap: 8 }} id="rate-discipline">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
        <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)' }}>
          Rate Discipline · YTD {rdYr} · per (room category × month) breach detection
        </div>
        {yearPills}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
        <DisciplineBox
          title="OTA Parity Breaches"
          subtitle="OTAs sold below Website"
          discipline={disciplineFromBreach(r.ota_parity_breach_pairs, r.ota_parity_pairs)}
          breachPairs={r.ota_parity_breach_pairs}
          totalPairs={r.ota_parity_pairs}
          breachRn={r.ota_parity_breach_rn}
          lossEur={r.ota_parity_loss_eur}
          ccy={ccy}
        />
        <DisciplineBox
          title="Website Cheaper Than OTA"
          subtitle="we undercut our own OTAs"
          discipline={disciplineFromBreach(r.website_self_breach_pairs, r.website_self_pairs)}
          breachPairs={r.website_self_breach_pairs}
          totalPairs={r.website_self_pairs}
          breachRn={r.website_self_breach_rn}
          lossEur={r.website_self_loss_eur}
          ccy={ccy}
        />
        <DisciplineBox
          title="Email Leak"
          subtitle="Email ADR below Website"
          discipline={disciplineFromBreach(r.email_breach_pairs, r.email_pairs)}
          breachPairs={r.email_breach_pairs}
          totalPairs={r.email_pairs}
          breachRn={r.email_breach_rn}
          lossEur={r.email_loss_eur}
          ccy={ccy}
        />
        <DisciplineBox
          title="Phone Leak"
          subtitle="Phone ADR below Website"
          discipline={disciplineFromBreach(r.phone_breach_pairs, r.phone_pairs)}
          breachPairs={r.phone_breach_pairs}
          totalPairs={r.phone_pairs}
          breachRn={r.phone_breach_rn}
          lossEur={r.phone_loss_eur}
          ccy={ccy}
        />
        <DisciplineBox
          title="Bedbank Leak"
          subtitle="bedbank ADR below contracted floor"
          discipline={disciplineFromBreach(r.bedbank_breach_pairs, r.bedbank_pairs)}
          breachPairs={r.bedbank_breach_pairs}
          totalPairs={r.bedbank_pairs}
          breachRn={r.bedbank_breach_rn}
          lossEur={r.bedbank_loss_eur}
          ccy={ccy}
        />
      </div>
    </div>
  );
}

interface BoxProps {
  title: string; subtitle: string;
  discipline: number; breachPairs: number; totalPairs: number; breachRn: number; lossEur: number;
  ccy: '$' | '€';
}

function DisciplineBox({ title, subtitle, discipline, breachPairs, totalPairs, breachRn, lossEur, ccy }: BoxProps) {
  const color = discipline >= 80 ? 'var(--ok, #2E7D32)' : discipline >= 50 ? 'var(--brass-soft, #B8A878)' : 'var(--alert, #B83A3A)';
  return (
    <Container title={title} subtitle={subtitle}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '6px 4px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 22, fontWeight: 700, color, fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}>
            {discipline}
          </span>
          <span style={{ fontSize: 9, color: 'var(--ink-soft, #5A5A5A)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Discipline
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, fontSize: 11 }}>
          <div>
            <div style={{ fontSize: 9, color: 'var(--ink-soft, #5A5A5A)', textTransform: 'uppercase' }}>Breach</div>
            <div style={{ fontWeight: 600 }}>{breachPairs}/{totalPairs}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: 'var(--ink-soft, #5A5A5A)', textTransform: 'uppercase' }}>RN</div>
            <div style={{ fontWeight: 600 }}>{Number(breachRn ?? 0).toLocaleString()}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: 'var(--ink-soft, #5A5A5A)', textTransform: 'uppercase' }}>€ damage</div>
            <div style={{ fontWeight: 700, color }}>{ccy}{Math.round(Number(lossEur ?? 0)/1000)}k</div>
          </div>
        </div>
      </div>
    </Container>
  );
}
