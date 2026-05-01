// app/sales/b2b/performance/page.tsx
// Sales › B2B/DMC › Performance scorecard.
// WIRED: aggregates real LPA reservations grouped by source_name + matches against contracts.

import Link from 'next/link';
import B2bSubNav from '../_components/B2bSubNav';
import B2bKpiStrip from '../_components/B2bKpiStrip';
import { getLpaReservations, getDmcContracts, matchSourceToContract } from '@/lib/dmc';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface PartnerRow {
  source_name: string;
  reservation_count: number;
  rns: number;
  revenue: number;
  cancelled_count: number;
  matched_contract_id: string | null;
  matched_partner: string | null;
}

export default async function PerformancePage() {
  const [reservations, contracts] = await Promise.all([
    getLpaReservations(),
    getDmcContracts(),
  ]);

  // Aggregate by source_name
  const byPartner = new Map<string, PartnerRow>();
  for (const r of reservations) {
    const src = r.source_name ?? '(unknown)';
    if (!byPartner.has(src)) {
      const m = matchSourceToContract(src, contracts);
      byPartner.set(src, {
        source_name: src,
        reservation_count: 0,
        rns: 0,
        revenue: 0,
        cancelled_count: 0,
        matched_contract_id: m.contract_id,
        matched_partner: m.partner_short_name,
      });
    }
    const row = byPartner.get(src)!;
    if (r.is_cancelled) {
      row.cancelled_count += 1;
    } else {
      row.reservation_count += 1;
      row.rns += Number(r.nights) || 0;
      row.revenue += Number(r.total_amount) || 0;
    }
  }

  const partners = Array.from(byPartner.values()).sort((a, b) => b.revenue - a.revenue);
  const totalRevenue = partners.reduce((s, p) => s + p.revenue, 0);
  const totalRns = partners.reduce((s, p) => s + p.rns, 0);
  const totalRes = partners.reduce((s, p) => s + p.reservation_count, 0);

  return (
    <>
      <div style={{ fontSize: 11, color: '#8a8170', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 14 }}>
        <strong style={{ color: '#4a4538' }}>Sales</strong> › B2B / DMC › Performance
      </div>
      <h1 style={{ margin: '4px 0 2px', fontFamily: 'Georgia, serif', fontWeight: 500, fontSize: 30 }}>
        Partner scorecard · <em style={{ color: '#a17a4f' }}>all-time</em>
      </h1>
      <div style={{ fontSize: 13, color: '#4a4538' }}>
        {partners.length} unique sources on LPA rate plan. Aggregated from <code>public.reservations</code>.
      </div>

      <B2bSubNav />
      <B2bKpiStrip />

      <div style={{ background: '#fff', border: '1px solid #e6dfc9', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: '#f7f3e7', textAlign: 'left', color: '#8a8170', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <th style={{ padding: '10px 12px' }}>#</th>
              <th style={{ padding: '10px 12px' }}>Source (Cloudbeds)</th>
              <th style={{ padding: '10px 12px' }}>Matched contract</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Bookings</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Cxl</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>RNs</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Revenue</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>ADR</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Share</th>
            </tr>
          </thead>
          <tbody>
            {partners.map((p, i) => {
              const adr = p.rns > 0 ? p.revenue / p.rns : 0;
              const share = totalRevenue > 0 ? (p.revenue / totalRevenue) * 100 : 0;
              return (
                <tr key={p.source_name} style={{ borderTop: '1px solid #f0eadb' }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'Menlo, monospace', color: '#8a8170' }}>{i + 1}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 500 }}>{p.source_name}</td>
                  <td style={{ padding: '10px 12px' }}>
                    {p.matched_contract_id ? (
                      <Link href={`/sales/b2b/partner/${p.matched_contract_id}`} style={{ color: '#1f6f43', textDecoration: 'none', fontWeight: 500 }}>
                        ✓ {p.matched_partner}
                      </Link>
                    ) : (
                      <span style={{ color: '#a83232', fontStyle: 'italic', fontSize: 11.5 }}>no contract on file</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'Menlo, monospace' }}>{p.reservation_count}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'Menlo, monospace', color: p.cancelled_count > 0 ? '#a83232' : '#8a8170' }}>{p.cancelled_count || '—'}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'Menlo, monospace' }}>{p.rns}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'Menlo, monospace' }}>USD {p.revenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'Menlo, monospace', color: '#8a8170' }}>USD {adr.toFixed(0)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'Menlo, monospace' }}>{share.toFixed(1)}%</td>
                </tr>
              );
            })}
            <tr style={{ borderTop: '2px solid #e6dfc9', background: '#f7f3e7', fontWeight: 600 }}>
              <td colSpan={3} style={{ padding: '10px 12px' }}>Total · {partners.length} sources</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'Menlo, monospace' }}>{totalRes}</td>
              <td style={{ padding: '10px 12px' }}></td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'Menlo, monospace' }}>{totalRns}</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'Menlo, monospace' }}>USD {totalRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'Menlo, monospace', color: '#8a8170' }}>USD {totalRns > 0 ? (totalRevenue / totalRns).toFixed(0) : 0}</td>
              <td style={{ padding: '10px 12px', textAlign: 'right' }}>100%</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 14, padding: '10px 14px', background: '#e6f4ec', border: '1px solid #aed6c0', borderRadius: 6, color: '#1f5f3a', fontSize: 11.5 }}>
        <strong>✓ Wired.</strong> Real revenue + RNs from {partners.length} sources on LPA rate plan. Sources without contracts = revenue at risk (no anti-publication clause / parity guard / payment terms enforced).
      </div>
    </>
  );
}
