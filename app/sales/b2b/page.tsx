// app/sales/b2b/page.tsx
// Sales › B2B/DMC — Contracts list. WIRED to governance.dmc_contracts via v_dmc_contracts.

import Link from 'next/link';
import B2bSubNav from './_components/B2bSubNav';
import B2bKpiStrip from './_components/B2bKpiStrip';
import { getDmcContracts } from '@/lib/dmc';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

const STATUS_PILL: Record<string, { bg: string; bd: string; fg: string; label: string }> = {
  active:    { bg: '#e6f4ec', bd: '#aed6c0', fg: '#1f6f43', label: 'Active' },
  expiring:  { bg: '#fef3c7', bd: '#f3d57a', fg: '#5e4818', label: 'Expiring' },
  expired:   { bg: '#f7d9d9', bd: '#e2a8a8', fg: '#7a1f1f', label: 'Expired' },
  draft:     { bg: '#eee',    bd: '#ccc',    fg: '#555',    label: 'Draft' },
  suspended: { bg: '#eee',    bd: '#ccc',    fg: '#555',    label: 'Suspended' },
};

export default async function B2bDmcContractsPage() {
  const contracts = await getDmcContracts();

  return (
    <>
      <div style={{ fontSize: 11, color: '#8a8170', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 14 }}>
        <strong style={{ color: '#4a4538' }}>Sales</strong> › B2B / DMC › Contracts
      </div>
      <h1 style={{ margin: '4px 0 2px', fontFamily: 'Georgia, serif', fontWeight: 500, fontSize: 30 }}>
        B2B / DMC · <em style={{ color: '#a17a4f' }}>contracts</em>
      </h1>
      <div style={{ fontSize: 13, color: '#4a4538' }}>
        {contracts.length} LPA{contracts.length === 1 ? '' : 's'} loaded from{' '}
        <code style={{ fontSize: 11 }}>governance.dmc_contracts</code>. Anti-publication clause + parity guard armed.
      </div>

      <B2bSubNav />
      <B2bKpiStrip />

      {contracts.length === 0 ? (
        <div style={{ background: '#fff', border: '1px dashed #d9d2bc', borderRadius: 8, padding: '40px 20px', textAlign: 'center', color: '#8a8170', fontSize: 13 }}>
          <strong>No contracts yet.</strong>{' '}Upload your first LPA via the upload zone (Phase 2 build pending) or seed manually.
        </div>
      ) : (
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
                <th style={{ padding: '10px 12px' }}>Contact</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>Renew</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => {
                const pill = STATUS_PILL[c.computed_status] ?? STATUS_PILL.draft;
                const dayColor =
                  (c.days_to_expiry ?? 0) < 0 ? '#a83232' :
                  (c.days_to_expiry ?? 0) < 90 ? '#a17a4f' : '#4a4538';
                return (
                  <tr key={c.contract_id} style={{ borderTop: '1px solid #f0eadb' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <Link href={`/sales/b2b/partner/${c.contract_id}`} style={{ color: '#4a4538', textDecoration: 'none', fontWeight: 500 }}>
                        {c.partner_short_name}
                      </Link>
                    </td>
                    <td style={{ padding: '10px 12px' }}>{c.country_flag ?? ''} {c.country ?? '—'}</td>
                    <td style={{ padding: '10px 12px' }}>{c.partner_type}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ background: pill.bg, border: `1px solid ${pill.bd}`, color: pill.fg, padding: '2px 8px', borderRadius: 10, fontSize: 10.5, fontWeight: 600 }}>
                        {pill.label}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#8a8170' }}>{c.effective_date ?? '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#8a8170' }}>{c.expiry_date ?? '—'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'Menlo, monospace', color: dayColor }}>
                      {c.days_to_expiry == null ? '—' :
                        c.days_to_expiry > 0 ? `${c.days_to_expiry}` :
                        c.days_to_expiry === 0 ? 'today' : `${Math.abs(c.days_to_expiry)}d ago`}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#4a4538', fontSize: 11.5 }}>
                      {c.contact_name ?? <span style={{ color: '#c5b89a', fontStyle: 'italic' }}>lorem ipsum</span>}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', color: '#8a8170' }}>
                      {c.auto_renew ? '✓' : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 14, padding: '10px 14px', background: '#e6f4ec', border: '1px solid #aed6c0', borderRadius: 6, color: '#1f5f3a', fontSize: 11.5 }}>
        <strong>✓ Wired.</strong> Reading from{' '}
        <code style={{ background: '#fff', padding: '1px 5px', borderRadius: 3 }}>public.v_dmc_contracts</code>{' '}
        (wraps <code>governance.v_dmc_contracts_listing</code>). KPI strip values still mock — wire to{' '}
        <code style={{ background: '#fff', padding: '1px 5px', borderRadius: 3 }}>dmc_reservation_mapping</code> after applying the full reconciliation migration from{' '}
        <code style={{ background: '#fff', padding: '1px 5px', borderRadius: 3 }}>docs/specs/sales-b2b-dmc/migration-draft.sql</code>.
      </div>
    </>
  );
}
