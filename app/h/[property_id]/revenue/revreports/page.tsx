// app/h/[property_id]/revenue/revreports/page.tsx
// Revenue › RevReports — the revenue-management half of the Cloudbeds stock report
// catalog. Same machinery as Administration › Reports (same catalog view, same sync /
// download / email routes, same table component); only the report set differs, so the
// two surfaces cannot drift apart. Catalog + subset live in lib/cb-reports.ts.
//
// Sits beside Forecast on the Revenue HoD sub-strip (lib/nav-subgroups.ts).

import { notFound } from 'next/navigation';
import { DashboardPage, Container, KpiTile } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { REVENUE_SUBPAGES } from '@/app/revenue/_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';
import { REVENUE_REPORTS, STARRED_REPORT_IDS } from '@/lib/cb-reports';
import ReportsTableClient from '@/app/h/[property_id]/admin/reports/ReportsTableClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props { params: { property_id: string } }

function relTime(iso: string): string {
  const d = new Date(iso);
  const m = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return days < 30 ? `${days}d ago` : d.toISOString().slice(0, 10);
}

export default async function RevReportsPage({ params }: Props) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId) || propertyId <= 0) notFound();

  const sb = getSupabaseAdmin();
  const { data: catData } = await sb
    .from('v_stock_reports_catalog' as never)
    .select('*')
    .eq('property_id', propertyId)
    .order('report_id' as never);

  const catalog: any[] = (catData ?? []) as any[];
  const catalogById = newestByReportId(catalog);
  const ids = Object.keys(REVENUE_REPORTS).map(Number);

  // Counters describe the REVENUE subset only — the Administration page owns the
  // whole-catalog numbers, and two pages quoting different totals for "reports
  // synced" would be read as a bug.
  // Deduped, so a report synced under two names counts once and its rows are not doubled.
  const mine = ids.map((id) => catalogById.get(id)).filter(Boolean) as any[];
  const syncedCount = mine.length;
  const totalRows = mine.reduce((s, r) => s + Number(r.total_rows ?? 0), 0);
  const withData = mine.filter((r) => Number(r.total_rows ?? 0) > 0).length;
  const lastSync = mine.reduce(
    (best: string, r: any) => (!best || r.last_synced_at > best ? r.last_synced_at : best), '');

  const tabs = rewriteSubPagesForProperty(REVENUE_SUBPAGES, propertyId).map((s) => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href.endsWith('/revenue'),
  }));

  return (
    <DashboardPage
      title="Revenue · RevReports"
      subtitle={`${ids.length} revenue reports · ${syncedCount} synced · ${totalRows.toLocaleString()} rows`}
      tabs={tabs}
    >
      <div style={fullRow}>
        <Container title="Sync overview" subtitle="revenue report set only" density="compact">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8 }}>
            <KpiTile label="Revenue reports" value={ids.length} size="sm" footnote="in this set" />
            <KpiTile label="Synced" value={syncedCount} size="sm"
                     status={syncedCount > 0 ? 'green' : 'grey'} footnote={`of ${ids.length}`} />
            <KpiTile label="With data" value={withData} size="sm"
                     status={withData > 0 ? 'green' : 'amber'} footnote="rows > 0" />
            <KpiTile label="Total rows" value={totalRows} size="sm" />
            {lastSync && <KpiTile label="Last sync" value={relTime(lastSync) as never} size="sm" />}
          </div>
        </Container>
      </div>

      <div style={fullRow}>
        <Container
          title="Revenue reports"
          subtitle={`★ the ${STARRED_REPORT_IDS.length} priority reports are pinned on top · rate · channel · pace · ancillary · scope=stock_report via sync-cloudbeds`}
          density="compact"
        >
          <ReportsTableClient
            rows={Object.entries(REVENUE_REPORTS).map(([idStr, meta]) => ({
              id: Number(idStr),
              meta,
              synced: catalogById.get(Number(idStr)) ?? null,
            }))}
            propertyId={propertyId}
            starredIds={STARRED_REPORT_IDS}
          />
        </Container>
      </div>
    </DashboardPage>
  );
}

const fullRow: React.CSSProperties = { gridColumn: '1 / -1' };

// v_stock_reports_catalog groups by (report_id, report_name), so a report that has been
// synced under more than one name — several were renamed on 2026-09-06 when the catalog
// was rebuilt from the Cloudbeds API — appears once per name. A plain .find() would then
// return whichever row happens to come first, which can be the stale one (report 309 had
// a 2-row stub alongside its real 6-row snapshot). Always take the most recently synced.
function newestByReportId(catalog: any[]): Map<number, any> {
  const best = new Map<number, any>();
  for (const row of catalog) {
    const id = Number(row.report_id);
    const cur = best.get(id);
    if (!cur || String(row.last_synced_at ?? '') > String(cur.last_synced_at ?? '')) best.set(id, row);
  }
  return best;
}
