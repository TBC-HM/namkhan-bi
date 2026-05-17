// app/h/[property_id]/revenue/_DonnaRevenueCanonical.tsx
// Canonical Donna revenue surface scaffold. Mirrors the Namkhan reference
// layout (KPI tile band → period selector → 3-panel chart grid → tables)
// but renders state='data-needed' tiles + empty panels until the Donna
// PMS/booking feed is wired. PBS rule (2026-05-15): full canonical, no
// data yet, but set up in full.

import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import KpiBox from '@/components/kpi/KpiBox';
import PeriodSelectorRow from '@/components/page/PeriodSelectorRow';
import { REVENUE_SUBPAGES } from '@/app/revenue/_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';

export interface DonnaRevenueSurfaceConfig {
  /** Sub-route slug — used in eyebrow + basePath. */
  slug: string;
  /** Human title, sentence case. */
  title: string;
  /** KPI tile labels. Rendered in a 4-up grid wrap. */
  kpis: string[];
  /** Panel titles for the chart/table band below the tile row. */
  panels: string[];
  /** Optional table column headers (single canonical table at bottom). */
  tableColumns?: string[];
}

interface Props {
  propertyId: number;
  win?: string;
  cmp?: string;
  cfg: DonnaRevenueSurfaceConfig;
}

const NEEDS_NOTE = 'Donna PMS feed pending';

export default function DonnaRevenueCanonical({ propertyId, win, cmp, cfg }: Props) {
  const basePath = `/h/${propertyId}/revenue/${cfg.slug}`;
  const winActive = win ?? '30d';
  const cmpActive = cmp ?? 'lyf';
  const subPages = rewriteSubPagesForProperty(REVENUE_SUBPAGES, propertyId);

  return (
    <Page
      eyebrow={`Revenue · ${cfg.title} · property_id=${propertyId}`}
      title={cfg.title}
      subPages={subPages}
    >
      {cfg.kpis.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
            margin: '8px 0 4px',
          }}
        >
          {cfg.kpis.map((label) => (
            <KpiBox
              key={label}
              label={label}
              value={null}
              unit="text"
              state="data-needed"
              needs={NEEDS_NOTE}
            />
          ))}
        </div>
      )}

      <PeriodSelectorRow basePath={basePath} win={winActive} cmp={cmpActive} />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 12,
        }}
      >
        {cfg.panels.map((title) => (
          <Panel key={title} title={title} eyebrow="empty" expandable={false}>
            <EmptyChart label={title} />
          </Panel>
        ))}
      </div>

      {cfg.tableColumns && cfg.tableColumns.length > 0 && (
        <Panel title={`${cfg.title} · detail`} eyebrow="empty" expandable={false}>
          <EmptyTable columns={cfg.tableColumns} />
        </Panel>
      )}
    </Page>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div
      style={{
        height: 180,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 8,
        background:
          'repeating-linear-gradient(0deg, transparent, transparent 23px, var(--tbl-border, rgba(26,26,26,0.08)) 23px, var(--tbl-border, rgba(26,26,26,0.08)) 24px), ' +
          'repeating-linear-gradient(90deg, transparent, transparent 31px, var(--tbl-border, rgba(26,26,26,0.08)) 31px, var(--tbl-border, rgba(26,26,26,0.08)) 32px)',
        border: '1px solid var(--tbl-border, rgba(26,26,26,0.10))',
        borderRadius: 4,
      }}
      aria-label={`${label} chart placeholder`}
    >
      <div
        style={{
          fontSize: 'var(--t-xs)',
          letterSpacing: '0.08em',
          color: 'var(--brass)',
          fontFamily: 'var(--mono)',
        }}
      >
        DATA NEEDED
      </div>
      <div
        style={{
          fontSize: 'var(--t-xs)',
          color: 'var(--tbl-fg-mute, rgba(26,26,26,0.6))',
        }}
      >
        {NEEDS_NOTE}
      </div>
    </div>
  );
}

function EmptyTable({ columns }: { columns: string[] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 'var(--t-sm)',
          color: 'var(--tbl-fg, #1A1A1A)',
        }}
      >
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c}
                style={{
                  textAlign: 'left',
                  padding: '8px 10px',
                  borderBottom: '1px solid var(--tbl-border-strong, rgba(26,26,26,0.18))',
                  color: 'var(--tbl-fg, #1A1A1A)',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                }}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 4 }).map((_, i) => (
            <tr key={i}>
              {columns.map((c, j) => (
                <td
                  key={c}
                  style={{
                    padding: '10px',
                    borderBottom: '1px solid var(--tbl-border, rgba(26,26,26,0.08))',
                    color: 'var(--tbl-fg-mute, rgba(26,26,26,0.5))',
                    fontStyle: j === 0 ? 'italic' : 'normal',
                  }}
                >
                  {j === 0 && i === 0 ? NEEDS_NOTE : '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
