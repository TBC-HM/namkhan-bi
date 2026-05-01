// app/finance/ledger/page.tsx
// Finance · Ledger — in-house balance + aged AR + city ledger.
// Missing-email DQ tile is window-scoped (?win=) per Cowork handoff 2026-05-01.

import PanelHero from '@/components/sections/PanelHero';
import Card from '@/components/sections/Card';
import KpiCard from '@/components/kpi/KpiCard';
import Insight from '@/components/sections/Insight';
import { getAgedAr, getKpiToday } from '@/lib/data';
import { resolvePeriod } from '@/lib/period';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import { fmtMoney } from '@/lib/format';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

const bucketLabel: Record<string, string> = {
  '0_30': '0–30',
  '31_60': '31–60',
  '61_90': '61–90',
  '90_plus': '90+',
};

const bucketTone: Record<string, 'good' | 'warn' | 'bad' | ''> = {
  '0_30': 'good',
  '31_60': 'warn',
  '61_90': 'warn',
  '90_plus': 'bad',
};

interface Props { searchParams: Record<string, string | string[] | undefined>; }

export default async function LedgerPage({ searchParams }: Props) {
  const period = resolvePeriod(searchParams);
  const today = await getKpiToday().catch(() => null);
  const aged = await getAgedAr().catch(() => []);

  const totalAr = aged.reduce((s: number, r: any) => s + Number(r.open_balance || 0), 0);
  const buckets = aged.reduce((b: any, r: any) => {
    const k = r.bucket || 'unknown';
    b[k] = (b[k] || 0) + Number(r.open_balance || 0);
    return b;
  }, {} as Record<string, number>);

  const { data: houseAccounts, count: haCount } = await supabase
    .from('house_accounts')
    .select('house_account_id, account_name, is_active', { count: 'exact' })
    .eq('property_id', PROPERTY_ID)
    .eq('is_active', true)
    .limit(20);

  // Window-scoped per ?win= (was hardcoded last-90d arrivals)
  const { count: missingEmailCount } = await supabase
    .from('reservations')
    .select('reservation_id', { count: 'exact', head: true })
    .eq('property_id', PROPERTY_ID)
    .is('guest_email', null)
    .gte('check_in_date', period.from)
    .lte('check_in_date', period.to);

  const { data: inHouse } = await supabase
    .from('mv_arrivals_departures_today')
    .select('balance')
    .eq('property_id', PROPERTY_ID)
    .eq('today_role', 'in_house');

  const inHouseBalance = (inHouse ?? []).reduce((s: number, r: any) => s + Number(r.balance || 0), 0);
  const highBalance = (inHouse ?? []).filter((r: any) => Number(r.balance || 0) > 1000).length;

  return (
    <>
      <PanelHero
        eyebrow="Ledger · live"
        title="Guest"
        emphasis="ledger"
        sub="In-house balance · aged AR · city ledger"
        kpis={
          <>
            <KpiCard label="In-House Guests" value={today?.in_house ?? 0} />
            <KpiCard
              label="In-House Balance"
              value={inHouseBalance}
              kind="money"
              tone={inHouseBalance > 5000 ? 'warn' : 'neutral'}
            />
            <KpiCard
              label="High-Balance Flags"
              value={highBalance}
              tone={highBalance > 0 ? 'warn' : 'pos'}
              hint="> $1,000"
            />
            <KpiCard
              label={`Missing Email (${period.label})`}
              value={missingEmailCount ?? 0}
              tone={(missingEmailCount ?? 0) > 5 ? 'warn' : 'neutral'}
              hint={`${period.rangeLabel} arrivals`}
            />
          </>
        }
      />

      <Card
        title="Aged receivables"
        emphasis={`· ${aged.length} resv`}
        sub={`Total open: ${fmtMoney(totalAr, 'USD')}`}
        source="mv_aged_ar"
      >
        <div className="card-grid-5">
          <KpiCard label="Total AR" value={totalAr} kind="money" />
          <KpiCard label="0–30 days" value={Number(buckets['0_30'] || 0)} kind="money" tone="pos" />
          <KpiCard
            label="31–60 days"
            value={Number(buckets['31_60'] || 0)}
            kind="money"
            tone={Number(buckets['31_60'] || 0) > 0 ? 'warn' : 'neutral'}
          />
          <KpiCard
            label="61–90 days"
            value={Number(buckets['61_90'] || 0)}
            kind="money"
            tone={Number(buckets['61_90'] || 0) > 0 ? 'warn' : 'neutral'}
          />
          <KpiCard
            label="90+ days"
            value={Number(buckets['90_plus'] || 0)}
            kind="money"
            tone={Number(buckets['90_plus'] || 0) > 0 ? 'neg' : 'neutral'}
          />
        </div>

        {aged.length > 0 ? (
          <table className="tbl">
            <thead>
              <tr>
                <th>Guest</th>
                <th>Source</th>
                <th>Check-out</th>
                <th className="num">Balance</th>
                <th className="num">Days Overdue</th>
                <th>Bucket</th>
              </tr>
            </thead>
            <tbody>
              {aged.slice(0, 50).map((r: any) => (
                <tr key={r.reservation_id}>
                  <td className="lbl"><strong>{r.guest_name || '—'}</strong></td>
                  <td className="lbl text-mute">{r.source_name || '—'}</td>
                  <td className="lbl">{r.check_out_date || '—'}</td>
                  <td className="num">{fmtMoney(Number(r.open_balance), 'USD')}</td>
                  <td className="num">{r.days_overdue ?? '—'}</td>
                  <td>
                    <span className={`pill ${bucketTone[r.bucket] || ''}`}>
                      {bucketLabel[r.bucket] || r.bucket}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: 24, color: 'var(--ink-mute)', fontStyle: 'italic' }}>
            No aged receivables.
          </div>
        )}
      </Card>

      <div className="card-grid-2" style={{ marginTop: 22 }}>
        <Card
          title="City ledger"
          emphasis={`· ${haCount ?? 0} active`}
          sub="House accounts · companies · agencies"
          source="house_accounts"
        >
          {(houseAccounts ?? []).length === 0 ? (
            <div style={{ padding: 24, color: 'var(--ink-mute)', fontStyle: 'italic' }}>
              No active accounts.
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>ID</th>
                </tr>
              </thead>
              <tbody>
                {(houseAccounts ?? []).map((h: any) => (
                  <tr key={h.house_account_id}>
                    <td className="lbl"><strong>{h.account_name || '—'}</strong></td>
                    <td className="lbl text-mute text-mono">{h.house_account_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="card-sub" style={{ marginTop: 12 }}>
            Showing first 20 of {haCount}.
          </div>
        </Card>

        <Card
          title="Deposits held / due"
          sub="Deposit logic awaiting definition vs Cloudbeds payment flow"
          source="grey"
        >
          <div className="stub" style={{ padding: 32 }}>
            <h3>Coming soon</h3>
            <p>Total deposits held · deposits due (next 30d) · overdue deposits.</p>
          </div>
        </Card>
      </div>

      {Number(buckets['90_plus'] || 0) > 0 && (
        <Insight tone="alert" eye="AR alert">
          <strong>{fmtMoney(Number(buckets['90_plus']), 'USD')}</strong> outstanding in 90+ day
          bucket. Owner action: review collection workflow, escalate to legal if commercial accounts.
        </Insight>
      )}
    </>
  );
}
