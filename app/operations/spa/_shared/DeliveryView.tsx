// app/operations/spa/_shared/DeliveryView.tsx
// Spa module v1 — delivery-record list. Two layers:
//  1. spa.treatment_bookings closed records (completed / no_show / cancelled)
//     via proposed bridge v_spa_treatment_bookings — the structured delivery
//     record once the booking flow is live.
//  2. Cloudbeds folio POS lines (Other Operated / Spa) — the de-facto delivery
//     record TODAY (live view v_fnb_raw_txn_enriched, property-scoped).

import { DashboardPage, Container, KpiTile, type KpiTileProps, type DashboardTab } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '@/app/operations/_subpages';
import { TOKENS, MONO } from '@/components/cockpit/tokens';
import SpaSubnav from './SpaSubnav';
import BridgeNotice from './BridgeNotice';
import { getSpaDeliveryRecords, getFolioSpaTransactions, localTimeStr } from './data';

const fmtMoney = (n: number | null, ccy: string | null) =>
  n == null ? '—' : `${ccy === 'EUR' ? '€' : ccy === 'LAK' ? '₭' : '$'}${Math.round(Number(n)).toLocaleString('en-US')}`;

export default async function DeliveryView({ propertyId }: { propertyId: number }) {
  const [recordsB, folioTxnsB] = await Promise.all([
    getSpaDeliveryRecords(propertyId),
    getFolioSpaTransactions(propertyId, 300),
  ]);

  const records = recordsB.rows;
  const folioTxns = folioTxnsB.rows;
  const delivered = records.filter((r) => r.status === 'completed');
  const posted = delivered.filter((r) => r.posted_to_folio).length;
  const noShows = records.filter((r) => r.status === 'no_show').length;
  const deliveredRev = delivered.reduce((s, r) => s + Number(r.price ?? 0), 0);
  const currency = delivered.find((r) => r.currency)?.currency ?? (propertyId === 1000001 ? 'EUR' : 'USD');
  const folioRev30 = folioTxns.reduce((s, t) => s + t.amount, 0);

  const kpis: KpiTileProps[] = [
    { label: 'Delivered (30d)', value: String(delivered.length), footnote: 'completed bookings', status: delivered.length > 0 ? 'green' : 'grey', size: 'sm' },
    { label: 'Delivered revenue', value: fmtMoney(deliveredRev, currency), footnote: 'booked prices, completed', status: 'grey', size: 'sm' },
    { label: 'Folio-posted', value: `${posted}/${delivered.length}`, footnote: 'completed with Cloudbeds charge', status: delivered.length > 0 && posted < delivered.length ? 'amber' : 'grey', size: 'sm' },
    { label: 'No-shows (30d)', value: String(noShows), footnote: 'booked, never delivered', status: noShows > 0 ? 'amber' : 'grey', size: 'sm' },
    { label: 'Folio spa lines', value: String(folioTxns.length), footnote: `de-facto record · ${fmtMoney(folioRev30, 'USD')}`, status: folioTxns.length > 0 ? 'green' : 'grey', size: 'sm' },
  ];

  const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', borderBottom: `1px solid ${TOKENS.ink}`, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: TOKENS.inkSoft, fontFamily: MONO };
  const thR: React.CSSProperties = { ...th, textAlign: 'right' };
  const td: React.CSSProperties = { padding: '8px 10px', borderBottom: `1px solid ${TOKENS.border}`, fontSize: 13, color: TOKENS.ink };
  const tdR: React.CSSProperties = { ...td, textAlign: 'right', fontFamily: MONO };

  const tabs: DashboardTab[] = OPERATIONS_SUBPAGES.map((s) => ({ key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/spa') })) as DashboardTab[];

  return (
    <DashboardPage title="Spa delivery records" subtitle="Operations · Spa · completed treatments + folio posting trail · last 30 days" tabs={tabs}>
      <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <SpaSubnav active="delivery" />

        {recordsB.bridgeMissing && <BridgeNotice what="The structured delivery record" />}

        <Container title="Delivery snapshot · last 30 days" density="compact">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            {kpis.map((t, i) => <KpiTile key={i} {...t} />)}
          </div>
        </Container>

        <Container title="Closed bookings" subtitle="completed · no-show · cancelled — structured record from spa.treatment_bookings" density="compact">
          {records.length === 0 ? (
            <div style={{ padding: 20, fontSize: 13, color: TOKENS.inkSoft }}>
              {recordsB.bridgeMissing ? 'Awaiting bridge deployment.' : 'No closed bookings in the last 30 days.'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto', border: `1px solid ${TOKENS.border}`, borderRadius: 6 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', background: TOKENS.bgRaised }}>
                <thead>
                  <tr>
                    <th style={th}>Date · time</th><th style={th}>Guest</th><th style={th}>Treatment</th>
                    <th style={th}>Therapist</th><th style={th}>Room</th><th style={th}>Status</th>
                    <th style={thR}>Price</th><th style={th}>Folio charge</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.booking_id}>
                      <td style={{ ...td, fontFamily: MONO, fontSize: 12 }}>{r.scheduled_at.slice(0, 10)} {localTimeStr(r.scheduled_at, propertyId)}</td>
                      <td style={td}>{r.guest_name ?? '—'}</td>
                      <td style={td}>{r.treatment_name} <span style={{ color: TOKENS.inkSoft, fontSize: 11 }}>· {r.duration_min}min</span></td>
                      <td style={td}>{r.therapist_name ?? '—'}</td>
                      <td style={td}>{r.room_name ?? '—'}</td>
                      <td style={{ ...td, fontFamily: MONO, fontSize: 11, textTransform: 'uppercase', color: r.status === 'completed' ? TOKENS.forest : TOKENS.terracotta }}>{r.status}</td>
                      <td style={tdR}>{fmtMoney(r.price, r.currency)}</td>
                      <td style={{ ...td, fontFamily: MONO, fontSize: 11 }}>{r.posted_to_folio ? (r.cloudbeds_charge_id ?? 'posted') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Container>

        <Container title="Folio spa lines · de-facto delivery record" subtitle="Cloudbeds folio (Other Operated / Spa) — most recent 300 lines, live today" density="compact">
          {folioTxns.length === 0 ? (
            <div style={{ padding: 20, fontSize: 13, color: TOKENS.inkSoft }}>No folio spa transactions for this property.</div>
          ) : (
            <div style={{ overflowX: 'auto', border: `1px solid ${TOKENS.border}`, borderRadius: 6 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', background: TOKENS.bgRaised }}>
                <thead>
                  <tr>
                    <th style={th}>When</th><th style={th}>Description</th><th style={th}>Guest</th>
                    <th style={th}>Room</th><th style={th}>Posted by</th><th style={thR}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {folioTxns.map((t) => (
                    <tr key={t.transaction_id}>
                      <td style={{ ...td, fontFamily: MONO, fontSize: 12 }}>{t.local_str ?? t.transaction_date.slice(0, 16).replace('T', ' ')}</td>
                      <td style={td}>{t.description}</td>
                      <td style={td}>{t.guest_name ?? '—'}</td>
                      <td style={td}>{t.room_name ?? '—'}</td>
                      <td style={td}>{t.user_name ?? '—'}</td>
                      <td style={tdR}>{fmtMoney(t.amount, t.currency)}</td>
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
