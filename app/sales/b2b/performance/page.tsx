// app/sales/b2b/performance/page.tsx
// Sales › B2B/DMC › Performance scorecard.
// Spec: docs/specs/sales-b2b-dmc/full-spec-v3.md §8.

import Link from 'next/link';
import B2bSubNav from '../_components/B2bSubNav';
import B2bKpiStrip from '../_components/B2bKpiStrip';
import { MOCK_CONTRACTS } from '../_components/mockContracts';

export const dynamic = 'force-dynamic';

export default function PerformancePage() {
  // sort by revenue desc
  const partners = [...MOCK_CONTRACTS]
    .filter((c) => c.status !== 'expired' && c.status !== 'draft')
    .sort((a, b) => b.revenueYtd - a.revenueYtd);

  const totalRevenue = partners.reduce((s, p) => s + p.revenueYtd, 0);
  const totalRns = partners.reduce((s, p) => s + p.rnsYtd, 0);

  return (
    <>
      <div style={{ fontSize: 11, color: '#8a8170', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 14 }}>
        <strong style={{ color: '#4a4538' }}>Sales</strong> › B2B / DMC › Performance
      </div>
      <h1 style={{ margin: '4px 0 2px', fontFamily: 'Georgia, serif', fontWeight: 500, fontSize: 30 }}>
        Partner scorecard · <em style={{ color: '#a17a4f' }}>YTD</em>
      </h1>
      <div style={{ fontSize: 13, color: '#4a4538' }}>
        Ranked by revenue. Mapping health = (mapped reservations) ÷ (detected DMC reservations) per partner.
      </div>

      <B2bSubNav />
      <B2bKpiStrip />

      <div style={{ background: '#fff', border: '1px solid #e6dfc9', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: '#f7f3e7', textAlign: 'left', color: '#8a8170', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <th style={{ padding: '10px 12px' }}>#</th>
              <th style={{ padding: '10px 12px' }}>Partner</th>
              <th style={{ padding: '10px 12px' }}>Country</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>RNs YTD</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Revenue YTD</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>ADR</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Share</th>
              <th style={{ padding: '10px 12px', textAlign: 'center' }}>Parity</th>
              <th style={{ padding: '10px 12px', textAlign: 'center' }}>Mapping health</th>
            </tr>
          </thead>
          <tbody>
            {partners.map((p, i) => {
              const adr = p.rnsYtd > 0 ? p.revenueYtd / p.rnsYtd : 0;
              const share = totalRevenue > 0 ? (p.revenueYtd / totalRevenue) * 100 : 0;
              const mappingHealth = 85 + ((i * 7) % 15); // mock 85-99%
              const mappingColor = mappingHealth >= 95 ? '#1f6f43' : mappingHealth >= 90 ? '#a17a4f' : '#a83232';
              return (
                <tr key={p.id} style={{ borderTop: '1px solid #f0eadb' }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'Menlo, monospace', color: '#8a8170' }}>{i + 1}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <Link href={`/sales/b2b/partner/${p.id}`} style={{ color: '#4a4538', textDecoration: 'none', fontWeight: 500 }}>
                      {p.partner}
                    </Link>
                  </td>
                  <td style={{ padding: '10px 12px' }}>{p.flag} {p.country}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'Menlo, monospace' }}>{p.rnsYtd}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'Menlo, monospace' }}>USD {p.revenueYtd.toLocaleString()}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'Menlo, monospace', color: '#8a8170' }}>USD {adr.toFixed(0)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'Menlo, monospace' }}>{share.toFixed(1)}%</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    {p.parity > 0 ? (
                      <span style={{ color: '#a83232', fontWeight: 600 }}>{p.parity}</span>
                    ) : (
                      <span style={{ color: '#1f6f43' }}>✓</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'Menlo, monospace', color: mappingColor, fontWeight: 600 }}>
                    {mappingHealth}%
                  </td>
                </tr>
              );
            })}
            <tr style={{ borderTop: '2px solid #e6dfc9', background: '#f7f3e7', fontWeight: 600 }}>
              <td colSpan={3} style={{ padding: '10px 12px' }}>Total · {partners.length} active partners</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'Menlo, monospace' }}>{totalRns}</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'Menlo, monospace' }}>USD {totalRevenue.toLocaleString()}</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'Menlo, monospace', color: '#8a8170' }}>USD {totalRns > 0 ? (totalRevenue / totalRns).toFixed(0) : 0}</td>
              <td style={{ padding: '10px 12px', textAlign: 'right' }}>100%</td>
              <td colSpan={2}></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 14, padding: '10px 14px', background: '#fef3c7', border: '1px solid #f3d57a', borderRadius: 6, color: '#5e4818', fontSize: 11.5 }}>
        <strong>Data needed.</strong> Mock scorecard. Mapping health % is computed; rest is mock. Wire to{' '}
        <code style={{ background: '#fff', padding: '1px 5px', borderRadius: 3 }}>dmc_partner_performance_mv</code> after migration.
      </div>
    </>
  );
}
