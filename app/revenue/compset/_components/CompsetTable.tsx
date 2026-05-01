// app/revenue/compset/_components/CompsetTable.tsx
'use client';

import { fmtMoney } from '@/lib/format';

type Row = {
  comp_id: string;
  property_name: string;
  star_rating: number | null;
  rooms: number | null;
  latest_stay_date: string | null;
  latest_shop_date: string | null;
  latest_rate_usd: number | null;
  avg_rate_usd_30d: number | null;
  observations_30d: number | null;
};

export function CompsetTable({
  rows,
  showRates,
}: {
  rows: Row[];
  showRates: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-sm border border-stone-200 bg-stone-50/40 p-8 text-center text-sm text-stone-500">
        No properties in this set.
      </div>
    );
  }

  // Compute median 30d avg as the comp-set midpoint to flag above/below
  const validAvgs = rows
    .map((r) => Number(r.avg_rate_usd_30d ?? 0))
    .filter((n) => n > 0)
    .sort((a, b) => a - b);
  const median =
    validAvgs.length === 0
      ? 0
      : validAvgs[Math.floor(validAvgs.length / 2)];

  return (
    <div className="overflow-x-auto rounded-sm border border-stone-300 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-[0.16em] text-stone-500">
            <th className="px-4 py-3">Property</th>
            <th className="px-4 py-3">Stars</th>
            <th className="px-4 py-3">Rooms</th>
            {showRates && (
              <>
                <th className="px-4 py-3 text-right">Latest USD</th>
                <th className="px-4 py-3 text-right">30d Avg USD</th>
                <th className="px-4 py-3 text-right">Obs.</th>
              </>
            )}
            <th className="px-4 py-3">Last shop</th>
            <th className="px-4 py-3">vs. Median</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const avg = Number(r.avg_rate_usd_30d ?? 0);
            const delta = median > 0 && avg > 0 ? avg - median : null;
            return (
              <tr
                key={r.comp_id}
                className="border-t border-stone-100 hover:bg-stone-50"
              >
                <td className="px-4 py-3 font-medium text-stone-900">
                  {r.property_name}
                </td>
                <td className="px-4 py-3 text-stone-700 tabular-nums">
                  {r.star_rating ?? '—'}
                </td>
                <td className="px-4 py-3 text-stone-700 tabular-nums">
                  {r.rooms ?? '—'}
                </td>
                {showRates && (
                  <>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {r.latest_rate_usd ? (
                        fmtMoney(Number(r.latest_rate_usd), 'USD')
                      ) : (
                        <span className="text-stone-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {avg > 0 ? (
                        fmtMoney(avg, 'USD')
                      ) : (
                        <span className="text-stone-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-stone-500 tabular-nums">
                      {r.observations_30d ?? 0}
                    </td>
                  </>
                )}
                <td className="px-4 py-3 font-mono text-xs text-stone-600">
                  {r.latest_shop_date ?? (
                    <span className="text-stone-300">never</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {delta == null ? (
                    <span className="text-stone-300">—</span>
                  ) : (
                    <span
                      className={`rounded-sm px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                        Math.abs(delta) < 5
                          ? 'bg-stone-100 text-stone-700'
                          : delta > 0
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-rose-100 text-rose-900'
                      }`}
                    >
                      {delta > 0 ? '+' : ''}
                      {fmtMoney(delta, 'USD')}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
