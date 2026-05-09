// app/sales/b2b/reconciliation/page.tsx
// Sales › B2B/DMC › Reconciliation Queue.
// WIRED: 101 LPA reservations + per-row partner picker + Confirm action + Cloudbeds deeplink.

import B2bSubNav from '../_components/B2bSubNav';
import B2bKpiStrip from '../_components/B2bKpiStrip';
import MappingPicker from '../_components/MappingPicker';
import { getLpaReservations, getDmcContracts, matchSourceToContract, getMappings, cloudbedsReservationUrl } from '@/lib/dmc';
import { PROPERTY_ID } from '@/lib/supabase';
import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import ArtifactActions from '@/components/page/ArtifactActions';
import { SALES_SUBPAGES } from '../../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const STATUS_PILL: Record<string, { bg: string; bd: string; fg: string }> = {
  confirmed:     { bg: 'var(--st-good-bg)', bd: 'var(--st-good-bd)', fg: 'var(--moss-glow)' },
  not_confirmed: { bg: 'var(--st-warn-bg)', bd: 'var(--st-warn-bd)', fg: 'var(--brass)' },
  cancelled:     { bg: 'var(--st-bad-bg)', bd: 'var(--st-bad-bd)', fg: 'var(--st-bad)' },
  checked_in:    { bg: 'var(--st-info-bg)', bd: 'var(--st-info-bd)', fg: 'var(--st-info-tx)' },
  checked_out:   { bg: '#eee',    bd: '#ccc',    fg: '#555'    },
};

export default async function ReconciliationPage() {
  const [reservations, contracts, mappings] = await Promise.all([
    getLpaReservations(),
    getDmcContracts(),
    getMappings(),
  ]);

  const mappingByRes = new Map(mappings.map((m) => [m.reservation_id, m] as const));
  const contractOptions = contracts
    .filter((c) => c.computed_status !== 'expired')
    .map((c) => ({ contract_id: c.contract_id, partner_short_name: c.partner_short_name, country: c.country }))
    .sort((a, b) => a.partner_short_name.localeCompare(b.partner_short_name));

  const enriched = reservations.map((r) => {
    const existing = mappingByRes.get(r.reservation_id);
    if (existing) {
      const c = contracts.find((x) => x.contract_id === existing.contract_id);
      return {
        ...r,
        matched_contract_id: existing.contract_id,
        matched_partner: c?.partner_short_name ?? '?',
        confirmed: true,
        suggested_only: false,
      };
    }
    const m = matchSourceToContract(r.source_name, contracts);
    return {
      ...r,
      matched_contract_id: m.contract_id,
      matched_partner: m.partner_short_name,
      confirmed: false,
      suggested_only: !!m.contract_id,
    };
  });

  const confirmed = enriched.filter((r) => r.confirmed);
  const unconfirmed = enriched.filter((r) => !r.confirmed);

  return (
    <Page
      eyebrow="Sales · B2B / DMC › Reconciliation"
      title={<>Reconciliation queue · <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>{unconfirmed.length} pending · {confirmed.length} mapped</em></>}
      subPages={SALES_SUBPAGES}
    >
      <B2bSubNav />
      <B2bKpiStrip />

      <Panel title={`LPA reservations · ${reservations.length}`} eyebrow="public.reservations · governance.dmc_reservation_mapping" actions={<ArtifactActions context={{ kind: 'table', title: 'LPA reconciliation', dept: 'sales' }} />}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: "var(--t-base)" }}>
          <thead>
            <tr style={{ background: 'var(--paper-warm)', textAlign: 'left', color: 'var(--ink-mute)', fontSize: "var(--t-xs)", textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <th style={{ padding: '10px 10px' }}>Cloudbeds ID</th>
              <th style={{ padding: '10px 10px' }}>Guest</th>
              <th style={{ padding: '10px 10px' }}>Source</th>
              <th style={{ padding: '10px 10px' }}>Check-in</th>
              <th style={{ padding: '10px 10px', textAlign: 'right' }}>N</th>
              <th style={{ padding: '10px 10px', textAlign: 'right' }}>Total</th>
              <th style={{ padding: '10px 10px' }}>Status</th>
              <th style={{ padding: '10px 10px' }}>Mapping</th>
            </tr>
          </thead>
          <tbody>
            {[...unconfirmed, ...confirmed].map((r) => {
              const pillKey = (r.status ?? 'not_confirmed').toLowerCase();
              const pill = STATUS_PILL[pillKey] ?? STATUS_PILL.not_confirmed;
              const rowBg = r.confirmed ? 'var(--st-good-bg)' : !r.matched_contract_id ? 'var(--paper-warm)' : 'var(--paper-warm)';
              return (
                <tr key={r.reservation_id} style={{ borderTop: '1px solid var(--paper-warm)', background: rowBg }}>
                  <td style={{ padding: '6px 10px' }}>
                    <a
                      href={cloudbedsReservationUrl(r.reservation_id, PROPERTY_ID)}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontFamily: 'var(--mono)', color: 'var(--st-info-tx)', textDecoration: 'none', fontSize: "var(--t-sm)" }}
                      title="Open in Cloudbeds"
                    >
                      {r.reservation_id} ↗
                    </a>
                  </td>
                  <td style={{ padding: '6px 10px', fontSize: "var(--t-sm)" }}>{r.guest_name ?? '—'}</td>
                  <td style={{ padding: '6px 10px', fontWeight: 500, fontSize: "var(--t-sm)" }}>{r.source_name ?? '—'}</td>
                  <td style={{ padding: '6px 10px', color: 'var(--ink-mute)', fontFamily: 'var(--mono)', fontSize: "var(--t-sm)" }}>{r.check_in_date ?? '—'}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'var(--mono)' }}>{r.nights ?? '—'}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'var(--mono)' }}>${Number(r.total_amount ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                  <td style={{ padding: '6px 10px' }}>
                    <span style={{ background: pill.bg, border: `1px solid ${pill.bd}`, color: pill.fg, padding: '2px 7px', borderRadius: 10, fontSize: "var(--t-xs)", fontWeight: 600, textTransform: 'capitalize' }}>
                      {(r.status ?? 'pending').replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '6px 10px' }}>
                    <MappingPicker
                      reservationId={r.reservation_id}
                      contracts={contractOptions}
                      initialContractId={r.matched_contract_id}
                      initialMappedStatus={r.confirmed ? 'mapped' : 'unmapped'}
                      meta={{
                        source_name: r.source_name,
                        rate_plan: 'Leisure Partnership Agreement',
                        total_amount: Number(r.total_amount) || null,
                        check_in_date: r.check_in_date,
                      }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>

      <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--st-good-bg)', border: '1px solid var(--st-good-bd)', borderRadius: 6, color: 'var(--moss)', fontSize: "var(--t-sm)" }}>
        <strong>✓ Live.</strong> {reservations.length} LPA reservations · {confirmed.length} mapped · {unconfirmed.length} pending. Yellow rows = unmatched (no contract on file). Green rows = already confirmed. Click <strong>Confirm</strong> to persist to <code>governance.dmc_reservation_mapping</code>.
      </div>
    </Page>
  );
}
