// app/revenue/page.tsx
// Revenue HoD landing — full-width, headline tiles + Attention + tasks +
// Sections navigator (the secondary sub-nav UNDER HoD). NOT one of 12 equal
// tabs — HoD is the parent; everything else lives below it.
// cockpit ticket #198 (SEQ 6/6) · 2026-05-21.

import Link from 'next/link';
import {
  DashboardPage, Container, KpiTile,
  type KpiTileProps,
} from '@/app/(cockpit)/_design';
import { DEPT_CFG } from '@/lib/dept-cfg';
import type { DeptCfg } from '@/lib/dept-cfg/types';
import { REVENUE_SUBPAGES } from './_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';
import { getDeptCfg } from '@/lib/dept-cfg/by-property';
import { PROPERTY_ID } from '@/lib/supabase';
import ReportBuilder from './_components/ReportBuilder';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface Props {
  propertyId?: number;
}

// Short hint per section — shown in the Sections navigator card.
// Kept inline here so the HoD landing reads as PBS's mental map, not a generic dump.
const SECTION_HINT: Record<string, string> = {
  Pulse:        '30-day rolling KPIs · pickup · ADR · OCC',
  Demand:       'Forward demand · OTB pace · 12 months ahead',
  Pace:         'Booking pace vs SDLY + pickup detail',
  Pickup:       'Monthly pickup matrix (PDF-style grid)',
  Rooms:        'Per-room-type tiles · ADR · OCC · RevPAR · 12mo ADR drill',
  Channels:     'Direct · OTAs · DMC — economics + commission',
  'Rate Plans': 'Plan health · cancellations · sleeping/orphan',
  Calendar:     'Pricing calendar + density (country holidays overlay)',
  'Comp Set':   'Competitor rates · price ladders · ad-hoc',
  Leakage:      'OTA rate leakage · bedbank parity drift',
  Parity:       'Direct-vs-OTA rate parity violations',
  Reports:      'Build a printable report · pulse · pace · channels · P&L',
};

export default function RevenueHoDPage({ propertyId }: Props = {}) {
  const pid = propertyId ?? PROPERTY_ID;
  const cfg: DeptCfg = pid === PROPERTY_ID ? DEPT_CFG.revenue : getDeptCfg('revenue', pid);

  const subPages = rewriteSubPagesForProperty(REVENUE_SUBPAGES, pid);
  // HoD page intentionally renders WITHOUT a tab strip — the Sections grid
  // below is the secondary sub-nav. The tab strip lives on the subpages.
  const sections = subPages.filter((s) => s.label !== 'HoD');

  const tiles: KpiTileProps[] = (cfg.kpiTiles ?? []).map((k) => ({
    label: k.k, value: k.v, size: 'sm', footnote: k.d,
  }));

  const attn = cfg.defaultAttn ?? [];
  const docs = cfg.defaultDocs ?? [];
  const tasks = cfg.defaultTasks ?? [];
  const reportTypes = cfg.reportTypes ?? [];

  const chatHref = pid === PROPERTY_ID ? '/revenue/legacy' : `/h/${pid}/revenue/legacy`;

  return (
    <DashboardPage
      title={`Revenue · ${cfg.hodName}`}
      subtitle={cfg.hodTagline}
      action={
        <Link href={chatHref} style={primaryBtnStyle}>{`Ask ${cfg.hodName} →`}</Link>
      }
    >
      {tiles.length > 0 && (
        <Container title="Headline" subtitle="snapshot · last refresh" density="compact">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
          </div>
        </Container>
      )}

      {/* Sections navigator — the secondary sub-nav. PBS #198 SEQ 6/6 */}
      <Container title="Sections" subtitle="drill into a sub-area" density="compact">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          {sections.map((s) => (
            <Link key={s.href} href={s.href} style={sectionCardStyle}>
              <div style={sectionLabelStyle}>{s.label}</div>
              <div style={sectionHintStyle}>{SECTION_HINT[s.label] ?? ''}</div>
            </Link>
          ))}
        </div>
      </Container>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <Container title="Attention" subtitle={`${attn.length} item${attn.length === 1 ? '' : 's'}`} density="compact">
          {attn.length === 0 ? <div style={emptyStyle}>nothing flagged</div> : (
            <div style={listStyle}>
              {attn.map((a) => (
                <div key={a.id} style={rowStyle}>
                  <span style={{ ...dotStyle, background: SEV_DOT[a.severity] }} aria-hidden />
                  <span style={labelStyle}>{a.label}</span>
                  <span style={tagStyle}>{a.kind}</span>
                </div>
              ))}
            </div>
          )}
        </Container>

        <Container title="My Docs" subtitle={`${docs.length} item${docs.length === 1 ? '' : 's'}`} density="compact">
          {docs.length === 0 ? <div style={emptyStyle}>no docs yet</div> : (
            <div style={listStyle}>
              {docs.map((d) => (
                <a key={d.id} href={d.href} target="_blank" rel="noopener noreferrer" style={{ ...rowStyle, textDecoration: 'none', color: 'inherit' }}>
                  <span style={{ ...dotStyle, background: 'var(--brass, #B8542A)' }} aria-hidden />
                  <span style={labelStyle}>{d.label}</span>
                  {d.report_type && <span style={tagStyle}>{d.report_type}</span>}
                </a>
              ))}
            </div>
          )}
        </Container>

        <Container title="My Tasks" subtitle={`${tasks.filter((t) => !t.done).length} open`} density="compact">
          {tasks.length === 0 ? <div style={emptyStyle}>no tasks yet</div> : (
            <div style={listStyle}>
              {tasks.map((t) => (
                <div key={t.id} style={rowStyle}>
                  <span style={{ ...dotStyle, background: t.done ? 'var(--ink-soft, #5A5A5A)' : 'var(--primary, #1F3A2E)' }} aria-hidden />
                  <span style={{ ...labelStyle, textDecoration: t.done ? 'line-through' : 'none', color: t.done ? 'var(--ink-soft, #5A5A5A)' : 'inherit' }}>{t.label}</span>
                </div>
              ))}
            </div>
          )}
        </Container>
      </div>

      {reportTypes.length > 0 && (
        <Container
          title="Build a report"
          subtitle="pick a type · narrow with chips · open the print-ready render in a new tab"
          density="compact"
        >
          <ReportBuilder reportTypes={reportTypes} />
        </Container>
      )}

      <Container title="Chat" subtitle={`open the full ${cfg.hodName} surface (project context · reports · bug tracker · uploads)`} density="compact">
        <Link href={chatHref} style={secondaryBtnStyle}>{`Open ${cfg.hodName} chat →`}</Link>
      </Container>
    </DashboardPage>
  );
}

const SEV_DOT: Record<string, string> = { high: '#C0584C', medium: '#C4A06B', low: '#9B907A' };
const listStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 };
const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 4,
  background: 'var(--paper, #FFFFFF)', border: '1px solid var(--hairline, #E6DFCC)', fontSize: 12,
};
const dotStyle: React.CSSProperties = { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 };
const labelStyle: React.CSSProperties = { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const tagStyle: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)',
  padding: '2px 6px', borderRadius: 99, background: 'var(--hairline, #E6DFCC)', flexShrink: 0,
};
const emptyStyle: React.CSSProperties = { fontSize: 12, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic', padding: '8px 4px' };
const primaryBtnStyle: React.CSSProperties = {
  fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
  padding: '6px 14px', borderRadius: 4, background: 'var(--primary, #1F3A2E)', color: '#FFFFFF', textDecoration: 'none',
};
const secondaryBtnStyle: React.CSSProperties = {
  display: 'inline-block', padding: '10px 18px',
  background: 'var(--paper, #FFFFFF)', border: '1px solid var(--hairline, #E6DFCC)', borderRadius: 4,
  color: 'var(--ink, #1B1B1B)', textDecoration: 'none', fontSize: 13, fontWeight: 500,
};
// Sections navigator card — clean paper, hairline border, ink label + soft hint.
const sectionCardStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 4,
  padding: '12px 14px', borderRadius: 6,
  background: 'var(--paper, #FFFFFF)', border: '1px solid var(--hairline, #E6DFCC)',
  color: 'inherit', textDecoration: 'none',
};
const sectionLabelStyle: React.CSSProperties = {
  fontSize: 14, fontWeight: 600, color: 'var(--ink, #1B1B1B)',
};
const sectionHintStyle: React.CSSProperties = {
  fontSize: 11, color: 'var(--ink-soft, #5A5A5A)', lineHeight: 1.4,
};
