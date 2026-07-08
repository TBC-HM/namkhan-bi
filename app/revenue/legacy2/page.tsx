// app/revenue/legacy2/page.tsx
// FROZEN COPY of the Revenue HoD landing as of 2026-05-21 post-#198 ship.
// Safety net per PBS: "for safty keep what we have as legacy 2 or so" —
// if a later iteration of /revenue HoD regresses, this route stays usable.
// DO NOT EDIT in lock-step with /revenue — it's a deliberate snapshot.

import TenantLink from '@/components/nav/TenantLink';
import {
  DashboardPage, Container, KpiTile,
  type KpiTileProps,
} from '@/app/(cockpit)/_design';
import { DEPT_CFG } from '@/lib/dept-cfg';
import type { DeptCfg } from '@/lib/dept-cfg/types';
import { REVENUE_SUBPAGES } from '../_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';
import { getDeptCfg } from '@/lib/dept-cfg/by-property';
import { PROPERTY_ID } from '@/lib/supabase';
import ReportBuilder from '../_components/ReportBuilder';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface Props {
  propertyId?: number;
}

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

export default function RevenueHoDLegacy2Page({ propertyId }: Props = {}) {
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

  const chatHref = pid === PROPERTY_ID ? '/revenue/legacy' : `/h/${pid}/revenue/legacy`;
  const liveHref = pid === PROPERTY_ID ? '/revenue' : `/h/${pid}/revenue`;

  return (
    <DashboardPage
      title={`Revenue · ${cfg.hodName} · LEGACY 2 (snapshot)`}
      subtitle={`Frozen snapshot of the HoD landing — safety net. Live HoD: ${liveHref}`}
      action={
        <TenantLink href={liveHref} style={primaryBtnStyle}>{`← Back to live HoD`}</TenantLink>
      }
    >
      {tiles.length > 0 && (
        <div style={fullRow}>
          <Container title="Headline" subtitle="snapshot · last refresh" density="compact">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
              {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
            </div>
          </Container>
        </div>
      )}

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

      <div style={fullRow}>
        <Container title="Sections" subtitle="drill into a sub-area" density="compact">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 6 }}>
            {sections.map((s) => (
              <TenantLink key={s.href} href={s.href} style={sectionCardStyle}>
                <div style={sectionLabelStyle}>{s.label}</div>
                <div style={sectionHintStyle}>{SECTION_HINT[s.label] ?? ''}</div>
              </TenantLink>
            ))}
          </div>
        </Container>
      </div>

      {reportTypes.length > 0 && (
        <div style={fullRow}>
          <Container
            title="Build a report"
            subtitle="pick a type · narrow with chips · open print-ready render"
            density="compact"
          >
            <ReportBuilder reportTypes={reportTypes} />
          </Container>
        </div>
      )}

      <div style={fullRow}>
        <Container title="Chat" subtitle={`open the full ${cfg.hodName} surface`} density="compact">
          <TenantLink href={chatHref} style={secondaryBtnStyle}>{`Open ${cfg.hodName} chat →`}</TenantLink>
        </Container>
      </div>
    </DashboardPage>
  );
}

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
