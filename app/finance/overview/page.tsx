// app/finance/overview/page.tsx
// PBS 2026-07-07: dedicated Finance Overview landing. The HoD chat cockpit
// stays at /finance; Overview is the dept-wide summary with entry cards
// linking to the major finance groups (Finance / Transactions / HR / Budget
// / Working capital / Reports).
// PBS 2026-09-05: added CB Monthly Revenue (Section A) + 13-week Cash Forward
// (Section B) from live DB views.
import React from 'react';
import TenantLink from '@/components/nav/TenantLink';
import { DashboardPage, Container, KpiTile, type DashboardTab } from '@/app/(cockpit)/_design';
import { DEPT_CFG } from '@/lib/dept-cfg';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── Types ────────────────────────────────────────────────────────────────────

interface MonthlyRow {
  month_key: string;
  days_with_data: number;
  room_revenue_total: number | null;
  other_revenue_total: number | null;
  total_revenue: number | null;
  last_synced_at: string | null;
}

interface CashRow {
  week_start: string;
  week_idx: number;
  iso_week: string;
  line_key: string;
  line_label: string;
  amount_usd: number | null;
  currency_layer: string;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtAmt(n: number | null | undefined): string {
  if (n == null) return '—';
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function relTime(iso: string | null | undefined): string {
  if (!iso) return '—';
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

// ─── Module-scope sub-components ─────────────────────────────────────────────
// Rule: never define a component INSIDE an async Server Component. These are
// at module scope and may be used as <Component />.

function MonthlyRevenueTable({ rows }: { rows: MonthlyRow[] }) {
  if (rows.length === 0) {
    return (
      <div style={emptyStyle}>
        No CB monthly revenue data. Sync stock report 74 (Daily Revenue) via{' '}
        <code>sync-cloudbeds</code> edge function first.
      </div>
    );
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={tableStyle}>
        <thead>
          <tr style={theadRow}>
            <th style={th}>Month</th>
            <th style={{ ...th, textAlign: 'right' }}>Room Revenue</th>
            <th style={{ ...th, textAlign: 'right' }}>Other Revenue</th>
            <th style={{ ...th, textAlign: 'right' }}>Total Revenue</th>
            <th style={{ ...th, textAlign: 'right' }}>Days</th>
            <th style={th}>Synced</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.month_key} style={trRow}>
              <td style={tdLeft}><span style={monthPill}>{r.month_key}</span></td>
              <td style={tdRight}>{fmtAmt(r.room_revenue_total)}</td>
              <td style={tdRight}>{fmtAmt(r.other_revenue_total)}</td>
              <td style={{ ...tdRight, fontWeight: 700 }}>{fmtAmt(r.total_revenue)}</td>
              <td style={tdRight}>{r.days_with_data ?? '—'}</td>
              <td style={tdLeft}>
                <span style={{ fontSize: 11, color: 'var(--tbl-fg-mute, #5A5A5A)' }}>
                  {relTime(r.last_synced_at)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CashForwardTable({ rows }: { rows: CashRow[] }) {
  if (rows.length === 0) {
    return (
      <div style={emptyStyle}>
        No 13-week cash forward data. Check <code>public.v_cash_forward_13w</code>{' '}
        and ensure the GL + PMS views it aggregates are populated.
      </div>
    );
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={tableStyle}>
        <thead>
          <tr style={theadRow}>
            <th style={th}>Week</th>
            <th style={th}>Line</th>
            <th style={{ ...th, textAlign: 'right' }}>Amount USD</th>
            <th style={th}>Currency layer</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.week_idx}-${r.line_key}-${i}`} style={trRow}>
              <td style={tdLeft}>
                <span style={monthPill}>{r.iso_week}</span>
                <span style={{ fontSize: 10, color: 'var(--tbl-fg-mute, #5A5A5A)', marginLeft: 4 }}>
                  {r.week_start}
                </span>
              </td>
              <td style={tdLeft}>{r.line_label}</td>
              <td style={{ ...tdRight, fontWeight: r.line_key === 'closing_balance' ? 700 : 400 }}>
                {fmtAmt(r.amount_usd)}
              </td>
              <td style={{ ...tdLeft, fontSize: 11, color: 'var(--tbl-fg-mute, #5A5A5A)' }}>
                {r.currency_layer}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface Props {
  /** Tenant delegate at /h/[property_id]/finance/overview passes propertyId. */
  propertyId?: number;
}

export default async function FinanceOverviewPage({ propertyId }: Props) {
  const pid = propertyId ?? PROPERTY_ID;
  const cfg = DEPT_CFG.finance;
  const tabs: DashboardTab[] = cfg.subPages.map(s => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href === '/finance/overview',
  }));

  const sb = getSupabaseAdmin();

  const [monthly, ytdRaw, cashRows] = await Promise.all([
    Promise.resolve(
      sb.from('v_monthly_revenue_cb' as never)
        .select('*')
        .eq('property_id' as never, pid)
        .order('month_start' as never, { ascending: false })
        .limit(12),
    ).then((r: any) => (r.data ?? []) as MonthlyRow[]).catch(() => [] as MonthlyRow[]),
    Promise.resolve(
      sb.from('v_ytd_revenue_cb' as never)
        .select('*')
        .eq('property_id' as never, pid),
    ).then((r: any) => (r.data ?? []) as any[]).catch(() => [] as any[]),
    Promise.resolve(
      sb.from('v_cash_forward_13w')
        .select('*')
        .eq('property_id', pid)
        .order('week_idx', { ascending: true })
        .order('line_order', { ascending: true }),
    ).then((r: any) => (r.data ?? []) as CashRow[]).catch(() => [] as CashRow[]),
  ]);

  const ytdRevenue: number | null = ytdRaw[0]?.total_revenue ?? null;
  const ytdDays: number = ytdRaw[0]?.days_with_data ?? 0;
  const ytdRoomRevenue: number | null = ytdRaw[0]?.room_revenue_total ?? null;
  const ytdOtherRevenue: number | null = ytdRaw[0]?.other_revenue_total ?? null;

  return (
    <DashboardPage title="Finance · Overview" tabs={tabs}>
      {/* ── Entry cards ─────────────────────────────────────────────── */}
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 10 }}>
        <Container title="Finance" subtitle="P&L · Ledger · Account mapping" density="compact">
          <div style={desc}>
            USALI P&L snapshot, general ledger by account, and the mapping table that
            keeps every GL account tied to the right USALI line.
            <div style={{ marginTop: 8 }}>
              <TenantLink href="/finance/pnl" style={btn}>Open Finance →</TenantLink>
            </div>
          </div>
        </Container>

        <Container title="Transactions" subtitle="folio + POS reconciliation" density="compact">
          <div style={desc}>
            Folio-level transactions, POS · PMS reconciliation, and POS · Poster feed.
            Everything that flows before it lands in the ledger.
            <div style={{ marginTop: 8 }}>
              <TenantLink href="/finance/transactions" style={btn}>Open Transactions →</TenantLink>
            </div>
          </div>
        </Container>

        <Container title="HR" subtitle="people · payroll · roster" density="compact">
          <div style={desc}>
            Staff roster, headcount, payroll cost centres. Moved from Operations so
            people-cost sits where it belongs — with the books.
            <div style={{ marginTop: 8 }}>
              <TenantLink href="/finance/hr" style={btn}>Open HR →</TenantLink>
            </div>
          </div>
        </Container>

        <Container title="Budget" subtitle="annual plan · vs actual" density="compact">
          <div style={desc}>
            Current budget lines with month-by-month tracking against actuals from
            the ledger.
            <div style={{ marginTop: 8 }}>
              <TenantLink href="/finance/budget" style={btn}>Open Budget →</TenantLink>
            </div>
          </div>
        </Container>

        <Container title="Working capital" subtitle="Cashflow · Variance · AP / AR" density="compact">
          <div style={desc}>
            Cash on hand, variance vs budget, and open AP / AR positions — the
            three tabs that keep short-term liquidity honest.
            <div style={{ marginTop: 8 }}>
              <TenantLink href="/finance/cashflow" style={btn}>Open Working capital →</TenantLink>
            </div>
          </div>
        </Container>

        <Container title="Reports" subtitle="printable finance packs" density="compact">
          <div style={desc}>
            Saved report templates and the report builder — printable P&L, ledger
            exports, cash summaries.
            <div style={{ marginTop: 8 }}>
              <TenantLink href="/h/260955/reports?dept=finance" style={btn}>Open Reports →</TenantLink>
            </div>
          </div>
        </Container>
      </div>

      {/* ── Section A: CB Monthly Revenue ───────────────────────────── */}
      <div style={fullRow}>
        <Container
          title="CB Monthly Revenue"
          subtitle="Last 12 months · source: v_monthly_revenue_cb (insights.daily_revenue_cb)"
          density="compact"
        >
          {(ytdRevenue != null || ytdDays > 0) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginBottom: 12 }}>
              {ytdRevenue != null && (
                <KpiTile label="YTD Total Revenue" value={Math.round(Number(ytdRevenue))} currency="USD" size="sm" status="green" />
              )}
              {ytdRoomRevenue != null && (
                <KpiTile label="YTD Room Revenue" value={Math.round(Number(ytdRoomRevenue))} currency="USD" size="sm" />
              )}
              {ytdOtherRevenue != null && (
                <KpiTile label="YTD Other Revenue" value={Math.round(Number(ytdOtherRevenue))} currency="USD" size="sm" />
              )}
              {ytdDays > 0 && (
                <KpiTile label="YTD days with data" value={ytdDays} size="sm" />
              )}
            </div>
          )}
          <MonthlyRevenueTable rows={monthly} />
        </Container>
      </div>

      {/* ── Section B: 13-week Cash Forward ─────────────────────────── */}
      <div style={fullRow}>
        <Container
          title="13-week Cash Forward"
          subtitle="Rolling 13-week outlook · source: v_cash_forward_13w"
          density="compact"
        >
          <CashForwardTable rows={cashRows} />
        </Container>
      </div>
    </DashboardPage>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const fullRow: React.CSSProperties = { gridColumn: '1 / -1' };

const desc: React.CSSProperties = { fontSize: 12, color: '#3A3A3A', lineHeight: 1.55, padding: '4px 2px' };

const btn: React.CSSProperties = {
  display: 'inline-block', padding: '4px 10px', fontSize: 11, fontWeight: 600,
  background: '#FFFFFF', color: '#1F3A2E', border: '1px solid #1F3A2E',
  borderRadius: 3, textDecoration: 'none',
};

const emptyStyle: React.CSSProperties = {
  padding: 20, color: 'var(--tbl-fg-mute, #5A5A5A)',
  fontStyle: 'italic', fontSize: 13, lineHeight: 1.6,
};

const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 12 };

const theadRow: React.CSSProperties = { borderBottom: '1px solid var(--tbl-border, #E6DFCC)' };

const th: React.CSSProperties = {
  padding: '8px 12px', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
  textTransform: 'uppercase', color: 'var(--tbl-fg-mute, #5A5A5A)',
  textAlign: 'left', whiteSpace: 'nowrap',
};

const trRow: React.CSSProperties = { borderBottom: '1px solid var(--tbl-border, #E6DFCC)' };

const tdLeft: React.CSSProperties = {
  padding: '8px 12px', fontSize: 12, color: 'var(--tbl-fg, #1B1B1B)', verticalAlign: 'middle',
};

const tdRight: React.CSSProperties = { ...tdLeft, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };

const monthPill: React.CSSProperties = {
  display: 'inline-block', padding: '2px 8px', borderRadius: 4,
  background: 'var(--tbl-bg-elev, #F5F0E1)', fontSize: 11, fontWeight: 700,
  fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em',
};
