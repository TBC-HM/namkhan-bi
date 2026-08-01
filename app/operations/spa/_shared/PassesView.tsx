// app/operations/spa/_shared/PassesView.tsx
// Spa module v1 — day-pass + package sale & redemption surface (brief
// spa-module-v1, gap 6). Reads v_spa_passes / v_spa_pass_redemptions
// (authenticated/service_role bridges — no anon, guest PII). Sale prices are
// entered at sale time: the 2026-07-31 audit found no priced day-pass tiers
// anywhere (content.activities_catalog row inactive, price NULL), so nothing
// is invented here. Redemptions can be tied to one of today's bookings.

import { DashboardPage, Container, KpiTile, type KpiTileProps, type DashboardTab } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '@/app/operations/_subpages';
import { TOKENS, MONO } from '@/components/cockpit/tokens';
import SpaSubnav from './SpaSubnav';
import BridgeNotice from './BridgeNotice';
import { SellPassForm, RedeemActions, type PassBookingOption } from './PassActions';
import { getSpaPasses, getSpaPassRedemptions, getSpaBookingsForDay, todayIsoAtProperty, localTimeStr } from './data';

const fmtMoney = (n: number | null, ccy: string | null) =>
  n == null ? '—' : `${ccy === 'EUR' ? '€' : ccy === 'LAK' ? '₭' : '$'}${Math.round(Number(n)).toLocaleString('en-US')}`;

const fmtDate = (iso: string | null) => (iso ? iso.slice(0, 10) : '—');

export default async function PassesView({ propertyId }: { propertyId: number }) {
  const todayIso = todayIsoAtProperty(propertyId);
  const [passesB, redemptionsB, todayBookingsB] = await Promise.all([
    getSpaPasses(propertyId),
    getSpaPassRedemptions(propertyId, 100),
    getSpaBookingsForDay(propertyId, todayIso),
  ]);

  const passes = passesB.rows;
  const active = passes.filter((p) => p.status === 'active');
  const creditsOutstanding = active.reduce((s, p) => s + p.credits_remaining, 0);
  const salesRevenue = passes.filter((p) => p.status !== 'cancelled').reduce((s, p) => s + Number(p.price ?? 0), 0);
  const currency = passes.find((p) => p.currency)?.currency ?? (propertyId === 1000001 ? 'EUR' : 'USD');
  const redemptions = redemptionsB.rows;

  const bookingOptions: PassBookingOption[] = todayBookingsB.rows
    .filter((b) => !['cancelled', 'no_show'].includes(b.status))
    .map((b) => ({
      id: b.booking_id,
      label: `${localTimeStr(b.scheduled_at, propertyId)} · ${b.guest_name ?? 'guest'} · ${b.treatment_name}`,
    }));

  const kpis: KpiTileProps[] = [
    { label: 'Active passes', value: String(active.length), footnote: 'day passes + packages', status: active.length > 0 ? 'green' : 'grey', size: 'sm' },
    { label: 'Credits outstanding', value: String(creditsOutstanding), footnote: 'unredeemed treatments owed', status: creditsOutstanding > 0 ? 'amber' : 'grey', size: 'sm' },
    { label: 'Pass sales', value: fmtMoney(salesRevenue, currency), footnote: 'all non-cancelled passes', status: 'grey', size: 'sm' },
    { label: 'Redemptions', value: String(redemptions.length), footnote: 'latest 100 shown', status: redemptions.length > 0 ? 'green' : 'grey', size: 'sm' },
  ];

  const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', borderBottom: `1px solid ${TOKENS.ink}`, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: TOKENS.inkSoft, fontFamily: MONO };
  const thR: React.CSSProperties = { ...th, textAlign: 'right' };
  const td: React.CSSProperties = { padding: '8px 10px', borderBottom: `1px solid ${TOKENS.border}`, fontSize: 13, color: TOKENS.ink };
  const tdR: React.CSSProperties = { ...td, textAlign: 'right', fontFamily: MONO };

  const statusColor = (s: string) =>
    s === 'active' ? TOKENS.forest : s === 'fully_redeemed' ? TOKENS.sand : TOKENS.terracotta;

  const tabs: DashboardTab[] = OPERATIONS_SUBPAGES.map((s) => ({ key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/spa') })) as DashboardTab[];

  return (
    <DashboardPage title="Spa passes & packages" subtitle="Operations · Spa · day passes, multi-treatment packages, redemption trail" tabs={tabs}>
      <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <SpaSubnav active="passes" />

        {passesB.bridgeMissing && <BridgeNotice what="The pass register" />}

        <Container title="Pass snapshot" density="compact">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            {kpis.map((t, i) => <KpiTile key={i} {...t} />)}
          </div>
        </Container>

        <SellPassForm propertyId={propertyId} todayIso={todayIso} />

        <Container title="Passes" density="compact">
          {passes.length === 0 ? (
            <div style={{ padding: 12, fontSize: 13, color: TOKENS.inkSoft }}>
              No passes sold yet. Sell the first day pass or package with the button above.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Pass</th>
                    <th style={th}>Type</th>
                    <th style={th}>Guest</th>
                    <th style={thR}>Credits</th>
                    <th style={th}>Valid</th>
                    <th style={thR}>Price</th>
                    <th style={th}>Status</th>
                    <th style={th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {passes.map((p) => (
                    <tr key={p.pass_id}>
                      <td style={td}>{p.name}</td>
                      <td style={{ ...td, fontFamily: MONO, fontSize: 11 }}>{p.pass_type === 'day_pass' ? 'DAY PASS' : 'PACKAGE'}</td>
                      <td style={td}>{p.guest_name}</td>
                      <td style={tdR}>{p.credits_remaining}/{p.credits_total}</td>
                      <td style={{ ...td, fontFamily: MONO, fontSize: 12 }}>{fmtDate(p.valid_from)} → {fmtDate(p.valid_until)}</td>
                      <td style={tdR}>{fmtMoney(p.price, p.currency)}</td>
                      <td style={{ ...td, fontFamily: MONO, fontSize: 11, color: statusColor(p.status), textTransform: 'uppercase' }}>{p.status.replace('_', ' ')}</td>
                      <td style={td}>
                        <RedeemActions passId={p.pass_id} status={p.status} creditsRemaining={p.credits_remaining} bookings={bookingOptions} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Container>

        <Container title="Redemption trail" density="compact">
          {redemptions.length === 0 ? (
            <div style={{ padding: 12, fontSize: 13, color: TOKENS.inkSoft }}>No redemptions recorded yet.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>When</th>
                    <th style={th}>Pass</th>
                    <th style={th}>Guest</th>
                    <th style={thR}>Credits</th>
                    <th style={th}>Linked booking</th>
                    <th style={th}>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {redemptions.map((r) => (
                    <tr key={r.redemption_id}>
                      <td style={{ ...td, fontFamily: MONO, fontSize: 12 }}>{r.redeemed_at.slice(0, 16).replace('T', ' ')}</td>
                      <td style={td}>{r.pass_name}</td>
                      <td style={td}>{r.pass_guest}</td>
                      <td style={tdR}>{r.credits}</td>
                      <td style={{ ...td, fontSize: 12 }}>
                        {r.booking_id ? `${r.treatment_name ?? 'treatment'} · ${r.booking_guest ?? 'guest'}` : '—'}
                      </td>
                      <td style={{ ...td, fontSize: 12, color: TOKENS.inkSoft }}>{r.note ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Container>
      </div>
    </DashboardPage>
  );
}
