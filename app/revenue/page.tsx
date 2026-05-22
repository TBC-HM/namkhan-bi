// app/revenue/page.tsx
// Revenue HoD landing — TIGHT, full-width, above-the-fold first read.
// Order: Headline tiles → Attention/Docs/Tasks → Sections navigator → Report builder → Chat.
// Every block spans gridColumn 1/-1 so nothing sits in a 360px column with blank right.
// cockpit ticket #198 (SEQ 6/6) · 2026-05-21 (tightened after PBS feedback re scroll+blank space).

import Link from 'next/link';
import { Suspense } from 'react';
import {
  DashboardPage, Container, KpiTile,
  type KpiTileProps,
} from '@/app/(cockpit)/_design';
// Direct import (NOT via barrel) — the barrel re-export of async server
// components triggers "Unsupported Server Component" in Next.js 14 RSC.
// task #89 retry of #82 wiring.
import BookingActivity from '@/app/(cockpit)/_design/BookingActivity';
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
  searchParams?: Record<string, string | string[] | undefined>;
}

// Short hint per section — shown in the Sections navigator card.
const SECTION_HINT: Record<string, string> = {
  Pulse:        '30-day rolling KPIs',
  Demand:       'Forward OTB pace · 12 months',
  Pace:         'Pace vs SDLY + pickup detail',
  Pickup:       'Monthly pickup matrix',
  Rooms:        'Per-room tiles · ADR · OCC · RevPAR',
  Channels:     'Direct · OTAs · DMC economics',
  'Rate Plans': 'Plan health · cancellations',
  Calendar:     'Pricing calendar + density',
  'Comp Set':   'Competitor rates',
  Leakage:      'OTA leakage + bedbank drift',
  Parity:       'Rate parity violations',
  Reports:      'Print-ready reports',
};

export default async function RevenueHoDPage({ propertyId, searchParams }: Props = {}) {
  const pid = propertyId ?? PROPERTY_ID;
  const cfg: DeptCfg = pid === PROPERTY_ID ? DEPT_CFG.revenue : getDeptCfg('revenue', pid);

  const subPages = rewriteSubPagesForProperty(REVENUE_SUBPAGES, pid);
  const sections = subPages.filter((s) => s.label !== 'HoD');

  const tiles: KpiTileProps[] = (cfg.kpiTiles ?? []).map((k) => ({
    label: k.k, value: k.v, size: 'sm', footnote: k.d,
  }));

  const attn = cfg.defaultAttn ?? [];
  const docs = cfg.defaultDocs ?? [];
  const tasks = cfg.defaultTasks ?? [];
  const reportTypes = cfg.reportTypes ?? [];

  // task #68 · route the "Ask <HoD>" CTA to the canonical persona-aware
  // chat surface. Donna HoD is Mira (role revenue_hod_donna) so we pass
  // the explicit role/name/emoji/label overrides that /cockpit/chat consumes.
  const DONNA_PROPERTY_ID = 1000001;
  const chatHref =
    pid === DONNA_PROPERTY_ID
      ? `/cockpit/chat?dept=revenue&role=revenue_hod_donna&name=Mira&emoji=${encodeURIComponent('📈')}&label=Revenue`
      : `/cockpit/chat?dept=revenue`;

  return (
    <DashboardPage
      title={`Revenue · ${cfg.hodName}`}
      subtitle={cfg.hodTagline}
      action={
        <Link href={chatHref} style={primaryBtnStyle}>{`Ask ${cfg.hodName} →`}</Link>
      }
    >
      {/* 1. Headline tiles — full-width row, dense */}
      {tiles.length > 0 && (
        <div style={fullRow}>
          <Container title="Headline" subtitle="snapshot · last refresh" density="compact">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
              {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
            </div>
          </Container>
        </div>
      )}

      {/* 2. Attention / Docs / Tasks — three-up full-width row */}
      <div style={{ ...fullRow, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
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

      {/* 3a. Booking activity — last 1-7 days · server-fetched · property-aware */}
      <div style={fullRow}>
        <Suspense fallback={<Container title="Bookings & cancellations" subtitle="loading…" density="compact"><div style={{ padding: 12, fontSize: 12, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>Loading recent activity…</div></Container>}>
          <BookingActivity propertyId={pid} searchParams={searchParams} />
        </Suspense>
      </div>

      {/* 3b. Sections navigator — full-width 4-up dense grid (the secondary sub-nav) */}
      <div style={fullRow}>
        <Container title="Sections" subtitle="drill into a sub-area" density="compact">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 6 }}>
            {sections.map((s) => (
              <Link key={s.href} href={s.href} style={sectionCardStyle}>
                <div style={sectionLabelStyle}>{s.label}</div>
                <div style={sectionHintStyle}>{SECTION_HINT[s.label] ?? ''}</div>
              </Link>
            ))}
          </div>
        </Container>
      </div>

      {/* 4. Build a report — full-width */}
      {reportTypes.length > 0 && (
        <div style={fullRow}>
          <Container
            title="Build a report"
            subtitle="pick a type · narrow with chips · open print-ready render"
            density="compact"
          >
            <ReportBuilder reportTypes={reportTypes} hrefPrefix={pid === PROPERTY_ID ? '' : `/h/${pid}`} />
          </Container>
        </div>
      )}

      {/* 5. Chat — full-width, single CTA */}
      <div style={fullRow}>
        <Container title="Chat" subtitle={`open the full ${cfg.hodName} surface`} density="compact">
          <Link href={chatHref} style={secondaryBtnStyle}>{`Open ${cfg.hodName} chat →`}</Link>
        </Container>
      </div>
    </DashboardPage>
  );
}

// Each immediate child of DashboardPage body sits in a 360px auto-fit grid cell.
// Spanning gridColumn 1/-1 makes the block use the full row instead of leaving
// blank space to the right.
const fullRow: React.CSSProperties = { gridColumn: '1 / -1' };

const SEV_DOT: Record<string, string> = { high: '#C0584C', medium: '#C4A06B', low: '#9B907A' };
const listStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 };
const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 4,
  background: 'var(--paper, #FFFFFF)', border: '1px solid var(--hairline, #E6DFCC)', fontSize: 12,
};
const dotStyle: React.CSSProperties = { width: 7, height: 7, borderRadius: '50%', flexShrink: 0 };
const labelStyle: React.CSSProperties = { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const tagStyle: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)',
  padding: '2px 6px', borderRadius: 99, background: 'var(--hairline, #E6DFCC)', flexShrink: 0,
};
const emptyStyle: React.CSSProperties = { fontSize: 11, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic', padding: '6px 4px' };
const primaryBtnStyle: React.CSSProperties = {
  fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
  padding: '6px 14px', borderRadius: 4, background: 'var(--primary, #1F3A2E)', color: '#FFFFFF', textDecoration: 'none',
};
const secondaryBtnStyle: React.CSSProperties = {
  display: 'inline-block', padding: '8px 14px',
  background: 'var(--paper, #FFFFFF)', border: '1px solid var(--hairline, #E6DFCC)', borderRadius: 4,
  color: 'var(--ink, #1B1B1B)', textDecoration: 'none', fontSize: 12, fontWeight: 500,
};
const sectionCardStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 2,
  padding: '8px 10px', borderRadius: 4,
  background: 'var(--paper, #FFFFFF)', border: '1px solid var(--hairline, #E6DFCC)',
  color: 'inherit', textDecoration: 'none',
};
const sectionLabelStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: 'var(--ink, #1B1B1B)',
};
const sectionHintStyle: React.CSSProperties = {
  fontSize: 10, color: 'var(--ink-soft, #5A5A5A)', lineHeight: 1.3,
};
