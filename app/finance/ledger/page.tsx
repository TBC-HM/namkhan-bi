// app/finance/ledger/page.tsx — REDESIGN 2026-05-05 (recovery)
import Page from '@/components/page/Page';
import { FINANCE_SUBPAGES } from '../_subpages';
import KpiBox from '@/components/kpi/KpiBox';
import StatusPill from '@/components/ui/StatusPill';
import { getAgedAr } from '@/lib/data';
import { resolvePeriod } from '@/lib/period';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import { fmtMoney } from '@/lib/format';
import {
  FinanceStatusHeader, StatusCell, SectionHead,
  metaSm, metaStrong, metaDim,
} from '../_components/FinanceShell';
import AgedArChart from '../_components/AgedArChart';
import AgedArTable, { type AgedRow } from './_components/AgedArTableClient';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface Props { searchParams: Record<string, string | string[] | undefined>; }

export default async function LedgerPage({ searchParams }: Props) {
  const period = resolvePeriod(searchParams);
  const aged = await getAgedAr().catch(() => []);
  const totalAr = aged.reduce((s: number, r: any) => s + Number(r.open_balance || 0), 0);
  const buckets = aged.reduce((b: any, r: any) => {
    const k = r.bucket || 'unknown';
    b[k] = (b[k] || 0) + Number(r.open_balance || 0);
    return b;
  }, {} as Record<string, number>);

  const { data: inHouseRows } = await supabase
    .from('reservations')
    .select('reservation_id, balance, guest_email')
    .eq('property_id', PROPERTY_ID)
    .eq('status', 'checked_in');
  const inHouseCount = (inHouseRows ?? []).length;
  const inHouseBalance = (inHouseRows ?? []).reduce((s: number, r: any) => s + Number(r.balance || 0), 0);
  const inHouseHighBal = (inHouseRows ?? []).filter((r: any) => Number(r.balance || 0) > 1000).length;
  const checkedOutHighBal = aged.filter((r: any) => Number(r.open_balance || 0) > 1000).length;
  const highBalFlags = inHouseHighBal + checkedOutHighBal;

  const { count: missingEmailCount } = await supabase
    .from('reservations')
    .select('reservation_id', { count: 'exact', head: true })
    .eq('property_id', PROPERTY_ID)
    .is('guest_email', null)
    .gte('check_in_date', period.from)
    .lte('check_in_date', period.to);

  const ar90 = Number(buckets['90_plus'] || 0);
  const arHealth = ar90 > 0 ? 'expired' : (Number(buckets['61_90'] || 0) > 0 ? 'pending' : 'active');

  // ---- Deposits — sourced from reservations.paid_amount + balance ----
  const today = new Date().toISOString().slice(0, 10);
  const in7  = new Date(Date.now() + 7  * 86400000).toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const { data: futureConfirmed } = await supabase
    .from('reservations')
    .select('reservation_id, paid_amount, balance, check_in_date')
    .eq('property_id', PROPERTY_ID)
    .eq('status', 'confirmed')
    .gte('check_in_date', today);

  const depositsHeld = (futureConfirmed ?? []).reduce(
    (s: number, r: any) => s + Number(r.paid_amount || 0), 0
  );
  const depositsDue30 = (futureConfirmed ?? [])
    .filter((r: any) => r.check_in_date && r.check_in_date <= in30 && Number(r.balance) > 0)
    .reduce((s: number, r: any) => s + Number(r.balance || 0), 0);
  const overdueDeposits = (futureConfirmed ?? [])
    .filter((r: any) => r.check_in_date && r.check_in_date <= in7 && Number(r.balance) > 0)
    .length;

  // Future arrivals with NO deposit (collection risk)
  const futureNoDeposit30d = (futureConfirmed ?? [])
    .filter((r: any) => r.check_in_date && r.check_in_date <= in30 && Number(r.paid_amount || 0) === 0)
    .length;

  // City ledger — house_accounts (companies, agencies)
  const { data: houseAccounts } = await supabase
    .from('house_accounts')
    .select('account_id, account_name, account_type, balance, last_activity_date, status')
    .eq('property_id', PROPERTY_ID)
    .order('balance', { ascending: false })
    .limit(20);
  const cityLedgerActive = (houseAccounts ?? []).filter((r: any) => r.status === 'active').length;
  const cityLedgerTotal = (houseAccounts ?? []).reduce((s: number, r: any) => s + Number(r.balance || 0), 0);

  const { count: cancellations30d } = await supabase
    .from('reservations')
    .select('reservation_id', { count: 'exact', head: true })
    .eq('property_id', PROPERTY_ID)
    .eq('status', 'canceled')
    .gte('cancellation_date', new Date(Date.now() - 30 * 86400000).toISOString());

  return (
    <Page
      eyebrow="Finance · Ledger"
      title={<>Who <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>owes</em> you, and who's about to.</>}
      subPages={FINANCE_SUBPAGES}
    >
      <FinanceStatusHeader
        top={<>
          <StatusCell label="SOURCE"><StatusPill tone="active">reservations · mv_aged_ar</StatusPill></StatusCell>
          <StatusCell label="IN-HOUSE"><span style={metaStrong}>{inHouseCount}</span><span style={metaDim}>{fmtMoney(inHouseBalance, 'USD')} balance</span></StatusCell>
          <StatusCell label="HIGH-BAL"><StatusPill tone={highBalFlags > 0 ? 'pending' : 'inactive'}>{highBalFlags}</StatusPill><span style={metaDim}>&gt; $1k</span></StatusCell>
          <StatusCell label="DEPOSITS HELD"><span style={metaStrong}>{fmtMoney(depositsHeld, 'USD')}</span><span style={metaDim}>{(futureConfirmed ?? []).length} resv</span></StatusCell>
          <span style={{ flex: 1 }} />
        </>}
        bottom={<>
          <StatusCell label="AR HEALTH"><StatusPill tone={arHealth as any}>{ar90 > 0 ? 'OVERDUE' : Number(buckets['61_90'] || 0) > 0 ? 'WATCH' : 'CLEAN'}</StatusPill><span style={metaDim}>{fmtMoney(totalAr, 'USD')} open</span></StatusCell>
          <StatusCell label="FUT 30D · NO DEPOSIT"><StatusPill tone={futureNoDeposit30d > 0 ? 'pending' : 'inactive'}>{futureNoDeposit30d}</StatusPill><span style={metaDim}>collection risk</span></StatusCell>
          <StatusCell label="CANCELLATIONS 30D"><span style={metaStrong}>{cancellations30d ?? 0}</span></StatusCell>
          <span style={{ flex: 1 }} />
        </>}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 12, marginTop: 14 }}>
        <AgedArChart rows={aged as any} title="AR aging" sub="Open balance per bucket · mv_aged_ar" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 14 }}>
        <KpiBox value={inHouseCount} unit="count" label="In-house guests" />
        <KpiBox value={inHouseBalance} unit="usd" label="In-house balance" />
        <KpiBox value={aged.length} unit="count" label="Checked-out unpaid" />
        <KpiBox value={totalAr} unit="usd" label="Checked-out unpaid $" />
        <KpiBox value={highBalFlags} unit="count" label="High-balance flags" />
        <KpiBox value={missingEmailCount ?? 0} unit="count" label={`Missing email · ${period.label}`} />
      </div>
      <div style={{ marginTop: 18 }}>
        <SectionHead title="Aged receivables" emphasis={`${aged.length} resv`} sub={`Total open: ${fmtMoney(totalAr, 'USD')} · sortable`} source="mv_aged_ar" />
        <AgedArTable rows={aged as AgedRow[]} />
      </div>

      <div style={{ marginTop: 18 }}>
        <SectionHead title="City ledger" emphasis={`${cityLedgerActive} active`} sub="House accounts · companies · agencies · house_accounts" source="house_accounts" />
        {(houseAccounts ?? []).length === 0 ? (
          <div className="panel dashed" style={{ padding: 20, color: 'var(--ink-mute)', fontStyle: 'italic', textAlign: 'center' }}>
            No active house accounts. Showing first 20 of {(houseAccounts ?? []).length}.
          </div>
        ) : (
          <table className="tbl" style={{ width: '100%', fontSize: 13 }}>
            <thead>
              <tr><th>Account</th><th>Type</th><th>Status</th><th className="num">Balance</th><th>Last activity</th></tr>
            </thead>
            <tbody>
              {(houseAccounts ?? []).map((a: any) => (
                <tr key={a.account_id}>
                  <td className="lbl"><strong>{a.account_name || '—'}</strong></td>
                  <td className="lbl text-mute">{a.account_type || '—'}</td>
                  <td><StatusPill tone={a.status === 'active' ? 'active' : 'inactive'}>{a.status || '—'}</StatusPill></td>
                  <td className="num" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(Number(a.balance || 0), 'USD')}</td>
                  <td className="lbl text-mute">{a.last_activity_date ? new Date(a.last_activity_date).toISOString().slice(0, 10) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ marginTop: 18 }}>
        <SectionHead title="Deposits & cancellations" sub="Confirmed future arrivals · paid_amount + balance · 30d window" source="reservations" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <KpiBox label="Deposits Held" unit="usd" value={depositsHeld} tooltip={`Σ paid_amount for ${(futureConfirmed ?? []).length} confirmed future-arrival reservations`} />
          <KpiBox label="Deposits Due (30d)" unit="usd" value={depositsDue30} tooltip="Σ balance for confirmed reservations checking in within 30 days" />
          <KpiBox label="Overdue Deposits" unit="count" value={overdueDeposits} tooltip="Confirmed reservations arriving in ≤7 days with balance > 0" />
          <KpiBox label="Cancellations 30d" unit="count" value={cancellations30d ?? 0} tooltip="Reservations canceled in the last 30 days" />
        </div>
      </div>
    </Page>
  );
}
