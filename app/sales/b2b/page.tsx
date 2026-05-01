// app/sales/b2b/page.tsx
// Sales › B2B/DMC — Contracts list (default sub-tab).
// Spec: docs/specs/sales-b2b-dmc/full-spec-v3.md §5.
// Mock data — wires to dmc_contracts after migration applied.

import Link from 'next/link';
import B2bSubNav from './_components/B2bSubNav';
import B2bKpiStrip from './_components/B2bKpiStrip';
import { MOCK_CONTRACTS } from './_components/mockContracts';

export const dynamic = 'force-dynamic';

const STATUS_PILL: Record<string, { bg: string; bd: string; fg: string; label: string }> = {
  active:   { bg: '#e6f4ec', bd: '#aed6c0', fg: '#1f6f43', label: 'Active' },
  expiring: { bg: '#fef3c7', bd: '#f3d57a', fg: '#5e4818', label: 'Expiring' },
  expired:  { bg: '#f7d9d9', bd: '#e2a8a8', fg: '#7a1f1f', label: 'Expired' },
  draft:    { bg: '#eee', bd: '#ccc', fg: '#555', label: 'Draft' },
};

function fmtUsd(n: number) {
  if (n === 0) return '—';
  return 'USD ' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export default function B2bDmcContractsPage() {
  return (
    <>
      <div
        style={{
          fontSize: 11,
          color: '#8a8170',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginTop: 14,
        }}
      >
        <strong style={{ color: '#4a4538' }}>Sales</strong> › B2B / DMC › Contracts
      </div>
      <h1
        style={{
          margin: '4px 0 2px',
          fontFamily: 'Georgia, serif',
          fontWeight: 500,
          fontSize: 30,
        }}
      >
        B2B / DMC · <em style={{ color: '#a17a4f' }}>contracts</em>
      </h1>
      <div style={{ fontSize: 13, color: '#4a4538' }}>
        25 LPAs across DMC and tour operator partners. Anti-publication clause + parity guard armed.
      </div>

      <B2bSubNav />
      <B2bKpiStrip />

      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          padding: '10px 12px',
          background: '#fff',
          border: '1px solid #e6dfc9',
          borderRadius: 8,
          marginBottom: 10,
          fontSize: 12.5,
          color: '#4a4538',
          flexWrap: 'wrap',
        }}
      >
        <strong style={{ color: '#8a8170', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Filter</strong>
        <select style={{ border: '1px solid #d9d2bc', borderRadius: 4, padding: '4px 8px', fontSize: 12 }}>
          <option>All countries</option>
          <option>Laos</option>
          <option>Vietnam</option>
          <option>Thailand</option>
          <option>Cambodia</option>
          <option>UK / Europe</option>
        </select>
        <select style={{ border: '1px solid #d9d2bc', borderRadius: 4, padding: '4px 8px', fontSize: 12 }}>
          <option>All statuses</option>
          <option>Active</option>
          <option>Expiring 90d</option>
          <option>Expired</option>
          <option>Draft</option>
        </select>
        <select style={{ border: '1px solid #d9d2bc', borderRadius: 4, padding: '4px 8px', fontSize: 12 }}>
          <option>All types</option>
          <option>DMC</option>
          <option>Tour Operator</option>
          <option>OTA</option>
        </select>
        <span style={{ flex: 1 }} />
        <span
          style={{
            background: '#4a4538',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            padding: '6px 12px',
            fontSize: 12,
          }}
        >
          + Upload contract
        </span>
        <span
          style={{
            background: '#fff',
            border: '1px solid #d9d2bc',
            color: '#4a4538',
            borderRadius: 4,
            padding: '6px 12px',
            fontSize: 12,
          }}
        >
          Export CSV
        </span>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e6dfc9', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: '#f7f3e7', textAlign: 'left', color: '#8a8170', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <th style={{ padding: '10px 12px' }}>Partner</th>
              <th style={{ padding: '10px 12px' }}>Country</th>
              <th style={{ padding: '10px 12px' }}>Type</th>
              <th style={{ padding: '10px 12px' }}>Status</th>
              <th style={{ padding: '10px 12px' }}>Effective</th>
              <th style={{ padding: '10px 12px' }}>Expires</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Days</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>RNs YTD</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Revenue YTD</th>
              <th style={{ padding: '10px 12px', textAlign: 'center' }}>Parity</th>
              <th style={{ padding: '10px 12px', textAlign: 'center' }}>Renew</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_CONTRACTS.map((c) => {
              const pill = STATUS_PILL[c.status];
              const dayColor =
                c.daysToExpiry < 0 ? '#a83232' : c.daysToExpiry < 90 ? '#a17a4f' : '#4a4538';
              return (
                <tr key={c.id} style={{ borderTop: '1px solid #f0eadb' }}>
                  <td style={{ padding: '10px 12px' }}>
                    <Link
                      href={`/sales/b2b/partner/${c.id}`}
                      style={{ color: '#4a4538', textDecoration: 'none', fontWeight: 500 }}
                    >
                      {c.partner}
                    </Link>
                  </td>
                  <td style={{ padding: '10px 12px' }}>{c.flag} {c.country}</td>
                  <td style={{ padding: '10px 12px' }}>{c.type}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span
                      style={{
                        background: pill.bg,
                        border: `1px solid ${pill.bd}`,
                        color: pill.fg,
                        padding: '2px 8px',
                        borderRadius: 10,
                        fontSize: 10.5,
                        fontWeight: 600,
                      }}
                    >
                      {pill.label}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#8a8170' }}>{c.effective}</td>
                  <td style={{ padding: '10px 12px', color: '#8a8170' }}>{c.expires}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'Menlo, monospace', color: dayColor }}>
                    {c.daysToExpiry > 0 ? `${c.daysToExpiry}` : c.daysToExpiry === 0 ? 'today' : `${Math.abs(c.daysToExpiry)}d ago`}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'Menlo, monospace' }}>{c.rnsYtd}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'Menlo, monospace' }}>{fmtUsd(c.revenueYtd)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    {c.parity > 0 ? (
                      <span style={{ color: '#a83232', fontWeight: 600 }}>{c.parity}</span>
                    ) : (
                      <span style={{ color: '#8a8170' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', color: '#8a8170' }}>
                    {c.autoRenew ? '✓' : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div
        style={{
          marginTop: 14,
          padding: '10px 14px',
          background: '#fef3c7',
          border: '1px solid #f3d57a',
          borderRadius: 6,
          color: '#5e4818',
          fontSize: 11.5,
        }}
      >
        <strong>Data needed.</strong> Mock contracts shown. Wire to{' '}
        <code style={{ background: '#fff', padding: '1px 5px', borderRadius: 3 }}>dmc_contracts</code> +{' '}
        <code style={{ background: '#fff', padding: '1px 5px', borderRadius: 3 }}>dmc_contract_rates</code> after applying{' '}
        <code style={{ background: '#fff', padding: '1px 5px', borderRadius: 3 }}>docs/specs/sales-b2b-dmc/migration-draft.sql</code>.
      </div>
    </>
  );
}
