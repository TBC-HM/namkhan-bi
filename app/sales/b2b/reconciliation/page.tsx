// app/sales/b2b/reconciliation/page.tsx
// Sales › B2B/DMC › Reconciliation Queue.
// WIRED to real public.reservations on LPA rate plan + fuzzy-matched against governance.dmc_contracts.

import B2bSubNav from '../_components/B2bSubNav';
import B2bKpiStrip from '../_components/B2bKpiStrip';
import { getLpaReservations, getDmcContracts, matchSourceToContract } from '@/lib/dmc';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

function pctColor(p: number) {
  if (p >= 0.9) return '#1f6f43';
  if (p >= 0.7) return '#a17a4f';
  return '#a83232';
}

const STATUS_PILL: Record<string, { bg: string; bd: string; fg: string }> = {
  confirmed:     { bg: '#e6f4ec', bd: '#aed6c0', fg: '#1f6f43' },
  not_confirmed: { bg: '#fef3c7', bd: '#f3d57a', fg: '#5e4818' },
  cancelled:     { bg: '#f7d9d9', bd: '#e2a8a8', fg: '#7a1f1f' },
  checked_in:    { bg: '#e7eef5', bd: '#aac2db', fg: '#2c4d70' },
  checked_out:   { bg: '#eee',    bd: '#ccc',    fg: '#555'    },
};

export default async function ReconciliationPage() {
  const [reservations, contracts] = await Promise.all([
    getLpaReservations(),
    getDmcContracts(),
  ]);

  // For each reservation, fuzzy-match source_name against contracts
  const enriched = reservations.map((r) => {
    const m = matchSourceToContract(r.source_name, contracts);
    const confidence = m.contract_id
      ? (r.source_name && m.partner_short_name && r.source_name.toLowerCase() === m.partner_short_name.toLowerCase() ? 1.0 : 0.85)
      : 0;
    return { ...r, matched_contract_id: m.contract_id, matched_partner: m.partner_short_name, confidence };
  });

  const unmatchedSources = Array.from(
    new Set(enriched.filter((r) => !r.matched_contract_id).map((r) => r.source_name ?? '(unknown)')),
  ).sort();

  const matched = enriched.filter((r) => r.matched_contract_id);
  const unmatched = enriched.filter((r) => !r.matched_contract_id);

  return (
    <>
      <div style={{ fontSize: 11, color: '#8a8170', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 14 }}>
        <strong style={{ color: '#4a4538' }}>Sales</strong> › B2B / DMC › Reconciliation
      </div>
      <h1 style={{ margin: '4px 0 2px', fontFamily: 'Georgia, serif', fontWeight: 500, fontSize: 30 }}>
        Reconciliation queue · <em style={{ color: '#a17a4f' }}>{reservations.length} LPA reservations</em>
      </h1>
      <div style={{ fontSize: 13, color: '#4a4538' }}>
        All reservations on rate plan <code>Leisure Partnership Agreement</code> (and Corporate variant). Fuzzy-matched to <code>dmc_contracts.partner_short_name</code> by source.
      </div>

      <B2bSubNav />
      <B2bKpiStrip />

      {/* Unmatched sources alert */}
      {unmatchedSources.length > 0 && (
        <div
          style={{
            marginBottom: 12,
            padding: '10px 14px',
            background: '#fef3c7',
            border: '1px solid #f3d57a',
            borderRadius: 6,
            color: '#5e4818',
            fontSize: 12,
          }}
        >
          <strong>{unmatchedSources.length} unmatched source{unmatchedSources.length === 1 ? '' : 's'}.</strong>{' '}
          Add as contracts: {unmatchedSources.slice(0, 6).map((s, i) => (
            <span key={s}>
              <code style={{ background: '#fff', padding: '1px 5px', borderRadius: 3, marginRight: 4 }}>{s}</code>
            </span>
          ))}
          {unmatchedSources.length > 6 ? <em> + {unmatchedSources.length - 6} more</em> : null}
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid #e6dfc9', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: '#f7f3e7', textAlign: 'left', color: '#8a8170', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <th style={{ padding: '10px 12px' }}>Reservation</th>
              <th style={{ padding: '10px 12px' }}>Guest</th>
              <th style={{ padding: '10px 12px' }}>Country</th>
              <th style={{ padding: '10px 12px' }}>Source (Cloudbeds)</th>
              <th style={{ padding: '10px 12px' }}>Suggested partner</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Conf.</th>
              <th style={{ padding: '10px 12px' }}>Check-in</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>N</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total</th>
              <th style={{ padding: '10px 12px' }}>Room</th>
              <th style={{ padding: '10px 12px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {/* Unmatched first (need attention) */}
            {[...unmatched, ...matched].map((r) => {
              const pillKey = (r.status ?? 'not_confirmed').toLowerCase();
              const pill = STATUS_PILL[pillKey] ?? STATUS_PILL.not_confirmed;
              return (
                <tr key={r.reservation_id} style={{ borderTop: '1px solid #f0eadb', background: !r.matched_contract_id ? '#fffbf2' : '#fff' }}>
                  <td style={{ padding: '8px 12px', fontFamily: 'Menlo, monospace', color: '#8a8170', fontSize: 11 }}>{r.reservation_id.slice(-8)}</td>
                  <td style={{ padding: '8px 12px', fontSize: 12 }}>{r.guest_name ?? '—'}</td>
                  <td style={{ padding: '8px 12px', color: '#8a8170', fontSize: 11.5 }}>{r.guest_country ?? '—'}</td>
                  <td style={{ padding: '8px 12px', fontWeight: 500, fontSize: 12 }}>{r.source_name ?? '—'}</td>
                  <td style={{ padding: '8px 12px' }}>
                    {r.matched_partner ? (
                      <span style={{ color: '#1f6f43', fontWeight: 500 }}>→ {r.matched_partner}</span>
                    ) : (
                      <span style={{ color: '#a83232', fontStyle: 'italic' }}>unmatched</span>
                    )}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'Menlo, monospace', color: pctColor(r.confidence), fontWeight: 600 }}>
                    {r.confidence > 0 ? `${(r.confidence * 100).toFixed(0)}%` : '—'}
                  </td>
                  <td style={{ padding: '8px 12px', color: '#8a8170', fontFamily: 'Menlo, monospace', fontSize: 11.5 }}>{r.check_in_date ?? '—'}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'Menlo, monospace' }}>{r.nights ?? '—'}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'Menlo, monospace' }}>USD {Number(r.total_amount ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                  <td style={{ padding: '8px 12px', fontSize: 11.5, color: '#8a8170' }}>{r.room_type_name ?? '—'}</td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{ background: pill.bg, border: `1px solid ${pill.bd}`, color: pill.fg, padding: '2px 8px', borderRadius: 10, fontSize: 10.5, fontWeight: 600, textTransform: 'capitalize' }}>
                      {(r.status ?? 'pending').replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 14, padding: '10px 14px', background: '#e6f4ec', border: '1px solid #aed6c0', borderRadius: 6, color: '#1f5f3a', fontSize: 11.5 }}>
        <strong>✓ Wired.</strong> Real <code>public.reservations</code> on LPA rate plan ({reservations.length} rows). Auto-suggestions are name-fuzzy matches; full hint-based reconciliation needs <code>dmc_reservation_mapping</code> + <code>partner_mapping_hints</code> from migration-draft.sql. Confirm/Reject actions also pending.
      </div>
    </>
  );
}
