// app/_components/HodLanding.tsx
// Shared HoD landing primitive — powers /finance, /sales, /marketing, /operations
// AND /holding/{ceo,finance,legal,strategy}.
//
// PBS 2026-07-08 v2 mirror: matches the new /revenue HoD layout.
//   Top row of 4: Shortcuts · My Reports · My Tasks · External Links
//   Conclusions (dept-specific insights)
//   Build a report (dept-cfg reportTypes)
//   Scheduled reports (bottom)
//   Reports · send log (bottom)
//
// PBS 2026-07-09: optional `settingsHref` renders a gear icon next to the Ask
// button. Used on /holding/* HoD landings to jump into /holding/settings.
// PBS 2026-07-14 HOTFIX: reportTypes / reportOptions / allowedTemplateKeys were
// declared AFTER the Promise.all that referenced them → ReferenceError (TDZ) →
// /operations + /sales + every HoD landing 500ed (digest 1285825404).
// Moved catalogue computation above the await + kept the ['__none__'] sentinel
// so empty allow-lists don't blow up PostgREST .in().

import TenantLink from '@/components/nav/TenantLink';
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
import HodTasksList  from '@/app/revenue/_components/HodTasksList';
import ShortcutsPanel, { type Shortcut } from '@/app/revenue/_components/ShortcutsPanel';
import ExternalLinksPanel, { type ExternalLink } from '@/app/revenue/_components/ExternalLinksPanel';
import {
  ScheduledReportsTable, SendLogTable,
  type ScheduledRow, type SendLogRow,
} from '@/app/revenue/_components/RevenueReportsTables';
import ConclusionBlock, { type Insight } from '@/app/_components/ConclusionBlock';

const DEFAULT_USER_EMAIL = 'pbsbase@gmail.com';

interface Props {
  slug: DeptSlug;
  propertyId?: number;
  liveTiles?: KpiTileProps[];
  extraContainers?: React.ReactNode;
  conclusions?: {
    insights: Insight[];
    title?: string;
    subtitle?: string;
    emptyText?: string;
  };
  /** PBS 2026-07-09: adds a gear button next to Ask that jumps into a settings page. */
  settingsHref?: string;
}

export default async function HodLanding({ slug, propertyId, liveTiles, extraContainers, conclusions, settingsHref }: Props) {
  const pid = propertyId ?? PROPERTY_ID;
  const cfg = pid === PROPERTY_ID ? DEPT_CFG[slug] : getDeptCfg(slug, pid);

  const subPages = rewriteSubPagesForProperty(cfg.subPages ?? [], pid);

  // PBS 2026-07-14 HOTFIX: compute report catalogue BEFORE the Promise.all
  // so the .in('template_key', allowedTemplateKeys) filters are legal (no TDZ).
  const reportTypes = cfg.reportTypes ?? [];
  // Generic daily/weekly/monthly template keys belong to Revenue's canonical
  // report catalogue. Other HoDs (operations, finance, marketing, holding_*)
  // surface ONLY their dept-specific report types so their Scheduled reports
  // + Send log don't pick up Revenue's daily digests.
  const includeGenericScheduled = slug === 'revenue';
  // PBS 2026-07-14 · Ops HoD surfaces the operations_daily template so the
  // Report Scheduler dropdown has a "Daily" that maps to render-operations-report
  // (not the revenue daily). Preview URL is dept-aware via previewHrefBuilder below.
  const includeOperationsScheduled = slug === 'operations';
  const reportOptions = [
    ...(includeGenericScheduled ? [
      { value: 'daily',   label: 'Daily report' },
      { value: 'weekly',  label: 'Weekly report' },
      { value: 'monthly', label: 'Monthly report' },
    ] : []),
    ...(includeOperationsScheduled ? [
      { value: 'operations_daily', label: 'Daily report' },
    ] : []),
    ...reportTypes.map((rt) => ({ value: rt.value, label: rt.label })),
  ];
  const allowedTemplateKeys = reportOptions.map((o) => o.value);
  // Sentinel avoids Supabase .in('template_key', []) throwing on empty allow-list.
  const templateFilter = allowedTemplateKeys.length > 0 ? allowedTemplateKeys : ['__none__'];

  const [dueTasksRes, scheduledRes, sendsRes, myReportsRes, shortcutsRes] = await Promise.all([
    supabase
      .from('v_hod_tasks_due')
      .select('id', { count: 'exact', head: true })
      .eq('dept_slug', slug)
      .eq('property_id', pid)
      .eq('is_due', true),
    supabase.from('v_revenue_report_recipients')
      .select('id, property_id, template_key, cadence, email, name, next_fire_at, created_at')
      .eq('property_id', pid)
      .in('template_key', templateFilter)
      .order('next_fire_at', { ascending: true }).limit(500),
    supabase.from('v_revenue_report_sends')
      .select('id, property_id, template_key, sent_at, recipient_email, created_by, report_name, status')
      .eq('property_id', pid)
      .in('template_key', templateFilter)
      .limit(200),
    supabase.from('v_revenue_report_sends')
      .select('id, property_id, template_key, sent_at, recipient_email, created_by, report_name, status')
      .eq('property_id', pid).eq('recipient_email', DEFAULT_USER_EMAIL)
      .in('template_key', templateFilter)
      .order('sent_at', { ascending: false }).limit(20),
    supabase.from('v_hod_shortcuts')
      .select('id, label, href, kind')
      .eq('property_id', pid).eq('dept_slug', slug).eq('user_email', DEFAULT_USER_EMAIL)
      .order('sort_order').limit(100),
  ]);

  const dueTasksCount = dueTasksRes.count ?? 0;
  const scheduledRows = (scheduledRes.data ?? []) as ScheduledRow[];
  const sendLogRows   = (sendsRes.data   ?? []) as SendLogRow[];
  const myReportRows  = (myReportsRes.data ?? []) as SendLogRow[];
  const allShortcuts  = (shortcutsRes.data ?? []) as Array<Shortcut & { kind?: string }>;
  const shortcuts     = allShortcuts.filter((s) => (s.kind ?? 'internal') === 'internal');
  const externalLinks = allShortcuts.filter((s) => s.kind === 'external') as ExternalLink[];

  const tiles: KpiTileProps[] = liveTiles ?? (cfg.kpiTiles ?? []).map((k) => ({
    label: k.k, value: k.v, size: 'sm', footnote: k.d,
  }));

  const hodTabs = subPages.map((s) => ({
    key: s.href, label: s.label, href: s.href,
    active: s.label === 'HoD',
  }));

  const chatHref = `/cockpit/chat?dept=${slug}`;

  const actionBar = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {settingsHref && (
        <a href={settingsHref} title="Settings" aria-label="Settings" style={gearBtnStyle}>⚙</a>
      )}
      <TenantLink href={chatHref} style={primaryBtnStyle}>{`Ask ${cfg.hodName} →`}</TenantLink>
    </div>
  );

  return (
    <DashboardPage
      title={`${cfg.pillTitle ?? slug} · ${cfg.hodName}`}
      subtitle={new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      tabs={hodTabs}
      action={actionBar}
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

      {/* Top row of 4 · Shortcuts / My Reports / My Tasks / External Links */}
      <div style={{ ...fullRow, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
        <Container title="Shortcuts" subtitle="Pin any page for one-click access · × to remove" density="compact">
          <ShortcutsPanel initial={shortcuts} propertyId={pid} deptSlug={slug} userEmail={DEFAULT_USER_EMAIL} />
        </Container>
        <Container title="My Reports" subtitle={`${myReportRows.length} report${myReportRows.length === 1 ? '' : 's'} sent to you · from send log`} density="compact">
          {myReportRows.length === 0 ? (
            <div style={{ fontSize: 11, color: '#5A5A5A', fontStyle: 'italic', padding: '8px 4px' }}>
              No reports have been sent to you yet. Add yourself as a recipient below.
            </div>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {myReportRows.map((r) => (
                <li key={r.id} style={{ fontSize: 11, color: '#1B1B1B', display: 'flex', gap: 6, alignItems: 'baseline' }}>
                  <span style={{ fontWeight: 600 }}>{r.report_name}</span>
                  <span style={{ color: '#5A5A5A' }}>· {new Date(r.sent_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </li>
              ))}
            </ul>
          )}
        </Container>
        <Container title="My Tasks" subtitle={dueTasksCount > 0 ? `${dueTasksCount} due · add / due-date / repeat / delete` : 'add / due-date / repeat / delete · per property'} density="compact">
          <HodTasksList deptSlug={slug} propertyId={pid} />
        </Container>
        <Container title="External links" subtitle="Extranet · Cloudbeds · SLH login · anywhere outside the cockpit" density="compact">
          <ExternalLinksPanel initial={externalLinks} propertyId={pid} deptSlug={slug} userEmail={DEFAULT_USER_EMAIL} />
        </Container>
      </div>

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

      {/* PBS 2026-07-14: Build-a-report container hidden on Operations HoD — duplicated
         function of the "Scheduled reports" recipient form below. Kept for Revenue etc. */}
      {reportTypes.length > 0 && slug !== 'operations' && (
        <div style={fullRow}>
          <Container title="Build a report" subtitle="pick a type · narrow with chips · open print-ready render" density="compact">
            <ReportBuilder reportTypes={reportTypes} hrefPrefix={pid === PROPERTY_ID ? '' : `/h/${pid}`} />
          </Container>
        </div>
      )}

      {extraContainers}

      {/* Scheduled reports + Send log — bottom of every HoD landing */}
      <div style={fullRow}>
        <Container title="Scheduled reports"
                   subtitle="Pick any report · pick a cadence · fires at 08:00 UTC · Preview per row · check + Dismiss to cancel"
                   density="compact">
          <ScheduledReportsTable
            rows={scheduledRows}
            propertyId={pid}
            reportOptions={reportOptions}
            previewHrefBuilder={(r) => {
              // PBS 2026-07-14 · Ops daily preview lives at /operations/reports/scheduled/daily/preview
              // and maps segment `daily` -> template_key `operations_daily` (see that page.tsx).
              if (r.template_key === 'operations_daily') {
                return `/operations/reports/scheduled/daily/preview?property_id=${r.property_id}`;
              }
              const key = ['daily','weekly','monthly'].includes(r.template_key) ? r.template_key : 'daily';
              return `/revenue/reports/scheduled/${key}/preview?property_id=${r.property_id}`;
            }}
          />
        </Container>
      </div>

      <div style={fullRow}>
        <Container title="Reports · send log"
                   subtitle="Every report ever sent · sort any column · bulk-delete with checkboxes"
                   density="compact">
          <SendLogTable rows={sendLogRows} />
        </Container>
      </div>
    </DashboardPage>
  );
}

const fullRow: React.CSSProperties = { gridColumn: '1 / -1' };
const primaryBtnStyle: React.CSSProperties = {
  fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
  padding: '6px 14px', borderRadius: 4,
  background: 'var(--primary, #1F3A2E)', color: '#FFFFFF', textDecoration: 'none',
};
const gearBtnStyle: React.CSSProperties = {
  fontSize: 16, lineHeight: 1, padding: '4px 8px', borderRadius: 4,
  background: '#FFFFFF', color: '#1B1B1B', border: '1px solid #E6DFCC',
  textDecoration: 'none', cursor: 'pointer',
};
