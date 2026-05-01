// app/sales/b2b/partner/[id]/page.tsx
// Sales › B2B/DMC › Partner drill-down (canonical URL).
// Spec: docs/specs/sales-b2b-dmc/partner-drilldown-spec.md (7-tab profile).
// MVP: Overview tab populated; other 6 tabs are stubs with structure.

import Link from 'next/link';
import { MOCK_CONTRACTS } from '../../_components/mockContracts';

export const dynamic = 'force-dynamic';

const TABS = ['Overview', 'Contract', 'Bookings', 'Parity', 'Performance', 'Activity', 'Documents'] as const;

export default function PartnerDrilldownPage({ params }: { params: { id: string } }) {
  const c = MOCK_CONTRACTS.find((x) => x.id === params.id) ?? MOCK_CONTRACTS[0];

  const statusBg = c.status === 'active' ? '#e6f4ec' : c.status === 'expiring' ? '#fef3c7' : '#f7d9d9';
  const statusBd = c.status === 'active' ? '#aed6c0' : c.status === 'expiring' ? '#f3d57a' : '#e2a8a8';
  const statusFg = c.status === 'active' ? '#1f6f43' : c.status === 'expiring' ? '#5e4818' : '#7a1f1f';

  return (
    <>
      <div style={{ fontSize: 11, color: '#8a8170', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 14 }}>
        <Link href="/sales/b2b" style={{ color: '#8a8170', textDecoration: 'none' }}>← Back</Link>
        {' '}·{' '}
        <strong style={{ color: '#4a4538' }}>Sales</strong> › B2B / DMC › Partner
      </div>

      {/* Header card */}
      <div style={{ background: '#fff', border: '1px solid #e6dfc9', borderRadius: 8, padding: '18px 22px', margin: '8px 0 14px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h1 style={{ margin: 0, fontFamily: 'Georgia, serif', fontWeight: 500, fontSize: 28 }}>
              {c.partner}
            </h1>
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ background: statusBg, border: `1px solid ${statusBd}`, color: statusFg, padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>
                {c.status === 'active' ? '🟢 Active' : c.status === 'expiring' ? '🟡 Expiring' : c.status === 'expired' ? '🔴 Expired' : '○ Draft'}
              </span>
              <span style={{ fontSize: 12.5, color: '#8a8170' }}>
                LPA {c.effective.slice(0, 4)}–{c.expires.slice(0, 4)} · expires {c.expires}
                {c.daysToExpiry > 0 ? ` (${c.daysToExpiry} days)` : c.daysToExpiry < 0 ? ` (${Math.abs(c.daysToExpiry)}d ago)` : ' (today)'}
              </span>
            </div>
            <div style={{ marginTop: 8, fontSize: 12.5, color: '#4a4538', lineHeight: 1.6 }}>
              Type: <strong>{c.type}</strong> · Country: {c.flag} {c.country} · VAT: <code style={{ fontFamily: 'Menlo, monospace', fontSize: 11 }}>569983920900</code>
              <br />
              Address: 4th Floor, Premier Building, Vientiane
              <br />
              Contact: Mr. Santixay Vongsanghane · Inbound Manager
              <br />
              ✉ santixay@example.com · 📞 +856 21 410444
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <span style={{ background: '#4a4538', color: '#fff', padding: '6px 12px', borderRadius: 4, fontSize: 12 }}>Edit</span>
            <span style={{ background: '#fff', border: '1px solid #d9d2bc', color: '#4a4538', padding: '6px 12px', borderRadius: 4, fontSize: 12 }}>Renew</span>
            <span style={{ background: '#fff', border: '1px solid #d9d2bc', color: '#4a4538', padding: '6px 10px', borderRadius: 4, fontSize: 12 }}>⋯</span>
          </div>
        </div>

        {/* Tab nav */}
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e6dfc9', marginTop: 18, marginBottom: -1 }}>
          {TABS.map((t, i) => {
            const active = i === 0;
            return (
              <span
                key={t}
                style={{
                  padding: '8px 14px',
                  fontSize: 12.5,
                  color: active ? '#4a4538' : '#8a8170',
                  borderBottom: active ? '2px solid #a17a4f' : '2px solid transparent',
                  fontWeight: active ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                {i + 1}. {t}
              </span>
            );
          })}
        </div>
      </div>

      {/* Overview tab content — summary card grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
        <div style={{ background: '#fff', border: '1px solid #e6dfc9', borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ fontSize: 10.5, color: '#8a8170', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Contract status</div>
          <div style={{ fontSize: 14, color: '#4a4538', lineHeight: 1.6 }}>
            <strong>Active</strong> · effective {c.effective} → {c.expires}<br />
            {c.daysToExpiry > 0 ? `${c.daysToExpiry} days remaining` : 'expired'} · auto-renew {c.autoRenew ? <strong style={{ color: '#1f6f43' }}>YES</strong> : <strong style={{ color: '#a83232' }}>NO</strong>}
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e6dfc9', borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ fontSize: 10.5, color: '#8a8170', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Booking activity</div>
          <div style={{ fontSize: 14, color: '#4a4538', lineHeight: 1.6 }}>
            <strong>{c.rnsYtd}</strong> RNs YTD across {Math.round(c.rnsYtd / 5)} reservations<br />
            Revenue USD {c.revenueYtd.toLocaleString()} · ADR USD {c.rnsYtd > 0 ? (c.revenueYtd / c.rnsYtd).toFixed(0) : 0} · last booking 3 days ago
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e6dfc9', borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ fontSize: 10.5, color: '#8a8170', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Parity health</div>
          <div style={{ fontSize: 14, color: '#4a4538', lineHeight: 1.6 }}>
            {c.parity === 0 ? (
              <><strong style={{ color: '#1f6f43' }}>✓ 0 open violations</strong> · last scan today 06:00<br />2 historical resolved</>
            ) : (
              <><strong style={{ color: '#a83232' }}>⚠ {c.parity} open violation{c.parity > 1 ? 's' : ''}</strong> · review parity tab</>
            )}
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e6dfc9', borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ fontSize: 10.5, color: '#8a8170', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Anti-publication clause</div>
          <div style={{ fontSize: 14, color: '#4a4538', lineHeight: 1.6 }}>
            <strong style={{ color: '#1f6f43' }}>✓ Present</strong> — partner agrees not to publish nett rates on any public-facing channel.
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e6dfc9', borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ fontSize: 10.5, color: '#8a8170', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Pricing posture</div>
          <div style={{ fontSize: 14, color: '#4a4538', lineHeight: 1.6 }}>
            <strong>NETT</strong> · group surcharge +20% (6+ keys) · extra bed USD 50<br />
            HS / LS season pricing · 9-room × 3-season grid in Contract tab
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e6dfc9', borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ fontSize: 10.5, color: '#8a8170', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Renewal countdown</div>
          <div style={{ fontSize: 14, color: '#4a4538', lineHeight: 1.6 }}>
            {c.daysToExpiry > 0 ? (
              <>
                <strong style={{ color: c.daysToExpiry < 90 ? '#a17a4f' : '#4a4538' }}>{c.daysToExpiry} days</strong>
                {' '}· auto-alerts at 90/60/30/14/7/1 day · last alert: not yet
              </>
            ) : (
              <strong style={{ color: '#a83232' }}>EXPIRED — needs immediate renewal</strong>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14, padding: '10px 14px', background: '#fef3c7', border: '1px solid #f3d57a', borderRadius: 6, color: '#5e4818', fontSize: 11.5 }}>
        <strong>MVP scope.</strong> Only the Overview tab is rendered. Tabs 2-7 (Contract / Bookings / Parity / Performance / Activity / Documents)
        are stubs from the spec — see <code style={{ background: '#fff', padding: '1px 5px', borderRadius: 3 }}>docs/specs/sales-b2b-dmc/partner-drilldown-spec.md</code> §4 for full data model.
      </div>
    </>
  );
}
