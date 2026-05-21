// app/revenue/page.tsx
// 2026-05-21: Revenue HoD entry page rebuilt on the canonical primitives so
// it matches the other revenue subpages (pulse/demand/pace/channels/etc).
// Legacy DeptEntry surface (chat + reports + project context + bug tracker)
// preserved at /revenue/legacy; this page surfaces the static cfg defaults
// (attention items / docs / tasks / KPI tiles) in the new design and points
// users to the legacy surface for the chat-heavy workflow.

import Link from 'next/link';
import {
  DashboardPage, Container, KpiTile,
  type DashboardTab, type KpiTileProps,
} from '@/app/(cockpit)/_design';
import { DEPT_CFG } from '@/lib/dept-cfg';
import type { DeptCfg } from '@/lib/dept-cfg/types';
import { REVENUE_SUBPAGES } from './_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';
import { getDeptCfg } from '@/lib/dept-cfg/by-property';
import { PROPERTY_ID } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

const SEV_STATUS: Record<string, KpiTileProps['status']> = {
  high: 'red',
  medium: 'amber',
  low: 'grey',
};

interface Props {
  propertyId?: number;
}

export default function RevenueHoDPage({ propertyId }: Props = {}) {
  const pid = propertyId ?? PROPERTY_ID;
  const cfg: DeptCfg = pid === PROPERTY_ID ? DEPT_CFG.revenue : getDeptCfg('revenue', pid);

  const subPages = rewriteSubPagesForProperty(REVENUE_SUBPAGES, pid);
  const tabs: DashboardTab[] = subPages.map((s) => ({
    key: s.href,
    label: s.label,
    href: s.href,
    active: s.label === 'HoD',
  }));

  // KPI strip — sourced from cfg.kpiTiles (date-hover popover values).
  // Stays static for now; live values will land once a per-property KPI
  // helper exists alongside getPaceOtb.
  const tiles: KpiTileProps[] = (cfg.kpiTiles ?? []).map((k) => ({
    label: k.k,
    value: k.v,
    size: 'sm',
    footnote: k.d,
  }));

  const attn = cfg.defaultAttn ?? [];
  const docs = cfg.defaultDocs ?? [];
  const tasks = cfg.defaultTasks ?? [];

  const chatHref = pid === PROPERTY_ID ? '/revenue/legacy' : `/h/${pid}/revenue/legacy`;

  return (
    <DashboardPage
      title={`Revenue · ${cfg.hodName}`}
      subtitle={cfg.hodTagline}
      tabs={tabs}
      action={
        <Link
          href={chatHref}
          style={{
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontWeight: 600,
            padding: '6px 14px',
            borderRadius: 4,
            background: 'var(--primary, #1F3A2E)',
            color: '#FFFFFF',
            textDecoration: 'none',
          }}
        >
          {`Ask ${cfg.hodName} →`}
        </Link>
      }
    >
      {tiles.length > 0 && (
        <Container title="Headline" subtitle="snapshot · last refresh" density="compact">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
          </div>
        </Container>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <Container title="Attention" subtitle={`${attn.length} item${attn.length === 1 ? '' : 's'}`} density="compact">
          {attn.length === 0 ? (
            <div style={emptyStyle}>nothing flagged</div>
          ) : (
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
          {docs.length === 0 ? (
            <div style={emptyStyle}>no docs yet</div>
          ) : (
            <div style={listStyle}>
              {docs.map((d) => (
                <a key={d.id} href={d.href} style={{ ...rowStyle, textDecoration: 'none', color: 'inherit' }}>
                  <span style={{ ...dotStyle, background: 'var(--brass, #B8542A)' }} aria-hidden />
                  <span style={labelStyle}>{d.label}</span>
                  {d.report_type && <span style={tagStyle}>{d.report_type}</span>}
                </a>
              ))}
            </div>
          )}
        </Container>

        <Container title="My Tasks" subtitle={`${tasks.filter((t) => !t.done).length} open`} density="compact">
          {tasks.length === 0 ? (
            <div style={emptyStyle}>no tasks yet</div>
          ) : (
            <div style={listStyle}>
              {tasks.map((t) => (
                <div key={t.id} style={rowStyle}>
                  <span style={{
                    ...dotStyle,
                    background: t.done ? 'var(--ink-soft, #5A5A5A)' : 'var(--primary, #1F3A2E)',
                  }} aria-hidden />
                  <span style={{
                    ...labelStyle,
                    textDecoration: t.done ? 'line-through' : 'none',
                    color: t.done ? 'var(--ink-soft, #5A5A5A)' : 'inherit',
                  }}>{t.label}</span>
                </div>
              ))}
            </div>
          )}
        </Container>
      </div>

      <Container title="Chat" subtitle={`open the full ${cfg.hodName} surface (project context · reports · bug tracker · uploads)`} density="compact">
        <Link
          href={chatHref}
          style={{
            display: 'inline-block',
            padding: '10px 18px',
            background: 'var(--paper, #FFFFFF)',
            border: '1px solid var(--hairline, #E6DFCC)',
            borderRadius: 4,
            color: 'var(--ink, #1B1B1B)',
            textDecoration: 'none',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {`Open ${cfg.hodName} chat →`}
        </Link>
      </Container>
    </DashboardPage>
  );
}

const SEV_DOT: Record<string, string> = {
  high: '#C0584C',
  medium: '#C4A06B',
  low: '#9B907A',
};

const listStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 };
const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 8px',
  borderRadius: 4,
  background: 'var(--paper, #FFFFFF)',
  border: '1px solid var(--hairline, #E6DFCC)',
  fontSize: 12,
};
const dotStyle: React.CSSProperties = { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 };
const labelStyle: React.CSSProperties = { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const tagStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--ink-soft, #5A5A5A)',
  padding: '2px 6px',
  borderRadius: 99,
  background: 'var(--hairline, #E6DFCC)',
  flexShrink: 0,
};
const emptyStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--ink-soft, #5A5A5A)',
  fontStyle: 'italic',
  padding: '8px 4px',
};
