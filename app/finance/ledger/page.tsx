import { Section } from '@/components/sections/Section';
import { Kpi } from '@/components/kpi/Kpi';
import { getAgedAr, getKpiToday } from '@/lib/data';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import { fmtMoney } from '@/lib/format';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

export default async function LedgerPage() {
  const today = await getKpiToday().catch(() => null);
  const aged = await getAgedAr().catch(() => []);

  const totalAr = aged.reduce((s: number, r: any) => s + Number(r.open_balance || 0), 0);
  const buckets = aged.reduce((b: any, r: any) => {
    const k = r.bucket || 'unknown';
    b[k] = (b[k] || 0) + Number(r.open_balance || 0);
    return b;
  }, {});

  // House accounts
  const { data: houseAccounts, count: haCount } = await supabase
    .from('house_accounts')
    .select('house_account_id, account_name, is_active', { count: 'exact' })
    .eq('property_id', PROPERTY_ID)
    .eq('is_active', true)
    .limit(20);

  // Reservations missing email (DQ proxy for ledger hygiene)
  const { data: missingEmail, count: missingEmailCount } = await supabase
    .from('reservations')
    .select('reservation_id, guest_name', { count: 'exact', head: false })
    .eq('property_id', PROPERTY_ID)
    .is('guest_email', null)
    .gte('check_in_date', new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10))
    .limit(1);

  // In-house balance
  const { data: inHouse } = await supabase
    .from('mv_arrivals_departures_today')
    .select('balance')
    .eq('property_id', PROPERTY_ID)
    .eq('today_role', 'in_house');
  const inHouseBalance = (inHouse ?? []).reduce((s: number, r: any) => s + Number(r.balance || 0), 0);
  const highBalance = (inHouse ?? []).filter((r: any) => Number(r.balance || 0) > 1000).length;

  return (
    <>
      <Section title="In-House Ledger" tag="Right Now">
        <div className="grid grid-cols-4 gap-3">
          <Kpi label="In-House Guests" value={today?.in_house ?? 0} />
          <Kpi label="Total In-House Balance" value={inHouseBalance} kind="money" />
          <Kpi label="High-Balance Flags" value={highBalance} status={highBalance > 0 ? 'warn' : 'good'} hint=">$1,000" />
          <Kpi label="Missing Email" value={missingEmailCount ?? 0} status={(missingEmailCount ?? 0) > 0 ? 'warn' : 'good'} hint="Last 90d arrivals" />
        </div>
      </Section>

      <Section title="Aged Receivables" tag={`${aged.length} reservations · $${totalAr.toLocaleString('en-US', { maximumFractionDigits: 0 })} open`}>
        <div className="grid grid-cols-5 gap-3 mb-6">
          <Kpi label="Total AR Outstanding" value={totalAr} kind="money" />
          <Kpi label="0-30 days" value={Number(buckets['0_30'] || 0)} kind="money" />
          <Kpi label="31-60 days" value={Number(buckets['31_60'] || 0)} kind="money" status={buckets['31_60'] > 0 ? 'warn' : 'neutral'} />
          <Kpi label="61-90 days" value={Number(buckets['61_90'] || 0)} kind="money" status={buckets['61_90'] > 0 ? 'warn' : 'neutral'} />
          <Kpi label="90+ days" value={Number(buckets['90_plus'] || 0)} kind="money" status={buckets['90_plus'] > 0 ? 'bad' : 'neutral'} />
        </div>

        {aged.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Guest</th><th>Source</th><th>Check-out</th>
                <th className="text-right">Balance</th>
                <th className="text-right">Days Overdue</th><th>Bucket</th>
              </tr>
            </thead>
            <tbody>
              {aged.slice(0, 50).map((r: any) => (
                <tr key={r.reservation_id}>
                  <td>{r.guest_name}</td>
                  <td className="text-muted">{r.source_name}</td>
                  <td>{r.check_out_date || '—'}</td>
                  <td className="text-right tabular">{fmtMoney(Number(r.open_balance), 'USD')}</td>
                  <td className="text-right tabular">{r.days_overdue ?? '—'}</td>
                  <td>
                    <span className={`pill ${r.bucket === '90_plus' ? 'bad' : r.bucket === '61_90' ? 'warn' : r.bucket === '0_30' ? 'good' : 'muted'}`}>
                      {String(r.bucket || '').replace('_', '-')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="City Ledger Accounts" tag={`${haCount ?? 0} active`}>
        {(houseAccounts ?? []).length === 0 ? (
          <div className="text-muted text-sm py-4 text-center">No active accounts.</div>
        ) : (
          <table>
            <thead><tr><th>Account</th><th>ID</th></tr></thead>
            <tbody>
              {(houseAccounts ?? []).map((h: any) => (
                <tr key={h.house_account_id}>
                  <td>{h.account_name || '—'}</td>
                  <td className="text-muted mono text-xs">{h.house_account_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="text-muted text-xs mt-3">Showing first 20 of {haCount}.</div>
      </Section>

      <Section title="Deposits Held / Due" greyed greyedReason="Deposit logic needs definition vs Cloudbeds payment flow">
        <div className="text-muted text-sm">Total deposits held · deposits due (next 30d) · overdue deposits.</div>
      </Section>
    </>
  );
}
