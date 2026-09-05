// app/h/[property_id]/admin/reports/page.tsx
// Cloudbeds Stock Reports catalog + BI aggregations (monthly revenue, trial balance).
// Reads: v_stock_reports_catalog, v_monthly_revenue_cb, v_trial_balance_monthly_cb
// All data comes from insights.stock_reports_cb, insights.daily_revenue_cb,
// finance.trial_balance_cb (synced by sync-cloudbeds v46 edge function).

import { notFound } from 'next/navigation';
import { DashboardPage, Container, KpiTile } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { financeSubPagesForProperty } from '@/app/finance/_subpages';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props { params: { property_id: string } }

// Known stock reports (reportId → human label + category)
const KNOWN_REPORTS: Record<number, { label: string; category: string }> = {
  // ── Revenue ──────────────────────────────────────────────────────────────
  74:  { label: 'Daily Revenue Report',              category: 'Revenue'      },
  75:  { label: 'Monthly Revenue Summary',           category: 'Revenue'      },
  76:  { label: 'Revenue by Room Type',              category: 'Revenue'      },
  77:  { label: 'Revenue by Rate Plan',              category: 'Revenue'      },
  78:  { label: 'Revenue by Market Segment',         category: 'Revenue'      },
  79:  { label: 'Revenue by Channel',                category: 'Revenue'      },
  92:  { label: 'RevPAR Analysis',                   category: 'Revenue'      },
  93:  { label: 'Pace Report',                       category: 'Revenue'      },
  94:  { label: 'Pickup Report',                     category: 'Revenue'      },
  95:  { label: 'Future Revenue on Books',           category: 'Revenue'      },
  // ── Finance ──────────────────────────────────────────────────────────────
  83:  { label: 'Payment Reconciliation',            category: 'Finance'      },
  61:  { label: 'Cashier Report',                    category: 'Finance'      },
  62:  { label: 'Night Audit Summary',               category: 'Finance'      },
  63:  { label: 'Night Audit Detail',                category: 'Finance'      },
  168: { label: 'Voids, Adjustments & Refunds',      category: 'Finance'      },
  84:  { label: 'Bank Reconciliation',               category: 'Finance'      },
  85:  { label: 'Trial Balance',                     category: 'Finance'      },
  86:  { label: 'General Ledger Summary',            category: 'Finance'      },
  87:  { label: 'A/R Aging Report',                  category: 'Finance'      },
  88:  { label: 'A/P Summary Report',                category: 'Finance'      },
  89:  { label: 'Commission Report',                 category: 'Finance'      },
  90:  { label: 'Travel Agent Report',               category: 'Finance'      },
  91:  { label: 'Corporate Account Revenue',         category: 'Finance'      },
  96:  { label: 'Rate Variance Report',              category: 'Finance'      },
  // ── Ledger ───────────────────────────────────────────────────────────────
  306: { label: 'Deposit Ledger with Details',       category: 'Ledger'       },
  309: { label: 'AR Ledger with Details',            category: 'Ledger'       },
  311: { label: 'Current Ledger with Details',       category: 'Ledger'       },
  304: { label: 'Pre-Stay Deposit Report',           category: 'Ledger'       },
  305: { label: 'Guest Ledger',                      category: 'Ledger'       },
  // ── Transactions ─────────────────────────────────────────────────────────
  38:  { label: 'Expanded Transaction Report',       category: 'Transactions' },
  39:  { label: 'Daily Transaction Summary',         category: 'Transactions' },
  40:  { label: 'Folio Transaction Report',          category: 'Transactions' },
  // ── Operations ───────────────────────────────────────────────────────────
  50:  { label: 'Arrivals Report',                   category: 'Operations'   },
  51:  { label: 'Departures Report',                 category: 'Operations'   },
  52:  { label: 'In-House Guest List',               category: 'Operations'   },
  53:  { label: 'Housekeeping Report',               category: 'Operations'   },
  54:  { label: 'Housekeeping Assignment',           category: 'Operations'   },
  55:  { label: 'Room Status Report',                category: 'Operations'   },
  56:  { label: 'Maintenance Report',                category: 'Operations'   },
  57:  { label: 'Out-of-Order Rooms',               category: 'Operations'   },
  58:  { label: 'Occupancy Report',                  category: 'Operations'   },
  59:  { label: 'No-Show Report',                    category: 'Operations'   },
  60:  { label: 'Cancellation Report',               category: 'Operations'   },
  // ── Guests ───────────────────────────────────────────────────────────────
  100: { label: 'Guest History Report',              category: 'Guests'       },
  101: { label: 'Booking Report',                    category: 'Guests'       },
  102: { label: 'Group Pickup Report',               category: 'Guests'       },
  103: { label: 'No-Show / Early Departure',         category: 'Guests'       },
  // ── Management ───────────────────────────────────────────────────────────
  110: { label: 'Manager\'s Daily Report',           category: 'Management'   },
  111: { label: 'Daily Recap Summary',               category: 'Management'   },
  112: { label: 'Monthly Manager Summary',           category: 'Management'   },
};

function relTime(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const m = Math.floor(diffMs / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return days < 30 ? `${days}d ago` : d.toISOString().slice(0, 10);
}

function fmtNum(n: string | number | null | undefined): string {
  if (n == null) return '—';
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function fmtAmt(n: string | number | null | undefined): string {
  if (n == null) return '—';
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default async function AdminReportsPage({ params }: Props) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId) || propertyId <= 0) notFound();

  const sb = getSupabaseAdmin();

  const [catData, monthlyData, tbData] = await Promise.all([
    sb.from('v_stock_reports_catalog' as never).select('*').eq('property_id', propertyId).order('report_id' as never),
    sb.from('v_monthly_revenue_cb' as never).select('*').eq('property_id', propertyId).order('month_start' as never, { ascending: false }),
    sb.from('v_trial_balance_monthly_cb' as never).select('*').eq('property_id', propertyId).order('month_start' as never, { ascending: false }),
  ]);

  const catalog: any[] = (catData.data ?? []) as any[];
  const monthly: any[] = (monthlyData.data ?? []) as any[];
  const tbMonthly: any[] = (tbData.data ?? []) as any[];

  const totalSnapshots = catalog.reduce((s: number, r: any) => s + Number(r.snapshot_count ?? 0), 0);
  const totalRows      = catalog.reduce((s: number, r: any) => s + Number(r.total_rows ?? 0), 0);
  const lastSync       = catalog.reduce((best: string, r: any) => (!best || r.last_synced_at > best ? r.last_synced_at : best), '');

  // Full Administration sub-nav — stays consistent with all other Finance/Admin pages
  const tabs = financeSubPagesForProperty(propertyId).map(s => ({
    key: s.href,
    label: s.label,
    href: s.href,
    active: s.href.includes('/admin/reports'),
  }));

  return (
    <DashboardPage
      title="Cloudbeds Reports"
      subtitle={`${catalog.length} report types · ${totalSnapshots} snapshots · ${totalRows.toLocaleString()} rows synced`}
      tabs={tabs}
    >
      {/* KPI strip */}
      <div style={fullRow}>
        <Container title="Sync overview" density="compact">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8 }}>
            <KpiTile label="Report types synced" value={catalog.length} size="sm" />
            <KpiTile label="Total snapshots" value={totalSnapshots} size="sm" />
            <KpiTile label="Total rows" value={totalRows} size="sm" />
            {lastSync && (
              <KpiTile label="Last sync" value={relTime(lastSync) as never} size="sm" />
            )}
          </div>
        </Container>
      </div>

      {/* Stock report catalog */}
      <div style={fullRow}>
        <Container
          title="Cloudbeds stock reports catalog"
          subtitle="Reports synced via sync-cloudbeds edge function · scope=stock_report"
          density="compact"
        >
          {catalog.length === 0 ? (
            <div style={emptyStyle}>
              No stock reports synced yet. Trigger a sync by calling the edge function with
              {' '}<code>scope=stock_report</code> + <code>reportId</code> + <code>reportName</code>.
              <br /><br />
              <strong>Key report IDs:</strong> 74 (Daily Revenue), 83 (Payment Reconciliation),
              61 (Cashier), 168 (Voids), 306 (Deposit Ledger), 309 (AR Ledger), 311 (Current Ledger), 38 (Expanded Transaction)
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr style={theadRow}>
                    <th style={th}>ID</th>
                    <th style={th}>Report</th>
                    <th style={th}>Category</th>
                    <th style={th}>Snapshots</th>
                    <th style={th}>Date range</th>
                    <th style={th}>Rows</th>
                    <th style={th}>Last sync</th>
                    <th style={th}>Download</th>
                  </tr>
                </thead>
                <tbody>
                  {catalog.map((r: any) => {
                    const meta = KNOWN_REPORTS[r.report_id] ?? { label: r.report_name, category: 'Other' };
                    const downloadUrl = `/api/admin/reports/download?property_id=${propertyId}&report_id=${r.report_id}`;
                    const hasData = Number(r.total_rows ?? 0) > 0;
                    return (
                      <tr key={r.report_id} style={trRow}>
                        <td style={tdMono}>{r.report_id}</td>
                        <td style={tdLeft}>
                          <span style={reportLabel}>{meta.label}</span>
                        </td>
                        <td style={tdLeft}>
                          <span style={{ ...catPill, ...catColor(meta.category) }}>{meta.category}</span>
                        </td>
                        <td style={tdRight}>{fmtNum(r.snapshot_count)}</td>
                        <td style={tdLeft}>
                          <span style={{ fontSize: 11, color: 'var(--tbl-fg-mute, #5A5A5A)', fontVariantNumeric: 'tabular-nums' }}>
                            {r.earliest_date} → {r.latest_date}
                          </span>
                        </td>
                        <td style={tdRight}>{fmtNum(r.total_rows)}</td>
                        <td style={tdLeft}>
                          <span style={{ fontSize: 11, color: 'var(--tbl-fg-mute, #5A5A5A)' }}>
                            {r.last_synced_at ? relTime(r.last_synced_at) : '—'}
                          </span>
                        </td>
                        <td style={tdLeft}>
                          {hasData ? (
                            <a href={downloadUrl} style={downloadBtn}>
                              ↓ CSV
                            </a>
                          ) : (
                            <span style={{ fontSize: 10, color: 'var(--tbl-fg-mute, #5A5A5A)' }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Container>
      </div>

      {/* Monthly revenue breakdown */}
      <div style={fullRow}>
        <Container
          title="Monthly revenue"
          subtitle="Aggregated from insights.daily_revenue_cb (stock report 74) · v_monthly_revenue_cb"
          density="compact"
        >
          {monthly.length === 0 ? (
            <div style={emptyStyle}>No monthly revenue data yet. Sync stock report 74 (Daily Revenue) first.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr style={theadRow}>
                    <th style={th}>Month</th>
                    <th style={th}>Days</th>
                    <th style={th}>Room Revenue</th>
                    <th style={th}>Other Revenue</th>
                    <th style={th}>Taxes</th>
                    <th style={th}>Fees</th>
                    <th style={th}>Total Revenue</th>
                    <th style={th}>Cancel Fees</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((r: any) => (
                    <tr key={r.month_key} style={trRow}>
                      <td style={tdLeft}><span style={monthPill}>{r.month_key}</span></td>
                      <td style={tdRight}>{r.days_with_data}</td>
                      <td style={tdRight}>{fmtAmt(r.room_revenue_total)}</td>
                      <td style={tdRight}>{fmtAmt(r.other_revenue_total)}</td>
                      <td style={tdRight}>{fmtAmt(r.taxes_total)}</td>
                      <td style={tdRight}>{fmtAmt(r.fees_total)}</td>
                      <td style={{ ...tdRight, fontWeight: 700 }}>{fmtAmt(r.total_revenue)}</td>
                      <td style={tdRight}>{fmtAmt(r.cancel_fees_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Container>
      </div>

      {/* Trial balance monthly */}
      <div style={fullRow}>
        <Container
          title="Trial balance · monthly summary"
          subtitle="Aggregated from finance.trial_balance_cb (Accounting API) · v_trial_balance_monthly_cb"
          density="compact"
        >
          {tbMonthly.length === 0 ? (
            <div style={emptyStyle}>No trial balance data yet. Sync scope=trial_balance first.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr style={theadRow}>
                    <th style={th}>Month</th>
                    <th style={th}>Days</th>
                    <th style={th}>GL Charges</th>
                    <th style={th}>GL Activity</th>
                    <th style={th}>Deposit Activity</th>
                    <th style={th}>AR Activity</th>
                    <th style={th}>Total Activity</th>
                    <th style={th}>Avg Hotel Close</th>
                  </tr>
                </thead>
                <tbody>
                  {tbMonthly.map((r: any) => (
                    <tr key={r.month_key} style={trRow}>
                      <td style={tdLeft}><span style={monthPill}>{r.month_key}</span></td>
                      <td style={tdRight}>{r.days_with_data}</td>
                      <td style={tdRight}>{fmtAmt(r.total_gl_charges)}</td>
                      <td style={tdRight}>{fmtAmt(r.total_gl_activity)}</td>
                      <td style={tdRight}>{fmtAmt(r.total_deposit_activity)}</td>
                      <td style={tdRight}>{fmtAmt(r.total_ar_activity)}</td>
                      <td style={{ ...tdRight, fontWeight: 700 }}>{fmtAmt(r.total_activity)}</td>
                      <td style={tdRight}>{fmtAmt(r.avg_hotel_closing)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Container>
      </div>

      {/* Sync reference */}
      <div style={fullRow}>
        <Container
          title="Sync reference"
          subtitle="Edge function: sync-cloudbeds v46 · stock_report scope · data lands in insights.stock_reports_cb"
          density="compact"
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr style={theadRow}>
                  <th style={th}>ID</th>
                  <th style={th}>Report</th>
                  <th style={th}>Category</th>
                  <th style={th}>Sync payload (replace YYYY-MM-DD)</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(KNOWN_REPORTS).map(([id, meta]) => (
                  <tr key={id} style={trRow}>
                    <td style={tdMono}>{id}</td>
                    <td style={tdLeft}>{meta.label}</td>
                    <td style={tdLeft}>
                      <span style={{ ...catPill, ...catColor(meta.category) }}>{meta.category}</span>
                    </td>
                    <td style={{ ...tdLeft, maxWidth: 520 }}>
                      <code style={{ fontSize: 10, color: 'var(--tbl-fg-mute, #5A5A5A)', wordBreak: 'break-all' }}>
                        {`{"scope":"stock_report","propertyID":${propertyId},"reportId":${id},"reportName":"${meta.label}","fromDate":"YYYY-MM-DD","toDate":"YYYY-MM-DD"}`}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      </div>
    </DashboardPage>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const fullRow: React.CSSProperties = { gridColumn: '1 / -1' };

const emptyStyle: React.CSSProperties = {
  padding: 20,
  color: 'var(--tbl-fg-mute, #5A5A5A)',
  fontStyle: 'italic',
  fontSize: 13,
  lineHeight: 1.6,
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 12,
};

const theadRow: React.CSSProperties = {
  borderBottom: '1px solid var(--tbl-border, #E6DFCC)',
};

const th: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--tbl-fg-mute, #5A5A5A)',
  textAlign: 'left',
  whiteSpace: 'nowrap',
};

const trRow: React.CSSProperties = {
  borderBottom: '1px solid var(--tbl-border, #E6DFCC)',
};

const tdLeft: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 12,
  color: 'var(--tbl-fg, #1B1B1B)',
  verticalAlign: 'middle',
};

const tdRight: React.CSSProperties = {
  ...tdLeft,
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
};

const tdMono: React.CSSProperties = {
  ...tdLeft,
  fontFamily: 'monospace',
  fontSize: 11,
  color: 'var(--tbl-fg-mute, #5A5A5A)',
};

const reportLabel: React.CSSProperties = {
  fontWeight: 500,
};

const catPill: React.CSSProperties = {
  display: 'inline-block',
  padding: '1px 7px',
  borderRadius: 99,
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.04em',
};

function catColor(cat: string): React.CSSProperties {
  const map: Record<string, React.CSSProperties> = {
    Revenue:      { background: 'rgba(31,58,46,0.08)',  color: '#1F3A2E' },
    Finance:      { background: 'rgba(184,88,42,0.08)', color: '#B8542A' },
    Ledger:       { background: 'rgba(68,85,200,0.08)', color: '#4455C8' },
    Transactions: { background: 'rgba(90,90,90,0.08)',  color: '#3A3A3A' },
    Other:        { background: 'rgba(90,90,90,0.06)',  color: '#5A5A5A' },
  };
  return map[cat] ?? map.Other;
}

const monthPill: React.CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 4,
  background: 'var(--tbl-bg-elev, #F5F0E1)',
  color: 'var(--tbl-fg, #1B1B1B)',
  fontSize: 11,
  fontWeight: 700,
  fontVariantNumeric: 'tabular-nums',
  letterSpacing: '0.02em',
};

const downloadBtn: React.CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px',
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.04em',
  background: 'rgba(31,58,46,0.06)',
  color: '#1F3A2E',
  border: '1px solid rgba(31,58,46,0.2)',
  borderRadius: 3,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
};

