// app/revenue/page.tsx
// Revenue HoD landing — TIGHT, full-width, above-the-fold first read.
// Order: Headline tiles → Attention/Docs/Tasks → Sections navigator → Report builder → Chat.
// Every block spans gridColumn 1/-1 so nothing sits in a 360px column with blank right.
// cockpit ticket #198 (SEQ 6/6) · 2026-05-21 (tightened after PBS feedback re scroll+blank space).

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
import { PROPERTY_ID, supabase } from '@/lib/supabase';
import ReportBuilder from './_components/ReportBuilder';
import { getPulseTodayPickup, getPulseTodayCancellations } from '@/lib/data-pulse';

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

  // PBS note#2: append today's Pickup + Cancellations as 5th + 6th KPI tiles.
  // PBS note#6: bring back Bug box — read cockpit_bugs (open only).
  const todayIso = new Date().toISOString().slice(0, 10);
  const [pickupToday, cancellationsToday, bugsRes] = await Promise.all([
    getPulseTodayPickup(pid, todayIso).catch(() => [] as Array<unknown>),
    getPulseTodayCancellations(pid, todayIso).catch(() => [] as Array<unknown>),
    supabase.from('cockpit_bugs').select('id, body, status, created_at, page_url').not('status','in','(closed,resolved,wontfix,done)').order('created_at', { ascending: false }).limit(5),
  ]);
  const bugs = (bugsRes.data ?? []) as Array<{ id: number; body: string | null; status: string | null; created_at: string | null; page_url: string | null }>;
  const pickupCount = pickupToday.length;
  const cancelCount = cancellationsToday.length;

  const baseTiles: KpiTileProps[] = (cfg.kpiTiles ?? []).map((k) => ({
    label: k.k, value: k.v, size: 'sm', footnote: k.d,
  }));
  const tiles: KpiTileProps[] = [
    ...baseTiles,
    { label: 'Pickup today', value: pickupCount, size: 'sm',
      footnote: pickupCount === 1 ? 'new booking' : 'new bookings',
      status: pickupCount > 0 ? 'green' : 'grey' },
    { label: 'Cancellations today', value: cancelCount, size: 'sm',
      footnote: cancelCount === 1 ? 'booking lost' : 'bookings lost',
      status: cancelCount === 0 ? 'green' : 'amber' },
  ];

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

  // PBS note#1: surface sections as the TOP tab strip on the HoD landing.
  const hodTabs = sections.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: false,
  }));
  return (
    <DashboardPage
      title={`Revenue · ${cfg.hodName}`}
      subtitle={cfg.hodTagline}
      tabs={hodTabs}
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

      {/* 2. Attention / Reports / Tasks / Bugs — four-up full-width row (Bug box restored per #6) */}
      <div style={{ ...fullRow, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
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

        <Container title="My Reports" subtitle={`${docs.length} item${docs.length === 1 ? '' : 's'}`} density="compact">
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

        <Container title="Bugs" subtitle={`${bugs.length} open`} density="compact">
          {bugs.length === 0 ? <div style={emptyStyle}>no open bugs</div> : (
            <div style={listStyle}>
              {bugs.map((b) => (
                <div key={b.id} style={rowStyle}>
                  <span style={{ ...dotStyle, background: 'var(--brass, #B8542A)' }} aria-hidden />
                  <span style={labelStyle}>{String(b.body ?? '').slice(0, 80)}</span>
                  {b.page_url && <span style={tagStyle}>{String(b.page_url).replace(/^https?:\/\/[^/]+/, '')}</span>}
                </div>
              ))}
            </div>
          )}
        </Container>
      </div>

      {/* 3. Sections navigator — full-width 4-up dense grid (the secondary sub-nav) */}
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
