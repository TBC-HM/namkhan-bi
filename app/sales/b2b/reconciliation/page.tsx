// app/sales/b2b/reconciliation/page.tsx
// Sales › B2B/DMC › Reconciliation Queue.
// Spec: docs/specs/sales-b2b-dmc/full-spec-v3.md §6.

import B2bSubNav from '../_components/B2bSubNav';
import B2bKpiStrip from '../_components/B2bKpiStrip';

export const dynamic = 'force-dynamic';

interface QueueRow {
  resId: string;
  guest: string;
  checkIn: string;
  nights: number;
  ratePlan: string;
  total: number;
  hint: string;
  confidence: number;
  age: string;
}

const QUEUE: QueueRow[] = [
  { resId: 'CB-89234', guest: 'Müller / Werner',  checkIn: '2026-05-14', nights: 3, ratePlan: 'LPA-AT-LAOS-DLX-DBL-HS', total: 645, hint: 'Asian Trails Laos',  confidence: 0.95, age: '2h' },
  { resId: 'CB-89231', guest: 'Tanaka / Yuki',    checkIn: '2026-05-19', nights: 2, ratePlan: 'LPA-LA-EXEC-DBL-HS',     total: 498, hint: 'Laos Autrement',     confidence: 0.92, age: '4h' },
  { resId: 'CB-89228', guest: 'Bouchard / Marie', checkIn: '2026-05-22', nights: 4, ratePlan: 'LPA-TT-DLX-TWN-LS',      total: 720, hint: 'Tiger Trail Travel', confidence: 0.88, age: '6h' },
  { resId: 'CB-89225', guest: 'Smith / John',     checkIn: '2026-05-25', nights: 3, ratePlan: 'LPA-EX-DLX-DBL-HS',      total: 675, hint: 'Exotissimo Travel',  confidence: 0.85, age: '8h' },
  { resId: 'CB-89221', guest: 'Lee / Mei',        checkIn: '2026-06-01', nights: 5, ratePlan: 'LPA-DT-EXEC-DBL-HS',     total: 1245, hint: 'Diethelm Travel',  confidence: 0.91, age: '12h' },
  { resId: 'CB-89218', guest: 'Khan / Aamir',     checkIn: '2026-06-08', nights: 2, ratePlan: 'LPA-BT-DLX-TWN-HS',      total: 480, hint: 'Buffalo Tours',      confidence: 0.78, age: '18h' },
  { resId: 'CB-89215', guest: 'Rossi / Giulia',   checkIn: '2026-06-12', nights: 3, ratePlan: 'LPA-KH-DLX-DBL-HS',      total: 615, hint: 'Khiri Travel',       confidence: 0.82, age: '22h' },
  { resId: 'CB-89212', guest: 'Petrov / Anna',    checkIn: '2026-06-18', nights: 4, ratePlan: 'LPA-EA-DLX-DBL-HS',      total: 820, hint: 'EasiaTravel',        confidence: 0.79, age: '28h ⚠' },
  { resId: 'CB-89209', guest: 'Wang / Li',        checkIn: '2026-06-22', nights: 2, ratePlan: 'LPA-TI-EXEC-DBL-HS',     total: 510, hint: 'Trails of Indochina', confidence: 0.86, age: '32h ⚠' },
  { resId: 'CB-89206', guest: 'Garcia / Carlos',  checkIn: '2026-06-28', nights: 3, ratePlan: 'LPA-DA-DLX-DBL-HS',      total: 630, hint: 'Destination Asia',   confidence: 0.74, age: '36h ⚠' },
  { resId: 'CB-89203', guest: 'Nguyen / Tran',    checkIn: '2026-07-02', nights: 5, ratePlan: 'LPA-DI-DLX-TWN-HS',      total: 1080, hint: 'Discova Laos',      confidence: 0.93, age: '2d' },
  { resId: 'CB-89200', guest: 'Kim / Soo-jin',    checkIn: '2026-07-08', nights: 2, ratePlan: 'LPA-IV-DLX-DBL-HS',      total: 510, hint: 'Indochina Voyages',  confidence: 0.80, age: '2d' },
];

function pctColor(p: number) {
  if (p >= 0.9) return '#1f6f43';
  if (p >= 0.8) return '#a17a4f';
  return '#a83232';
}

export default function ReconciliationPage() {
  return (
    <>
      <div style={{ fontSize: 11, color: '#8a8170', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 14 }}>
        <strong style={{ color: '#4a4538' }}>Sales</strong> › B2B / DMC › Reconciliation
      </div>
      <h1 style={{ margin: '4px 0 2px', fontFamily: 'Georgia, serif', fontWeight: 500, fontSize: 30 }}>
        Reconciliation queue · <em style={{ color: '#a17a4f' }}>{QUEUE.length} unmapped</em>
      </h1>
      <div style={{ fontSize: 13, color: '#4a4538' }}>
        Hourly detection via <code>governance.detect_dmc_reservations()</code>. Process twice per shift; goal zero unmapped &gt;24h.
      </div>

      <B2bSubNav />
      <B2bKpiStrip />

      <div style={{ background: '#fff', border: '1px solid #e6dfc9', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: '#f7f3e7', textAlign: 'left', color: '#8a8170', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <th style={{ padding: '10px 12px' }}>Reservation</th>
              <th style={{ padding: '10px 12px' }}>Guest</th>
              <th style={{ padding: '10px 12px' }}>Check-in</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>N</th>
              <th style={{ padding: '10px 12px' }}>Rate plan</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total</th>
              <th style={{ padding: '10px 12px' }}>Suggested partner</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Confidence</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Age</th>
              <th style={{ padding: '10px 12px', textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {QUEUE.map((r) => (
              <tr key={r.resId} style={{ borderTop: '1px solid #f0eadb' }}>
                <td style={{ padding: '10px 12px', fontFamily: 'Menlo, monospace', color: '#8a8170' }}>{r.resId}</td>
                <td style={{ padding: '10px 12px' }}>{r.guest}</td>
                <td style={{ padding: '10px 12px', color: '#8a8170' }}>{r.checkIn}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'Menlo, monospace' }}>{r.nights}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'Menlo, monospace', fontSize: 11, color: '#4a4538' }}>{r.ratePlan}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'Menlo, monospace' }}>USD {r.total.toLocaleString()}</td>
                <td style={{ padding: '10px 12px', fontWeight: 500 }}>{r.hint}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'Menlo, monospace', color: pctColor(r.confidence), fontWeight: 600 }}>
                  {(r.confidence * 100).toFixed(0)}%
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: r.age.includes('⚠') ? '#a83232' : '#8a8170', fontFamily: 'Menlo, monospace' }}>{r.age}</td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  <span style={{ background: '#1f6f43', color: '#fff', padding: '3px 9px', borderRadius: 4, fontSize: 11, marginRight: 4 }}>Confirm</span>
                  <span style={{ background: '#fff', color: '#4a4538', border: '1px solid #d9d2bc', padding: '3px 8px', borderRadius: 4, fontSize: 11 }}>Other</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 14, padding: '10px 14px', background: '#fef3c7', border: '1px solid #f3d57a', borderRadius: 6, color: '#5e4818', fontSize: 11.5 }}>
        <strong>Data needed.</strong> Confirm/Other actions are stubs. Wire to{' '}
        <code style={{ background: '#fff', padding: '1px 5px', borderRadius: 3 }}>dmc_reservation_mapping</code> +{' '}
        <code style={{ background: '#fff', padding: '1px 5px', borderRadius: 3 }}>partner_mapping_hints</code> after migration.
      </div>
    </>
  );
}
