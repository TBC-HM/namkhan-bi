// app/_components/HodLanding.tsx
// PBS #204 (2026-05-25) — shared HoD landing primitive. Same layout as
// /revenue HoD: 6 KPI tiles + 4-up Attention/Reports/Tasks/Bugs row +
// Build-a-report container. Used by finance, sales, marketing, operations
// (Namkhan + Donna). Each dept passes its slug; cfg comes from DEPT_CFG.
//
// PBS 2026-07-07: `conclusions` slot renders a <ConclusionBlock> between
// the 4-up row and Build-a-report. Each HoD page evaluates its own rules
// server-side and passes the resulting Insight[] via the prop.

import Link from 'next/link';
import {
  DashboardPage, Container, KpiTile,
  type KpiTileProps,
} from '@/app/(cockpit)/_design';
import { DEPT_CFG } from '@/lib/dept-cfg';
import type { DeptSlug } from '@/lib/dept-cfg/types';
import { getDeptCfg } from '@/lib/dept-cfg/by-property';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';
import { PROPERTY_ID, supabase } from '@/lib/supabase';
import ReportBuilder from '@/app/revenue/_components/ReportBuilder';
import ReportsList   from '@/app/revenue/_components/ReportsList';
import BugsList      from '@/app/revenue/_components/BugsList';
import HodTasksList  from '@/app/revenue/_components/HodTasksList';
import AttentionList from '@/app/revenue/_components/AttentionList';
import ConclusionBlock, { type Insight } from '@/app/_components/ConclusionBlock';

interface Props {
  slug: DeptSlug;
  propertyId?: number;
  liveTiles?: KpiTileProps[];
  extraContainers?: React.ReactNode;
  /** PBS 2026-07-07 — conclusion insights evaluated server-side by the HoD page. */
  conclusions?: {
    insights: Insight[];
    title?: string;
    subtitle?: string;
    emptyText?: string;
  };
}

export default async function HodLanding({ slug, propertyId, liveTiles, extraContainers, conclusions }: Props) {
  const pid = propertyId ?? PROPERTY_ID;
  const cfg = pid === PROPERTY_ID ? DEPT_CFG[slug] : getDeptCfg(slug, pid);

  const subPages = rewriteSubPagesForProperty(cfg.subPages ?? [], pid);

  const [bugsRes, dueTasksRes] = await Promise.all([
    supabase
      .from('cockpit_bugs')
      .select('id, body, status, created_at, page_url')
      .not('status', 'in', '(closed,resolved,wontfix,done)')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('v_hod_tasks_due')
      .select('id', { count: 'exact', head: true })
      .eq('dept_slug', slug)
      .eq('property_id', pid)
      .eq('is_due', true),
  ]);

  const bugs = (bugsRes.data ?? []) as Array<{
    id: number; body: string | null; status: string | null;
    created_at: string | null; page_url: string | null;
  }>;
  const dueTasksCount = dueTasksRes.count ?? 0;

  const tiles: KpiTileProps[] = liveTiles ?? (cfg.kpiTiles ?? []).map((k) => ({
    label: k.k, value: k.v, size: 'sm', footnote: k.d,
  }));

  const attn       = cfg.defaultAttn ?? [];
  const docs       = cfg.defaultDocs ?? [];
  const reportTypes = cfg.reportTypes ?? [];

  const hodTabs = subPages.map((s) => ({
    key: s.href, label: s.label, href: s.href,
    active: s.label === 'HoD',
  }));

  const chatHref = `/cockpit/chat?dept=${slug}`;

  return (
    <DashboardPage
      title={`${cfg.pillTitle ?? slug} · ${cfg.hodName}`}
      subtitle={new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      tabs={hodTabs}
      action={<Link href={chatHref} style={primaryBtnStyle}>{`Ask ${cfg.hodName} →`}</Link>}
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

      <div style={{ ...fullRow, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
        <Container title="Attention" subtitle={`${attn.length} item${attn.length === 1 ? '' : 's'} · dismiss with ×`} density="compact">
          <AttentionList items={attn} storageKey={`attn:${slug}:${pid}`} />
        </Container>
        <Container title="My Reports" subtitle={`${docs.length} item${docs.length === 1 ? '' : 's'} · red = unseen · dismiss with ×`} density="compact">
          <ReportsList items={docs} storageKey={`reports:${slug}:${pid}`} />
        </Container>
        <Container title="My Tasks" subtitle={dueTasksCount > 0 ? `🔴 ${dueTasksCount} due · add / due-date / repeat / delete` : 'add / due-date / repeat / delete · per property'} density="compact">
          <HodTasksList deptSlug={slug} propertyId={pid} />
        </Container>
        <Container title="Bugs" subtitle={`${bugs.length} open · + to add · /cockpit/bugs for full inbox`} density="compact">
          <BugsList deptSlug={slug} propertyId={pid} initial={bugs} />
        </Container>
      </div>

      {/* PBS 2026-07-07: Conclusions container — rule-based signals from lib/rules/{slug}.ts */}
      {conclusions && (
        <div style={fullRow}>
          <ConclusionBlock
            insights={conclusions.insights}
            title={conclusions.title ?? `CONCLUSIONS · ${slug}`}
            subtitle={conclusions.subtitle}
            emptyText={conclusions.emptyText ?? 'Everything nominal. No alarms firing.'}
            storageKey={`${slug}_hod_signals:${pid}`}
            maxRender={12}
          />
        </div>
      )}

      {reportTypes.length > 0 && (
        <div style={fullRow}>
          <Container title="Build a report" subtitle="pick a type · narrow with chips · open print-ready render" density="compact">
            <ReportBuilder reportTypes={reportTypes} hrefPrefix={pid === PROPERTY_ID ? '' : `/h/${pid}`} />
          </Container>
        </div>
      )}

      {extraContainers}
    </DashboardPage>
  );
}

const fullRow: React.CSSProperties = { gridColumn: '1 / -1' };
const primaryBtnStyle: React.CSSProperties = {
  fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
  padding: '6px 14px', borderRadius: 4,
  background: 'var(--primary, #1F3A2E)', color: '#FFFFFF', textDecoration: 'none',
};
