// app/finance/ledger/page.tsx
// PBS 2026-05-15: 3 tabs · Receivables + Deposits + House Accounts. Each tab
// gets its own controller-relevant KPI band and drillable table(s).
// Tab state lives in ?tab=receivables|deposits|house_accounts so links share.

import Link from 'next/link';
import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import { FINANCE_SUBPAGES } from '../_subpages';
import KpiBox from '@/components/kpi/KpiBox';
import { getAgedAr } from '@/lib/data';
import { getDepositsPipeline, type DepositRow } from '@/lib/data-deposits';
import { getHouseAccountsView } from '@/lib/data-house-accounts';
import { PROPERTY_ID } from '@/lib/supabase';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { fmtMoney } from '@/lib/format';
import AgedArChart from '../_components/AgedArChart';
import {
  AgedArSection,
  type AgedRowWithContact,
} from './_components/LedgerDrawerHost';
import DepositsSection from './_components/DepositsSection';
import HouseAccountsSection from './_components/HouseAccountsSection';
// PBS 2026-05-15: Bank tab moved to /finance/banks (CFO page). Ledger keeps
// guest-side ledgers only (receivables · deposits · house accounts).

export const revalidate = 60;
export const dynamic = 'force-dynamic';

type Tab = 'receivables' | 'deposits' | 'house_accounts';

interface Props { searchParams: Record<string, string | string[] | undefined>; }

export default async function LedgerPage({ searchParams }: Props) {
  const tabParam = (searchParams.tab as string) ?? '';
  const tab: Tab =
    tabParam === 'deposits' ? 'deposits' :
    tabParam === 'house_accounts' ? 'house_accounts' :
    'receivables';

  // Fetch all three feeds in parallel so the eyebrow + KPI math is consistent
  // and tab switching doesn't flash empty.
  const [aged, deposits, houseView] = await Promise.all([
    getAgedAr().catch(() => []) as Promise<AgedRowWithContact[]>,
    getDepositsPipeline().catch(() => []) as Promise<DepositRow[]>,
    getHouseAccountsView(PROPERTY_ID).catch(() => ({
      named: [], walkin: [],
      stats: {
        total_accounts: 0, active_named: 0, active_walkin: 0, walkin_30d: 0, walkin_ytd: 0,
        named_total: 0, same_day_pct: 0, most_recent_open: null,
        pos_walkins_matched: 0, pos_order_usd: 0, pos_cash_usd: 0, pos_card_usd: 0,
        pos_bank_usd: 0, pos_house_acct_charge_usd: 0, pos_charge_room_usd: 0,
      },
      posByHa: {},
    })),
  ]);

  // Receivables aggregates
  const totalAr = aged.reduce((s, r) => s + Number(r.open_balance || 0), 0);
  const bucketSums = aged.reduce((b, r) => {
    const k = r.bucket || 'unknown';
    b[k] = (b[k] || 0) + Number(r.open_balance || 0);
    return b;
  }, {} as Record<string, number>);
  const bucketCounts = aged.reduce((b, r) => {
    const k = r.bucket || 'unknown';
    b[k] = (b[k] || 0) + 1;
    return b;
  }, {} as Record<string, number>);
  const ar0_30  = Number(bucketSums['0_30']   || 0);
  const ar31_60 = Number(bucketSums['31_60']  || 0);
  const ar61_90 = Number(bucketSums['61_90']  || 0);
  const ar90    = Number(bucketSums['90_plus'] || 0);
  const n90     = Number(bucketCounts['90_plus'] || 0);
  const largestUnpaid = aged.reduce((m, r) => Math.max(m, Number(r.open_balance || 0)), 0);
  const avgDaysOverdue = aged.length > 0
    ? Math.round(aged.reduce((s, r) => s + Number(r.days_overdue || 0), 0) / aged.length)
    : 0;

  // Deposits aggregates
  const depositsHeld   = deposits.reduce((s, r) => s + Number(r.paid_amount || 0), 0);
  const depositsDue    = deposits.reduce((s, r) => s + Number(r.balance || 0), 0);
  const overdue7d      = deposits.filter((r) => Number(r.balance) > 0 && (r.days_until_arrival ?? 999) <= 7).length;
  const overdue7dUsd   = deposits.filter((r) => Number(r.balance) > 0 && (r.days_until_arrival ?? 999) <= 7)
                                 .reduce((s, r) => s + Number(r.balance || 0), 0);
  const arriving30d    = deposits.filter((r) => (r.days_until_arrival ?? 999) <= 30).length;
  const noDeposit30d   = deposits.filter((r) => Number(r.paid_amount) === 0 && (r.days_until_arrival ?? 999) <= 30).length;
  const largestPending = deposits.reduce((m, r) => Math.max(m, Number(r.balance || 0)), 0);
  const avgDeposit     = deposits.filter((r) => Number(r.paid_amount) > 0).length > 0
    ? Math.round(depositsHeld / deposits.filter((r) => Number(r.paid_amount) > 0).length)
    : 0;

  // In-house (still goes on Receivables tab)
  const sb = getSupabaseAdmin();
  const { data: inHouseRows } = await sb
    .from('reservations')
    .select('reservation_id, balance')
    .eq('property_id', PROPERTY_ID)
    .eq('status', 'checked_in');
  const inHouseCount = (inHouseRows ?? []).length;
  const inHouseBalance = (inHouseRows ?? []).reduce(
    (s: number, r: { balance: number | null }) => s + Number(r.balance || 0), 0,
  );

  // Email coverage diagnostics (honest "why missing" for the inbox)
  const arEmailMissing = aged.filter((r) => !r.guest_email).length;
  const depEmailMissing = deposits.filter((r) => !r.guest_email).length;

  const tabLabel =
    tab === 'deposits' ? 'Deposits' :
    tab === 'house_accounts' ? 'House accounts' :
    'Receivables';
  const eyebrow = [
    'Finance · Ledger',
    `Tab: ${tabLabel}`,
    tab === 'deposits'
      ? `${deposits.length} future bookings · held ${fmtMoney(depositsHeld, 'USD')} · due ${fmtMoney(depositsDue, 'USD')}`
      : tab === 'house_accounts'
      ? `${houseView.stats.active_named} active named · ${houseView.stats.walkin_30d} walk-ins · 30d`
      : `${aged.length} receivables · ${fmtMoney(totalAr, 'USD')} open · ${n90} in 90+`,
  ].join(' · ');

  return (
    <Page
      eyebrow={eyebrow}
      title={<>Who <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>owes</em> you, and who's about to.</>}
      subPages={FINANCE_SUBPAGES}
    >
      {/* ─── Tab strip ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--paper-deep)', marginBottom: 12 }}>
        <TabLink href="/finance/ledger?tab=receivables" active={tab === 'receivables'}>
          Receivables · {aged.length} resv
        </TabLink>
        <TabLink href="/finance/ledger?tab=deposits" active={tab === 'deposits'}>
          Deposits · {deposits.length} bookings
        </TabLink>
        <TabLink href="/finance/ledger?tab=house_accounts" active={tab === 'house_accounts'}>
          House accounts · {houseView.stats.active_named} active named
        </TabLink>
      </div>

      {tab === 'receivables' && (
        <>
          {/* ── Receivables KPIs ─────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
            <KpiBox value={totalAr}        unit="usd"   label="Total open AR"          tooltip="Sum of open balances across all checked-out unpaid reservations." />
            <KpiBox value={ar0_30}         unit="usd"   label="0–30 days"              tooltip="AR within the standard collection window." />
            <KpiBox value={ar31_60}        unit="usd"   label="31–60 days"             tooltip="AR aging into amber — chase actively." />
            <KpiBox value={ar61_90}        unit="usd"   label="61–90 days"             tooltip="AR aging into red — escalate." />
            <KpiBox value={ar90}           unit="usd"   label={`90+ days · ${n90} resv`} tooltip="The collection priority." />
            <KpiBox value={largestUnpaid}  unit="usd"   label="Largest single unpaid"  tooltip="Work this row first." />
            <KpiBox value={avgDaysOverdue} unit="count" label="Avg days overdue"       tooltip="Average age of unpaid AR." />
            <KpiBox value={inHouseCount}   unit="count" label="In-house guests"        tooltip="Reservations currently checked-in." />
            <KpiBox value={inHouseBalance} unit="usd"   label="In-house balance"       tooltip="Sum of open balance for in-house guests." />
          </div>

          {/* ── AR aging chart ──────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 12, marginTop: 12 }}>
            <AgedArChart rows={aged as never} title="AR aging" sub="Open balance per bucket · v_aged_ar_with_contact" />
          </div>

          {/* ── Email-coverage callout ──────────────────────────── */}
          {arEmailMissing > 0 && (
            <EmailCoverageBanner missing={arEmailMissing} total={aged.length} cohort="aged receivables" />
          )}

          {/* ── Tables ──────────────────────────────────────────── */}
          <Panel
            title={`Aged receivables · ${aged.length} resv · ${fmtMoney(totalAr, 'USD')}`}
            eyebrow="Click any guest name to open the contact drawer · send reminder · verify via fc@thenamkhan.com"
            expandable
          >
            <div style={{ padding: 12 }}>
              <AgedArSection rows={aged} />
            </div>
          </Panel>
        </>
      )}

      {tab === 'deposits' && (
        <>
          {/* ── Deposits KPIs ────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
            <KpiBox value={depositsHeld}     unit="usd"   label="Deposits held"          tooltip="Σ paid_amount on confirmed future arrivals — pipeline cash already collected." />
            <KpiBox value={depositsDue}      unit="usd"   label="Deposits due"           tooltip="Σ balance on confirmed future arrivals — what's still outstanding." />
            <KpiBox value={overdue7dUsd}     unit="usd"   label={`Overdue · ≤7d · ${overdue7d}`} tooltip="Balance still due on bookings arriving within 7 days. Chase now." />
            <KpiBox value={deposits.length}  unit="count" label="Future bookings"        tooltip="All future-confirmed reservations with paid_amount > 0 or balance > 0." />
            <KpiBox value={arriving30d}      unit="count" label="Arriving ≤30d"          tooltip="Bookings arriving in the next 30 days." />
            <KpiBox value={noDeposit30d}     unit="count" label="No deposit · ≤30d"      tooltip="Confirmed bookings arriving in 30 days with paid_amount = 0 — collection risk." />
            <KpiBox value={largestPending}   unit="usd"   label="Largest pending"        tooltip="Biggest single outstanding deposit." />
            <KpiBox value={avgDeposit}       unit="usd"   label="Avg deposit · per booking" tooltip="Average paid_amount across bookings that have deposit > 0." />
          </div>

          {/* ── Email-coverage callout ──────────────────────────── */}
          {depEmailMissing > 0 && (
            <EmailCoverageBanner missing={depEmailMissing} total={deposits.length} cohort="future bookings" />
          )}

          <Panel
            title={`Deposit pipeline · ${deposits.length} future bookings`}
            eyebrow="Click any guest name for the drawer · send reminder · verify via fc@thenamkhan.com"
            expandable
          >
            <div style={{ padding: 12 }}>
              <DepositsSection rows={deposits as DepositRow[]} />
            </div>
          </Panel>
        </>
      )}

      {tab === 'house_accounts' && (
        <HouseAccountsSection
          named={houseView.named}
          walkin={houseView.walkin}
          stats={houseView.stats}
          posByHa={houseView.posByHa}
          propertyId={PROPERTY_ID}
        />
      )}
    </Page>
  );
}

// ─── Email coverage banner ─────────────────────────────────────────────
// Honest explanation of WHY we sometimes show no email + workaround.
function EmailCoverageBanner({
  missing, total, cohort,
}: { missing: number; total: number; cohort: string }) {
  const pct = total ? Math.round((missing / total) * 100) : 0;
  return (
    <div
      style={{
        margin: '12px 0',
        padding: '10px 12px',
        fontSize: 'var(--t-xs)',
        color: 'var(--ink-soft)',
        background: 'var(--paper-warm)',
        border: '1px solid var(--paper-deep)',
        borderLeft: '3px solid var(--st-warn, #C28F2C)',
        borderRadius: 6,
      }}
    >
      <strong style={{ color: 'var(--st-warn, #C28F2C)' }}>
        Email missing on {missing} of {total} {cohort} ({pct}%)
      </strong>
      {' — '}
      this is an <em>ETL lag</em>, not "no email in PMS". PMS&apos; reservation list
      endpoint doesn&apos;t return email; the per-guest detail endpoint does, but our ETL runs that
      with a ~90-day lag (recent {'<'} 90d: ~3% coverage; older {'>'} 90d: ~92%). OTA bookings
      additionally use proxy addresses (<code>xxx@guest.booking.com</code>) that aren&apos;t fetched
      pre-arrival. <strong>Workaround:</strong> click the reservation # to open PMS directly
      and copy the address. <strong>Real fix:</strong> extend ETL to call
      <code> getGuestList</code> on every confirmed/in-house reservation, not just stays older
      than 90 days.
    </div>
  );
}

function TabLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        padding: '10px 20px',
        fontFamily: 'var(--mono)',
        fontSize: 'var(--t-xs)',
        letterSpacing: 'var(--ls-extra)',
        textTransform: 'uppercase',
        textDecoration: 'none',
        fontWeight: active ? 700 : 500,
        color: active ? 'var(--brass)' : 'var(--ink-soft)',
        borderBottom: active ? '2px solid var(--brass)' : '2px solid transparent',
        marginBottom: -1,
      }}
    >
      {children}
    </Link>
  );
}
