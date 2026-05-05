// app/operations/catalog-cleanup/page.tsx
//
// Cloudbeds Catalog Cleanup queue. Surfaces every dirty item across the
// catalog (last 180d) so we can fix the source data — rename SKUs, set
// item_category_name, anchor USALI rules, kill multi-variant slash names.
//
// Source: public.v_catalog_dirty (created 2026-05-03). Flags evaluated:
//   - f_unclassified       (USALI bucket missing)
//   - f_multi_price        (>2.5× price spread on the same SKU)
//   - f_missing_duration   (Spa item without "60 min" / "90 min" in name)
//   - f_lak_converted      (≥25% of lines have non-retail cents — LAK conversion)
//   - f_dirty_name         (slash, trailing dash, missing category, ≤4-char name)

import SlimHero from '@/components/sections/SlimHero';
import KpiStrip, { type KpiStripItem } from '@/components/kpi/KpiStrip';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import CleanupTableClient, { type DirtyRow } from './_CleanupTableClient';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

interface DeptSummary {
  total: number;
  open: number;
  decided: number;
  unclassified: number;
  multi_price: number;
  missing_duration: number;
  lak_converted: number;
  dirty_name: number;
  byDept: Array<{ dept: string; items: number; rev: number }>;
}

async function getRows(): Promise<{ rows: DirtyRow[]; summary: DeptSummary }> {
  const empty: DirtyRow[] = [];
  const emptySummary: DeptSummary = {
    total: 0, open: 0, decided: 0,
    unclassified: 0, multi_price: 0, missing_duration: 0,
    lak_converted: 0, dirty_name: 0, byDept: [],
  };
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e) {
    // eslint-disable-next-line no-console
    console.error('[catalog-cleanup] supabaseAdmin', e);
    return { rows: empty, summary: emptySummary };
  }
  const { data, error } = await admin
    .from('v_catalog_dirty')
    .select('*')
    .limit(1500);
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[catalog-cleanup] getRows', error);
    return { rows: empty, summary: emptySummary };
  }
  const rows = (data ?? []) as DirtyRow[];

  const summary: DeptSummary = {
    total: rows.length,
    open:    rows.filter(r => r.decision_id == null).length,
    decided: rows.filter(r => r.decision_id != null).length,
    unclassified:     rows.filter(r => r.f_unclassified).length,
    multi_price:      rows.filter(r => r.f_multi_price).length,
    missing_duration: rows.filter(r => r.f_missing_duration).length,
    lak_converted:    rows.filter(r => r.f_lak_converted).length,
    dirty_name:       rows.filter(r => r.f_dirty_name).length,
    byDept: Object.entries(
      rows.reduce<Record<string, { items: number; rev: number }>>((acc, r) => {
        const k = r.usali_dept || 'Unclassified';
        if (!acc[k]) acc[k] = { items: 0, rev: 0 };
        acc[k].items += 1;
        acc[k].rev += Number(r.revenue_usd || 0);
        return acc;
      }, {})
    )
      .map(([dept, x]) => ({ dept, ...x }))
      .sort((a, b) => b.items - a.items),
  };
  return { rows, summary };
}

export default async function CatalogCleanupPage() {
  const { rows, summary } = await getRows();

  return (
    <>
      <SlimHero
        eyebrow="Operations · Catalog cleanup"
        title="Cloudbeds"
        emphasis="cleanup queue"
        sub={`${summary.total} dirty SKUs · last 180d · sorted by score, then revenue`}
      />

      {/* Strip 1 — Queue status */}
      <KpiStrip
        items={[
          { label: 'Open · undecided', value: summary.open, kind: 'count', tone: summary.open > 0 ? 'warn' : 'pos', hint: `${summary.total} surfaced total` },
          { label: 'Decided',         value: summary.decided, kind: 'count', tone: 'pos', hint: 'apply in Cloudbeds, then mark applied' },
          { label: 'Departments hit', value: summary.byDept.length, kind: 'count', hint: 'click a card below' },
          { label: 'Total revenue', value: summary.byDept.reduce((s, d) => s + d.rev, 0), kind: 'money', hint: 'lifetime touched by dirty SKUs' },
        ] satisfies KpiStripItem[]}
      />

      {/* Strip 2 — Flag-type counts */}
      <KpiStrip
        items={[
          { label: 'Unclassified',    value: summary.unclassified, kind: 'count', hint: 'USALI bucket missing' },
          { label: 'Multi-price',     value: summary.multi_price, kind: 'count', hint: '> 2.5× price spread' },
          { label: 'No duration',     value: summary.missing_duration, kind: 'count', hint: 'spa min-tag missing' },
          { label: 'LAK-converted',   value: summary.lak_converted, kind: 'count', hint: 'price set in LAK, not USD' },
          { label: 'Bad name / cat',  value: summary.dirty_name, kind: 'count', hint: 'slash, dash, missing cat' },
          { label: 'Need rules',      value: summary.unclassified + summary.dirty_name, kind: 'count', hint: 'usali_category_map fix' },
        ] satisfies KpiStripItem[]}
      />

      {/* Department roll-up */}
      <h2 style={{
        marginTop: 28,
        marginBottom: 10,
        fontFamily: 'var(--mono)',
        fontSize: 'var(--t-xs)',
        letterSpacing: 'var(--ls-extra)',
        textTransform: 'uppercase',
        color: 'var(--brass)',
      }}>By department</h2>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 10,
      }}>
        {summary.byDept.map(d => (
          <div key={d.dept} style={{
            padding: '10px 12px',
            border: '1px solid var(--rule, #e3dfd3)',
            background: 'var(--paper, #fbf9f3)',
          }}>
            <div style={{
              fontFamily: 'var(--mono)',
              fontSize: 'var(--t-xs)',
              letterSpacing: 'var(--ls-extra)',
              textTransform: 'uppercase',
              color: 'var(--brass)',
            }}>{d.dept}</div>
            <div style={{
              fontFamily: 'var(--serif)',
              fontStyle: 'italic',
              fontSize: 'var(--t-2xl)',
              color: 'var(--ink, #2c2a25)',
              marginTop: 2,
            }}>{d.items}</div>
            <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-soft)' }}>
              ${Math.round(d.rev).toLocaleString('en-US')} revenue touched
            </div>
          </div>
        ))}
      </div>

      {/* Master cleanup queue */}
      <h2 style={{
        marginTop: 28,
        marginBottom: 10,
        fontFamily: 'var(--mono)',
        fontSize: 'var(--t-xs)',
        letterSpacing: 'var(--ls-extra)',
        textTransform: 'uppercase',
        color: 'var(--brass)',
      }}>Cleanup queue · {rows.length} items</h2>
      <CleanupTableClient rows={rows} />

      {/* Field guide */}
      <div style={{
        marginTop: 22,
        padding: '12px 14px',
        background: 'var(--paper-deep, #f6f3ec)',
        borderLeft: '2px solid var(--brass)',
        fontSize: 'var(--t-xs)',
        color: 'var(--ink-soft)',
        lineHeight: 1.6,
      }}>
        <div style={{
          fontFamily: 'var(--mono)',
          textTransform: 'uppercase',
          letterSpacing: 'var(--ls-extra)',
          color: 'var(--brass)',
          fontSize: 'var(--t-xs)',
          marginBottom: 6,
        }}>How to clean</div>
        <strong>Re-flag USALI</strong>: edit <code style={{ fontFamily: 'var(--mono)' }}>usali_category_map</code> rules (DB) — add a row matching the description / item_category_name. <br />
        <strong>Split SKU in Cloudbeds</strong>: in Cloudbeds → Manage → Items, the SKU with &gt;2.5× price spread is hiding two real items. Rename one, give it its own price. <br />
        <strong>Add duration</strong>: rename spa SKUs to include &quot;(60 min)&quot; / &quot;(90 min)&quot;. <br />
        <strong>Set USD price</strong>: items with .55 / .82 / .09 cents are LAK-base; set them in USD with round prices. <br />
        <strong>Set category</strong>: items with empty <code style={{ fontFamily: 'var(--mono)' }}>item_category_name</code> need a category in Cloudbeds.
      </div>
    </>
  );
}
