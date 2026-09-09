// app/holding/finance/pl/_components/UploadTab.tsx
// Brief holding-pl-v1 v2 · Upload.
//
// BLOCKED — DELIBERATELY NOT WIRED. The brief asks for an Excel upload writing
// holding.gl_uploads / holding.gl_entries. Those base tables exist, but as of
// this build there is:
//   · no public bridge over them (no public.v_holding_gl_uploads), and
//   · no ingest function (no public.fn_holding_gl_upload*).
// L5 forbids reading a non-public object from the app without a public v_*/fn_*
// bridge, and L3 forbids creating either one without discover-before-create and
// PBS approval. A builder that quietly ran that DDL would be self-approving (L23).
//
// So this tab renders the provenance of the data that IS loaded — every string
// from payload.data_quality — and states precisely what is missing. It shows no
// upload control, because a control that cannot write would misrepresent the
// module's state.

import { Container } from '@/app/(cockpit)/_design';
import type { HoldingPlPayload } from '../_lib/types';
import { count, dateLabel, money } from '../_lib/format';
import { HAIR, INK_M, RUST, FOREST, TABLE, TH, TD, SCROLL_X } from './ui';

export default function UploadTab({ p }: { p: HoldingPlPayload }) {
  const cur = p.reporting_currency;
  const missing = [
    {
      object: 'public.v_holding_gl_uploads',
      kind: 'bridge view',
      why: 'the app cannot read holding.gl_uploads directly — non-public reads go through a public v_* bridge',
    },
    {
      object: 'public.fn_holding_gl_upload_load(...)',
      kind: 'SECURITY DEFINER function',
      why: 'parsing a workbook into holding.gl_entries is a write path, and no such function exists yet',
    },
  ];

  return (
    <>
      <div style={{ gridColumn: '1 / -1' }}>
        <Container
          title="Upload — not yet wired"
          subtitle="The ingest path for this module does not exist in the database yet."
          density="compact"
          status="red"
        >
          <div style={{
            border: `1px solid ${RUST}`, borderLeft: `3px solid ${RUST}`,
            padding: '10px 14px', fontSize: 13, background: '#FDF6F4',
            marginBottom: 12,
          }}>
            <div style={{ fontWeight: 700, color: RUST, marginBottom: 6 }}>
              No upload control is shown, on purpose.
            </div>
            <div style={{ color: INK_M, lineHeight: 1.55 }}>
              The base tables <code>holding.gl_uploads</code> and{' '}
              <code>holding.gl_entries</code> exist and hold the current data, but the
              two objects the app would need in order to read and write them have not
              been created. Creating them is schema work that needs owner approval
              before it is applied, so this build stops at the boundary rather than
              shipping a button that cannot save.
            </div>
          </div>

          <div style={SCROLL_X}>
            <table style={TABLE}>
              <thead>
                <tr>
                  <th style={TH}>Missing object</th>
                  <th style={TH}>Kind</th>
                  <th style={TH}>Why it is needed</th>
                </tr>
              </thead>
              <tbody>
                {missing.map((m) => (
                  <tr key={m.object}>
                    <td style={{ ...TD, fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {m.object}
                    </td>
                    <td style={{ ...TD, whiteSpace: 'nowrap', color: INK_M }}>{m.kind}</td>
                    <td style={TD}>{m.why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ fontSize: 11, color: INK_M, marginTop: 10, borderTop: `1px solid ${HAIR}`, paddingTop: 8 }}>
            Until then the figures on the other four tabs are live and correct —
            they are read from the gold layer, which is already populated.
          </div>
        </Container>
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <Container
          title="Provenance of the loaded data"
          subtitle="Where the figures on this page came from · payload.data_quality"
          density="compact"
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {[
                { k: 'Source', v: p.data_quality.source },
                { k: 'FX basis', v: p.data_quality.fx_basis },
                { k: 'Estimated lines', v: `${count(p.data_quality.estimated_cost_lines)} line(s), ${money(p.totals.estimated_cost_eur, cur, 2)}` },
                { k: 'Cash-basis cost', v: p.data_quality.no_cash_basis_cost ? 'None held' : 'Held' },
                { k: 'Entity', v: p.entity },
                { k: 'Period loaded', v: `${dateLabel(p.period.from)} — ${dateLabel(p.period.to)}` },
                { k: 'Payload generated', v: dateLabel(p.generated_at) },
              ].map((r) => (
                <tr key={r.k}>
                  <td style={{
                    padding: '6px 10px 6px 0', fontSize: 11, color: INK_M,
                    textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 700,
                    whiteSpace: 'nowrap', verticalAlign: 'top', width: '1%',
                    borderBottom: `1px solid ${HAIR}55`,
                  }}>{r.k}</td>
                  <td style={{ padding: '6px 0', fontSize: 12, borderBottom: `1px solid ${HAIR}55` }}>
                    {r.v}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 11, color: FOREST, marginTop: 10, fontWeight: 600 }}>
            This is a manual reconstruction, not a system export. Treat it accordingly.
          </div>
        </Container>
      </div>
    </>
  );
}
