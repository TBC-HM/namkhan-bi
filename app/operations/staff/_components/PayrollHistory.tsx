// app/operations/staff/_components/PayrollHistory.tsx
'use client';

import type { PayrollRow } from './staff-detail-types';
import { fmtMoney } from '@/lib/format';

export function PayrollHistory({ rows }: { rows: PayrollRow[] }) {
  if (!rows?.length) {
    return (
      <p className="py-8 text-center text-sm text-stone-500">
        No payroll history (last 12 months).
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-[0.16em] text-stone-500">
            <th className="py-2 pr-3">Period</th>
            <th className="py-2 pr-3 text-right">Days W/O/AL/PH</th>
            <th className="py-2 pr-3 text-right">Base LAK</th>
            <th className="py-2 pr-3 text-right">OT LAK</th>
            <th className="py-2 pr-3 text-right">Allow. LAK</th>
            <th className="py-2 pr-3 text-right">Deduct. LAK</th>
            <th className="py-2 pr-3 text-right">Tax LAK</th>
            <th className="py-2 pl-3 text-right">Total USD</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const ot =
              Number(r.overtime_15x_lak || 0) + Number(r.overtime_2x_lak || 0);
            const allow =
              Number(r.service_charge_lak || 0) +
              Number(r.gasoline_allow_lak || 0) +
              Number(r.internet_allow_lak || 0) +
              Number(r.other_allow_lak || 0);
            const deduct =
              Number(r.adjustment_lak || 0) +
              Number(r.deduction_lak || 0) +
              Number(r.sso_5_5_lak || 0);
            return (
              <tr
                key={r.period_month}
                className="border-t border-stone-100 hover:bg-stone-50"
              >
                <td className="py-2 pr-3 font-mono text-xs text-stone-700">
                  {r.period_month?.slice(0, 7)}
                </td>
                <td className="py-2 pr-3 text-right font-mono text-xs text-stone-600 tabular-nums">
                  {r.days_worked}/{r.days_off}/{r.days_annual_leave}/
                  {r.days_public_holiday}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {fmtMoney(r.base_salary_lak, 'LAK')}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {ot > 0 ? (
                    fmtMoney(ot, 'LAK')
                  ) : (
                    <span className="text-stone-300">—</span>
                  )}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {allow > 0 ? (
                    fmtMoney(allow, 'LAK')
                  ) : (
                    <span className="text-stone-300">—</span>
                  )}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-rose-700">
                  {deduct > 0 ? (
                    fmtMoney(deduct, 'LAK')
                  ) : (
                    <span className="text-stone-300">—</span>
                  )}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-rose-700">
                  {Number(r.tax_lak) > 0 ? (
                    fmtMoney(r.tax_lak, 'LAK')
                  ) : (
                    <span className="text-stone-300">—</span>
                  )}
                </td>
                <td className="py-2 pl-3 text-right font-medium tabular-nums text-stone-900">
                  {fmtMoney(Number(r.grand_total_usd ?? 0), 'USD')}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
