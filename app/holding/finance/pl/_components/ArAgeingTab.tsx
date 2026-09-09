// app/holding/finance/pl/_components/ArAgeingTab.tsx
// Brief holding-pl-v1 v2 · AR ageing.
//
// Bucket labels are DATA. The payload's ar.buckets object is iterated as it
// comes back — there is no bucket list in this file. Ordering is derived from
// the label itself (a "current"-style bucket first, then by the first number
// in the label) so a renamed or added bucket still sorts sensibly.
//
// Owner instruction: receivables display at FULL CARRYING VALUE. No impairment,
// no provision, no recovery estimate anywhere in this component.

import { Container } from '@/app/(cockpit)/_design';
import type { HoldingPlPayload, ArAgeingRow } from '../_lib/types';
import type { Fetched } from '../_lib/fetchPayload';
import { money, count, dateLabel, num } from '../_lib/format';
import {
  TABLE, TH, TD, TD_NUM, SCROLL_X, HAIR, INK_M, RUST, FOREST,
  EmptyLine, ErrorPanel, LayerNote,
} from './ui';

/** Order buckets by the label's own content — no hardcoded bucket list. */
function bucketRank(label: string): number {
  const l = label.toLowerCase();
  if (l.includes('current') || l.includes('not due')) return -1;
  const m = l.match(/\d+/);
  return m ? Number(m[0]) : Number.MAX_SAFE_INTEGER;
}

export default function ArAgeingTab({ p, rows }: {
  p: HoldingPlPayload; rows: Fetched<ArAgeingRow[]>;
}) {
  const cur = p.reporting_currency;
  const buckets = Object.entries(p.ar.buckets ?? {})
    .sort((a, b) => bucketRank(a[0]) - bucketRank(b[0]));
  const bucketSum = buckets.reduce((s, [, v]) => s + (num(v) ?? 0), 0);

  return (
    <>
      <div style={{ gridColumn: '1 / -1' }}>
        <Container
          title="Open receivables"
          subtitle={`${count(p.ar.invoice_count)} open invoice(s) · oldest ${count(p.ar.oldest_days_overdue)} day(s) overdue · balance as of today, not period-scoped`}
          density="compact"
          status="amber"
        >
          <div style={{
            border: `1px solid ${RUST}33`, borderLeft: `3px solid ${RUST}`,
            padding: '8px 12px', marginBottom: 12, fontSize: 12, color: RUST,
            background: '#FDF6F4',
          }}>
            Full carrying value. No impairment, provision or recovery estimate is
            applied — an overdue balance here is not a statement about collectability.
            This is an <strong>as-of-today balance</strong>: unlike the P&amp;L tabs it
            does not move with the period filter.
          </div>

          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 4 }}>
            <div>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: INK_M, fontWeight: 700 }}>
                Open total
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: FOREST, fontVariantNumeric: 'tabular-nums' }}>
                {money(p.ar.open_total_eur, cur, 2)}
              </div>
            </div>
          </div>

          {buckets.length === 0 ? (
            <EmptyLine what="The payload returned no ageing bucket — there is no open receivable to age." />
          ) : (
            <div style={{ ...SCROLL_X, marginTop: 10 }}>
              <table style={TABLE}>
                <thead>
                  <tr>
                    <th style={TH}>Ageing bucket</th>
                    {buckets.map(([k]) => (
                      <th key={k} style={{ ...TH, textAlign: 'right' }}>{k}</th>
                    ))}
                    <th style={{ ...TH, textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ ...TD, color: INK_M }}>Open balance</td>
                    {buckets.map(([k, v]) => (
                      <td key={k} style={TD_NUM}>{money(v, cur, 2)}</td>
                    ))}
                    <td style={{ ...TD_NUM, fontWeight: 700 }}>{money(bucketSum, cur, 2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          <div style={{ fontSize: 11, color: INK_M, marginTop: 8 }}>
            Buckets carrying no balance in this period are not returned by the
            payload and are not shown.
          </div>
          <LayerNote currency={cur} />
        </Container>
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <Container
          title="Open invoices"
          subtitle="public.v_holding_ar_ageing · native amount and reporting figure side by side"
          density="compact"
        >
          {!rows.ok || !rows.data ? (
            <ErrorPanel what="AR ageing detail" message={rows.error ?? 'Unknown error'} />
          ) : rows.data.length === 0 ? (
            <EmptyLine what="v_holding_ar_ageing returned no row — nothing is outstanding." />
          ) : (
            <div style={SCROLL_X}>
              <table style={TABLE}>
                <thead>
                  <tr>
                    <th style={TH}>Invoice</th>
                    <th style={TH}>Recipient</th>
                    <th style={TH}>Dept</th>
                    <th style={TH}>Subject</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Native</th>
                    <th style={TH}>Ccy</th>
                    <th style={{ ...TH, textAlign: 'right' }}>{cur} reporting</th>
                    <th style={TH}>Issued</th>
                    <th style={TH}>Due</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Days overdue</th>
                    <th style={TH}>Bucket</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.data.map((r, i) => {
                    const od = num(r.days_overdue) ?? 0;
                    return (
                      <tr key={`${r.invoice_number}-${i}`}>
                        <td style={{ ...TD, fontWeight: 600, whiteSpace: 'nowrap' }}>{r.invoice_number}</td>
                        <td style={TD}>{r.recipient_name}</td>
                        <td style={{ ...TD, color: FOREST, fontWeight: 600 }}>{r.dept_code}</td>
                        <td style={{ ...TD, maxWidth: 280 }}>{r.subject ?? '—'}</td>
                        <td style={TD_NUM}>{money(r.amount_native, r.currency, 2)}</td>
                        <td style={{ ...TD, color: INK_M }}>{r.currency}</td>
                        <td style={{ ...TD_NUM, fontWeight: 600 }}>{money(r.amount_eur, cur, 2)}</td>
                        <td style={{ ...TD, whiteSpace: 'nowrap' }}>{dateLabel(r.issued_at)}</td>
                        <td style={{ ...TD, whiteSpace: 'nowrap' }}>{dateLabel(r.due_at)}</td>
                        <td style={{ ...TD_NUM, color: od > 0 ? RUST : INK_M, fontWeight: od > 0 ? 700 : 400 }}>
                          {count(r.days_overdue)}
                        </td>
                        <td style={{ ...TD, whiteSpace: 'nowrap' }}>{r.ageing_bucket}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ fontSize: 11, color: INK_M, marginTop: 8, borderTop: `1px solid ${HAIR}`, paddingTop: 6 }}>
            Native is the currency the counterparty is billed in. The {cur} column
            is the reporting layer, converted at the rate described under Data quality.
          </div>
        </Container>
      </div>
    </>
  );
}
