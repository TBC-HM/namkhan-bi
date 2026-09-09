// app/holding/finance/pl/_components/LedgerTab.tsx
// Brief holding-pl-v1 v2 · Ledger — filterable table over public.v_holding_pl_lines.
//
// Filter options are derived from the data (departments from the payload,
// line types from the view). No account list, department list or line-type
// list is written down in this file.
//
// Every row shows the native amount in the counterparty's own currency AND the
// reporting figure, and carries its is_draft / is_estimate flags visibly.

import { Container } from '@/app/(cockpit)/_design';
import type { HoldingPlPayload, PlLineRow } from '../_lib/types';
import { type Fetched, ROW_LIMIT } from '../_lib/fetchPayload';
import { money, dateLabel, count, num } from '../_lib/format';
import {
  TABLE, TH, TD, TD_NUM, SCROLL_X, HAIR, INK_M, FOREST,
  EmptyLine, ErrorPanel, LayerNote, Flag, PL_PATH,
} from './ui';

export default function LedgerTab({
  p, rows, lineTypes, from, to, dept, lineType, flag,
}: {
  p: HoldingPlPayload;
  rows: Fetched<PlLineRow[]>;
  lineTypes: string[];
  from: string; to: string;
  dept: string | null; lineType: string | null; flag: string | null;
}) {
  const cur = p.reporting_currency;
  const sel: React.CSSProperties = {
    border: `1px solid ${HAIR}`, padding: '5px 8px', fontSize: 12,
    fontFamily: 'inherit', background: '#fff', color: 'inherit',
  };

  const lines = rows.ok && rows.data ? rows.data : null;
  const shownSum = lines ? lines.reduce((s, r) => s + (num(r.amount_eur) ?? 0), 0) : null;
  const truncated = lines !== null && lines.length >= ROW_LIMIT;

  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <Container
        title="Ledger"
        subtitle="public.v_holding_pl_lines — every line behind the figures on the other tabs."
        density="compact"
        action={
          <form method="get" action={PL_PATH} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <input type="hidden" name="tab" value="ledger" />
            <input type="hidden" name="from" value={from} />
            <input type="hidden" name="to" value={to} />
            <select name="dept" defaultValue={dept ?? ''} style={sel} aria-label="Department">
              <option value="">All departments</option>
              {p.by_department.map((d) => (
                <option key={d.dept_code} value={d.dept_code}>
                  {d.dept_code} — {d.dept_name}
                </option>
              ))}
            </select>
            <select name="line_type" defaultValue={lineType ?? ''} style={sel} aria-label="Line type">
              <option value="">All line types</option>
              {lineTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select name="flag" defaultValue={flag ?? ''} style={sel} aria-label="Flag">
              <option value="">All lines</option>
              <option value="draft">Draft only</option>
              <option value="estimate">Estimates only</option>
            </select>
            <button type="submit" style={{
              border: `1px solid ${FOREST}`, background: FOREST, color: '#fff',
              padding: '5px 12px', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>Filter</button>
          </form>
        }
      >
        {!lines ? (
          <ErrorPanel what="Ledger" message={rows.error ?? 'Unknown error'} />
        ) : lines.length === 0 ? (
          <EmptyLine what="No ledger line matches this period and filter combination. Widen the period or clear the filters." />
        ) : (
          <>
            <div style={SCROLL_X}>
              <table style={TABLE}>
                <thead>
                  <tr>
                    <th style={TH}>Date</th>
                    <th style={TH}>Type</th>
                    <th style={TH}>Dept</th>
                    <th style={TH}>Account</th>
                    <th style={TH}>Counterparty</th>
                    <th style={TH}>Description</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Native</th>
                    <th style={TH}>Ccy</th>
                    <th style={{ ...TH, textAlign: 'right' }}>{cur} reporting</th>
                    <th style={TH}>Status</th>
                    <th style={TH}>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((r, i) => (
                    <tr key={`${r.source_ref ?? 'line'}-${r.account_code}-${r.line_date}-${i}`}
                        style={r.is_estimate ? { background: '#FDF6F433' } : undefined}>
                      <td style={{ ...TD, whiteSpace: 'nowrap' }}>{dateLabel(r.line_date)}</td>
                      <td style={{ ...TD, whiteSpace: 'nowrap' }}>{r.line_type}</td>
                      <td style={{ ...TD, color: FOREST, fontWeight: 600 }}>{r.dept_code}</td>
                      <td style={TD}>
                        <div style={{ fontWeight: 600 }}>{r.account_code}</div>
                        <div style={{ color: INK_M, fontSize: 11 }}>{r.account_name}</div>
                      </td>
                      <td style={TD}>{r.counterparty ?? '—'}</td>
                      <td style={{ ...TD, maxWidth: 300 }}>{r.description ?? '—'}</td>
                      <td style={TD_NUM}>{money(r.amount_native, r.currency_native, 2)}</td>
                      <td style={{ ...TD, color: INK_M }}>{r.currency_native}</td>
                      <td style={{ ...TD_NUM, fontWeight: 600 }}>{money(r.amount_eur, cur, 2)}</td>
                      <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {r.is_estimate && <Flag tone="estimate">estimate</Flag>}
                          {r.is_draft && <Flag tone="draft">draft</Flag>}
                          {!r.is_estimate && !r.is_draft && (
                            <span style={{ color: INK_M, fontSize: 11 }}>{r.doc_status ?? '—'}</span>
                          )}
                        </div>
                      </td>
                      <td style={{ ...TD, color: INK_M, fontSize: 11, whiteSpace: 'nowrap' }}>
                        {r.source_ref ?? '—'}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td style={{ ...TD, borderTop: `1px solid ${HAIR}`, fontWeight: 700 }} colSpan={8}>
                      Sum of the {count(lines.length)} line(s) displayed
                    </td>
                    <td style={{ ...TD_NUM, borderTop: `1px solid ${HAIR}`, fontWeight: 700 }}>
                      {money(shownSum, cur, 2)}
                    </td>
                    <td style={{ ...TD, borderTop: `1px solid ${HAIR}` }} colSpan={2} />
                  </tr>
                </tbody>
              </table>
            </div>
            {truncated && (
              <div style={{ fontSize: 11, color: '#8C3B2E', marginTop: 8, fontWeight: 600 }}>
                Showing the first {count(ROW_LIMIT)} lines. Narrow the period or the
                filters — the footer sums only what is displayed, not the whole period.
              </div>
            )}
          </>
        )}
        <div style={{ fontSize: 11, color: INK_M, marginTop: 8 }}>
          Draft lines are excluded from EBITDA and from the revenue figure on
          Overview. Estimated lines are included in cost and flagged here and there.
        </div>
        <LayerNote currency={cur} />
      </Container>
    </div>
  );
}
