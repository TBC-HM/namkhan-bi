// app/holding/finance/pl/_components/BudgetPlan.tsx
// The PLAN itself — account x month — plus the entry form.
//
// PBS 2026-09-10: the Budget tab showed variance only, with nowhere to see or
// enter a budget. This is that surface.
//
// Writes go through public.fn_holding_budget_set_lines, which is APPEND-FORWARD:
// saving a line inserts version+1 and supersedes the previous one. Nothing is
// updated, nothing is deleted, so every revision stays auditable and the
// "who changed the plan and when" question is always answerable.
//
// Server component: the form posts to a server action, so there is no client
// component and no function prop crossing a boundary (module doctrine).

import { Container } from '@/app/(cockpit)/_design';
import type { BudgetLineRow } from '../_lib/types';
import type { Fetched } from '../_lib/fetchPayload';
import { money, num, monthLabel } from '../_lib/format';
import {
  TABLE, TH, TD, TD_NUM, SCROLL_X, HAIR, INK_M, FOREST, RUST,
  EmptyLine, ErrorPanel,
} from './ui';

const MONTHS = ['01','02','03','04','05','06','07','08','09','10','11','12'];

export default function BudgetPlan({
  lines, currency, year, saveAction, accounts, saved,
}: {
  lines: Fetched<BudgetLineRow[]>;
  currency: string;
  year: string | null;
  accounts: Array<{ code: string; label: string }>;
  saveAction: (formData: FormData) => Promise<void>;
  saved: { state: string | null; msg: string | null };
}) {
  const rows = lines.ok && lines.data ? lines.data : null;

  // Pivot to account x month. Only months carrying a value are rendered as
  // figures; the rest stay blank rather than showing a zero nobody planned.
  const byAccount = new Map<string, {
    code: string; name: string; dept: string; type: string;
    months: Map<string, number>; total: number;
  }>();
  for (const r of rows ?? []) {
    const key = r.account_code;
    if (!byAccount.has(key)) {
      byAccount.set(key, {
        code: r.account_code, name: r.account_name, dept: r.dept_code,
        type: r.line_type, months: new Map(), total: 0,
      });
    }
    const a = byAccount.get(key)!;
    const v = num(r.amount_eur) ?? 0;
    a.months.set(r.period_yyyymm.slice(4, 6), v);
    a.total += v;
  }
  const accountRows = Array.from(byAccount.values()).sort((a, b) => {
    if (a.type !== b.type) return a.type === 'revenue' ? -1 : 1;
    return a.code.localeCompare(b.code);
  });

  const monthTotal = (mm: string, kind: 'revenue' | 'cost') =>
    accountRows
      .filter((a) => (kind === 'revenue' ? a.type === 'revenue' : a.type !== 'revenue'))
      .reduce((s, a) => s + (a.months.get(mm) ?? 0), 0);

  const input: React.CSSProperties = {
    border: `1px solid ${HAIR}`, padding: '5px 8px', fontSize: 12,
    fontFamily: 'inherit', background: '#fff', color: 'inherit',
  };

  return (
    <>
      <div style={{ gridColumn: '1 / -1' }}>
        <Container
          title={`The plan${year ? ` · FY ${year}` : ''}`}
          subtitle="public.v_holding_budget_lines · account by month, latest version of each line"
          density="compact"
        >
          {!rows ? (
            <ErrorPanel what="The plan" message={lines.error ?? 'Unknown error'} />
          ) : accountRows.length === 0 ? (
            <EmptyLine what={`No budget line exists${year ? ` for ${year}` : ''} yet. Add one below, or seed a year from posted actuals.`} />
          ) : (
            <div style={SCROLL_X}>
              <table style={TABLE}>
                <thead>
                  <tr>
                    <th style={TH}>Account</th>
                    <th style={TH}>Dept</th>
                    {MONTHS.map((m) => (
                      <th key={m} style={{ ...TH, textAlign: 'right' }}>
                        {monthLabel(`${year ?? '2026'}${m}`).split(' ')[0]}
                      </th>
                    ))}
                    <th style={{ ...TH, textAlign: 'right', color: FOREST }}>FY total</th>
                  </tr>
                </thead>
                <tbody>
                  {accountRows.map((a) => (
                    <tr key={a.code}>
                      <td style={TD}>
                        <div style={{ fontWeight: 600 }}>{a.code}</div>
                        <div style={{ color: INK_M, fontSize: 11 }}>{a.name}</div>
                      </td>
                      <td style={{ ...TD, color: FOREST, fontWeight: 600 }}>{a.dept}</td>
                      {MONTHS.map((m) => {
                        const v = a.months.get(m);
                        return (
                          <td key={m} style={{ ...TD_NUM, color: v ? 'inherit' : INK_M }}>
                            {v === undefined ? '' : (v === 0 ? '—' : money(v, currency))}
                          </td>
                        );
                      })}
                      <td style={{ ...TD_NUM, fontWeight: 700 }}>{money(a.total, currency)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td style={{ ...TD, borderTop: `1px solid ${HAIR}`, fontWeight: 700, color: FOREST }} colSpan={2}>
                      Revenue
                    </td>
                    {MONTHS.map((m) => (
                      <td key={m} style={{ ...TD_NUM, borderTop: `1px solid ${HAIR}`, fontWeight: 700 }}>
                        {monthTotal(m, 'revenue') ? money(monthTotal(m, 'revenue'), currency) : ''}
                      </td>
                    ))}
                    <td style={{ ...TD_NUM, borderTop: `1px solid ${HAIR}`, fontWeight: 700, color: FOREST }}>
                      {money(MONTHS.reduce((s, m) => s + monthTotal(m, 'revenue'), 0), currency)}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ ...TD, fontWeight: 700 }} colSpan={2}>Cost</td>
                    {MONTHS.map((m) => (
                      <td key={m} style={{ ...TD_NUM, fontWeight: 700 }}>
                        {monthTotal(m, 'cost') ? `(${money(monthTotal(m, 'cost'), currency)})` : ''}
                      </td>
                    ))}
                    <td style={{ ...TD_NUM, fontWeight: 700 }}>
                      ({money(MONTHS.reduce((s, m) => s + monthTotal(m, 'cost'), 0), currency)})
                    </td>
                  </tr>
                  <tr>
                    <td style={{ ...TD, borderTop: `1px solid ${HAIR}`, fontWeight: 700, color: FOREST }} colSpan={2}>
                      EBITDA
                    </td>
                    {MONTHS.map((m) => {
                      const e = monthTotal(m, 'revenue') - monthTotal(m, 'cost');
                      return (
                        <td key={m} style={{
                          ...TD_NUM, borderTop: `1px solid ${HAIR}`, fontWeight: 700,
                          color: e < 0 ? RUST : FOREST,
                        }}>{e ? money(e, currency) : ''}</td>
                      );
                    })}
                    <td style={{ ...TD_NUM, borderTop: `1px solid ${HAIR}`, fontWeight: 700, color: FOREST }}>
                      {money(
                        MONTHS.reduce((s, m) => s + monthTotal(m, 'revenue') - monthTotal(m, 'cost'), 0),
                        currency,
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          <div style={{ fontSize: 11, color: INK_M, marginTop: 8 }}>
            A blank cell means no line was planned for that month. A dash means a
            line exists and was deliberately set to zero.
          </div>
        </Container>
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <Container
          title="Add or revise a plan line"
          subtitle="Saving supersedes the previous figure for that account and month — the old version is kept, never overwritten."
          density="compact"
        >
          {saved.state && (
            <div style={{
              padding: '8px 12px', marginBottom: 10, borderRadius: 6, fontSize: 12,
              border: `1px solid ${saved.state === 'ok' ? '#B7D3BD' : '#E6C9BF'}`,
              borderLeft: `3px solid ${saved.state === 'ok' ? '#1F5C2C' : RUST}`,
              background: saved.state === 'ok' ? '#F2F8F3' : '#FFFAF7',
              color: saved.state === 'ok' ? '#1F5C2C' : RUST,
            }}>
              <strong>{saved.state === 'ok' ? 'Saved.' : 'Not saved.'}</strong>
              {saved.msg ? ` ${saved.msg}` : ''}
            </div>
          )}
          <form action={saveAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label style={{ fontSize: 11, color: INK_M, display: 'flex', flexDirection: 'column', gap: 3 }}>
              Scenario
              <select name="scenario" defaultValue="budget" style={input}>
                <option value="budget">Budget</option>
                <option value="forecast">Forecast</option>
              </select>
            </label>
            <label style={{ fontSize: 11, color: INK_M, display: 'flex', flexDirection: 'column', gap: 3 }}>
              Account
              <select name="account_code" style={{ ...input, minWidth: 260 }} required>
                <option value="">Choose an account…</option>
                {accounts.map((a) => <option key={a.code} value={a.code}>{a.label}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 11, color: INK_M, display: 'flex', flexDirection: 'column', gap: 3 }}>
              Month (YYYYMM)
              <input name="period_yyyymm" placeholder="202701" pattern="[0-9]{6}"
                     defaultValue={year ? `${year}01` : ''} style={{ ...input, width: 110 }} required />
            </label>
            <label style={{ fontSize: 11, color: INK_M, display: 'flex', flexDirection: 'column', gap: 3 }}>
              Amount ({currency})
              <input name="amount_eur" type="number" step="0.01" style={{ ...input, width: 130 }} required />
            </label>
            <label style={{ fontSize: 11, color: INK_M, display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 180 }}>
              Note (optional)
              <input name="notes" style={input} placeholder="why this figure" />
            </label>
            <button type="submit" style={{
              border: `1px solid ${FOREST}`, background: FOREST, color: '#fff',
              padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'inherit', borderRadius: 4,
            }}>Save line</button>
          </form>
          <div style={{ fontSize: 11, color: INK_M, marginTop: 10 }}>
            To remove a figure, save the same account and month as 0 — that records a
            deliberate zero rather than deleting the history.
          </div>
        </Container>
      </div>
    </>
  );
}
