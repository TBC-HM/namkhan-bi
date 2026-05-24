// app/finance/ledger/page.tsx — PBS #205 v2 (2026-05-25)
// Full primitive adoption: DashboardPage + Container per section + KpiTile.
// 3 tabs (Receivables · Deposits · House accounts) preserved via ?tab=.
// Old <Page>/<Panel>/<KpiBox> chrome dropped.

import Link from 'next/link';
import {
  DashboardPage, Container, KpiTile, type KpiTileProps,
} from '@/app/(cockpit)/_design';
import { FINANCE_SUBPAGES } from '../_subpages';
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

export const revalidate = 60;
export const dynamic = 'force-dynamic';

type Tab = 'receivables' | 'deposits' | 'house_accounts';

interface Props { searchParams: Record<string, string | string[] | undefined>; }

const fullRow: React.CSSProperties = { gridColumn: '1 / -1' };

export default async function LedgerPage({ searchParams }: Props) {
  const tabParam = (searchParams.tab as string) ?? '';
  const tab: Tab =
    tabParam === 'deposits' ? 'deposits' :
    tabParam === 'house_accounts' ? 'house_accounts' :
    'receivables';

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

  // In-house
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

  const arEmailMissing = aged.filter((r) => !r.guest_email).length;
  const depEmailMissing = deposits.filter((r) => !r.guest_email).length;

  const tabLabel =
    tab === 'deposits' ? 'Deposits' :
    tab === 'house_accounts' ? 'House accounts' :
    'Receivables';

  const subtitle =
    tab === 'deposits'
      ? `${deposits.length} future bookings · held ${fmtMoney(depositsHeld, 'USD')} · due ${fmtMoney(depositsDue, 'USD')}`
      : tab === 'house_accounts'
      ? `${houseView.stats.active_named} active named · ${houseView.stats.walkin_30d} walk-ins · 30d`
      : `${aged.length} receivables · ${fmtMoney(totalAr, 'USD')} open · ${n90} in 90+`;

  const tabs = FINANCE_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href === '/finance/ledger',
  }));

  const recvTiles: KpiTileProps[] = [
    { label: 'Total open AR', value: Math.round(totalAr), currency: 'USD', size: 'sm', status: totalAr > 0 ? 'amber' : 'green' },
    { label: '0–30d', value: Math.round(ar0_30), currency: 'USD', size: 'sm' },
    { label: '31–60d', value: Math.round(ar31_60), currency: 'USD', size: 'sm', status: ar31_60 > 0 ? 'amber' : 'green' },
    { label: '61–90d', value: Math.round(ar61_90), currency: 'USD', size: 'sm', status: ar61_90 > 0 ? 'amber' : 'green' },
    { label: `90+ · ${n90} resv`, value: Math.round(ar90), currency: 'USD', size: 'sm', status: ar90 > 0 ? 'red' : 'green' },
    { label: 'Largest unpaid', value: Math.round(largestUnpaid), currency: 'USD', size: 'sm' },
    { label: 'Avg days overdue', value: avgDaysOverdue, size: 'sm' },
    { label: 'In-house guests', value: inHouseCount, size: 'sm' },
    { label: 'In-house balance', value: Math.round(inHouseBalance), currency: 'USD', size: 'sm' },
  ];
  const depTiles: KpiTileProps[] = [
    { label: 'Held', value: Math.round(depositsHeld), currency: 'USD', size: 'sm', status: 'green' },
    { label: 'Due', value: Math.round(depositsDue), currency: 'USD', size: 'sm', status: depositsDue > 0 ? 'amber' : 'green' },
    { label: `Overdue ≤7d · ${overdue7d}`, value: Math.round(overdue7dUsd), currency: 'USD', size: 'sm', status: overdue7dUsd > 0 ? 'red' : 'green' },
    { label: 'Future bookings', value: deposits.length, size: 'sm' },
    { label: 'Arriving ≤30d', value: arriving30d, size: 'sm' },
    { label: 'No deposit ≤30d', value: noDeposit30d, size: 'sm', status: noDeposit30d > 0 ? 'amber' : 'green' },
    { label: 'Largest pending', value: Math.round(largestPending), currency: 'USD', size: 'sm' },
    { label: 'Avg deposit', value: avgDeposit, currency: 'USD', size: 'sm' },
  ];

  return (
    <DashboardPage title="Ledger" subtitle={subtitle} tabs={tabs}>
      {/* Sub-tab strip — kept as a slim inline strip inside the page body */}
      <div style={fullRow}>
        <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--ink-soft, #d4d4d8)' }}>
          <TabLink href="/finance/ledger?tab=receivables" active={tab === 'receivables'}>
            Receivables · {aged.length}
          </TabLink>
          <TabLink href="/finance/ledger?tab=deposits" active={tab === 'deposits'}>
            Deposits · {deposits.length}
          </TabLink>
          <TabLink href="/finance/ledger?tab=house_accounts" active={tab === 'house_accounts'}>
            House accounts · {houseView.stats.active_named}
          </TabLink>
        </div>
      </div>

      {tab === 'receivables' && (
        <>
          <div style={fullRow}>
            <Container title="Receivables · headline" subtitle="aged buckets · in-house balance" density="compact">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8 }}>
                {recvTiles.map((t, i) => <KpiTile key={i} {...t} />)}
              </div>
            </Container>
          </div>

          <div style={fullRow}>
            <Container title="AR aging" subtitle="open balance per bucket · v_aged_ar_with_contact" density="compact">
              <AgedArChart rows={aged as never} title="" sub="" />
            </Container>
          </div>

          {arEmailMissing > 0 && (
            <div style={fullRow}>
              <EmailCoverageBanner missing={arEmailMissing} total={aged.length} cohort="aged receivables" />
            </div>
          )}

          <div style={fullRow}>
            <Container
              title={`Aged receivables · ${aged.length} resv · ${fmtMoney(totalAr, 'USD')}`}
              subtitle="click a guest name to open the contact drawer · send reminder · verify via fc@thenamkhan.com"
              density="compact"
            >
              <AgedArSection rows={aged} />
            </Container>
          </div>
        </>
      )}

      {tab === 'deposits' && (
        <>
          <div style={fullRow}>
            <Container title="Deposits · headline" subtitle="pipeline cash · arrivals window" density="compact">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8 }}>
                {depTiles.map((t, i) => <KpiTile key={i} {...t} />)}
              </div>
            </Container>
          </div>

          {depEmailMissing > 0 && (
            <div style={fullRow}>
              <EmailCoverageBanner missing={depEmailMissing} total={deposits.length} cohort="future bookings" />
            </div>
          )}

          <div style={fullRow}>
            <Container
              title={`Deposit pipeline · ${deposits.length} future bookings`}
              subtitle="click a guest name for the drawer · send reminder · verify via fc@thenamkhan.com"
              density="compact"
            >
              <DepositsSection rows={deposits as DepositRow[]} />
            </Container>
          </div>
        </>
      )}

      {tab === 'house_accounts' && (
        <div style={fullRow}>
          <HouseAccountsSection
            named={houseView.named}
            walkin={houseView.walkin}
            stats={houseView.stats}
            posByHa={houseView.posByHa}
            propertyId={PROPERTY_ID}
          />
        </div>
      )}
    </DashboardPage>
  );
}

function EmailCoverageBanner({ missing, total, cohort }: { missing: number; total: number; cohort: string }) {
  const pct = total ? Math.round((missing / total) * 100) : 0;
  return (
    <div style={{
      padding: '10px 12px',
      fontSize: 12,
      color: 'var(--ink-soft, #5a5a5a)',
      background: 'rgba(194,143,44,0.06)',
      border: '1px solid rgba(194,143,44,0.25)',
      borderLeft: '3px solid #C28F2C',
      borderRadius: 6,
      lineHeight: 1.5,
    }}>
      <strong style={{ color: '#C28F2C' }}>
        Email missing on {missing} of {total} {cohort} ({pct}%)
      </strong>{' — '}
      ETL lag, not "no email in PMS". The reservation list endpoint doesn't return email; the per-guest detail
      endpoint does but runs with a ~90-day lag (recent &lt;90d ≈ 3% coverage; older &gt;90d ≈ 92%). OTA bookings
      use proxy addresses (<code>xxx@guest.booking.com</code>). <strong>Workaround:</strong> click the reservation #
      to open PMS and copy. <strong>Real fix:</strong> extend ETL to call <code>getGuestList</code> on every
      confirmed/in-house reservation.
    </div>
  );
}

function TabLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} style={{
      padding: '10px 16px',
      fontSize: 11,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      textDecoration: 'none',
      fontWeight: active ? 700 : 500,
      color: active ? 'var(--ink, #1b1b1b)' : 'var(--ink-soft, #5a5a5a)',
      borderBottom: active ? '2px solid var(--ink, #1b1b1b)' : '2px solid transparent',
      marginBottom: -1,
    }}>
      {children}
    </Link>
  );
}
