// app/guest/directory/_components/GuestTable.tsx
"use client";

import { useEffect, useState } from "react";
import { fmtUSD } from "@/lib/format";
import { searchGuests } from "../_actions/searchGuests";
import type { ArrivalWindow } from "./DirectoryShell";

type Row = {
  guest_id: string;
  full_name: string;
  country: string | null;
  email: string | null;
  phone: string | null;
  stays_count: number;
  bookings_count: number;
  cancellations_count: number;
  lifetime_revenue: number | null;
  last_stay_date: string | null;
  upcoming_stay_date: string | null;
  days_until_arrival: number | null;
  arrival_bucket: string;
  top_source: string | null;
  top_segment: string | null;
  is_repeat: boolean;
  marketing_readiness_score: number;
};

const PAGE_SIZE = 50;

export function GuestTable({
  query,
  country,
  sort,
  arrival,
  repeatOnly,
  contactableOnly,
  onSelect,
  selectedId,
}: {
  query: string;
  country: string | null;
  sort: string;
  arrival: ArrivalWindow;
  repeatOnly: boolean;
  contactableOnly: boolean;
  onSelect: (id: string) => void;
  selectedId: string | null;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);

  // Reset page when filters change
  useEffect(
    () => setPage(0),
    [query, country, sort, arrival, repeatOnly, contactableOnly]
  );

  // Debounce query
  const [debounced, setDebounced] = useState(query);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    searchGuests({
      q: debounced,
      country,
      sort,
      arrival,
      repeatOnly,
      contactableOnly,
      page,
      pageSize: PAGE_SIZE,
    })
      .then((res) => {
        if (cancelled) return;
        setRows(res.rows);
        setTotal(res.total);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [debounced, country, sort, arrival, repeatOnly, contactableOnly, page]);

  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  return (
    <div className="rounded-sm border border-stone-300 bg-white">
      <div className="flex items-center justify-between border-b border-stone-200 px-4 py-2 text-xs text-stone-500">
        <span>
          {loading ? "Loading…" : `${total.toLocaleString()} matching profiles`}
        </span>
        <span>
          Page {page + 1} of {lastPage + 1}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.16em] text-stone-500">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Country</th>
              <th className="px-4 py-3 text-right">Stays</th>
              <th className="px-4 py-3 text-right">LTV</th>
              <th className="px-4 py-3">Last stay</th>
              <th className="px-4 py-3">Arrival</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Mkt</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.guest_id}
                onClick={() => onSelect(r.guest_id)}
                className={`cursor-pointer border-t border-stone-100 transition hover:bg-stone-50 ${
                  selectedId === r.guest_id ? "bg-emerald-900/5" : ""
                }`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-stone-900">
                      {r.full_name}
                    </span>
                    {r.is_repeat && (
                      <span className="rounded-sm bg-emerald-100 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-emerald-900">
                        repeat
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-stone-600">
                  {r.country ?? "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-stone-700">
                  {r.stays_count}
                </td>
                <td className="px-4 py-3 text-right font-medium tabular-nums text-stone-900">
                  {r.lifetime_revenue ? (
                    fmtUSD(Number(r.lifetime_revenue))
                  ) : (
                    <span className="text-stone-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-stone-600">
                  {r.last_stay_date ?? <span className="text-stone-300">—</span>}
                </td>
                <td className="px-4 py-3">
                  <ArrivalCell row={r} />
                </td>
                <td className="px-4 py-3 text-xs text-stone-600">
                  {r.top_source ?? <span className="text-stone-300">—</span>}
                </td>
                <td className="px-4 py-3">
                  <ScoreBar score={r.marketing_readiness_score} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 && (
          <div className="p-12 text-center text-sm text-stone-500">
            No guests match these filters.
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-end gap-2 border-t border-stone-200 px-4 py-2 text-xs">
        <button
          onClick={() => setPage(0)}
          disabled={page === 0}
          className="rounded-sm border border-stone-300 px-2 py-1 disabled:opacity-30"
        >
          ⏮
        </button>
        <button
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          className="rounded-sm border border-stone-300 px-2 py-1 disabled:opacity-30"
        >
          ◀
        </button>
        <button
          onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
          disabled={page >= lastPage}
          className="rounded-sm border border-stone-300 px-2 py-1 disabled:opacity-30"
        >
          ▶
        </button>
        <button
          onClick={() => setPage(lastPage)}
          disabled={page >= lastPage}
          className="rounded-sm border border-stone-300 px-2 py-1 disabled:opacity-30"
        >
          ⏭
        </button>
      </div>
    </div>
  );
}

function ArrivalCell({ row }: { row: Row }) {
  if (!row.upcoming_stay_date) {
    return <span className="text-stone-300">—</span>;
  }
  const days = row.days_until_arrival ?? 0;
  const tone =
    row.arrival_bucket === "next_7"
      ? "bg-emerald-100 text-emerald-900"
      : row.arrival_bucket === "next_30"
      ? "bg-sky-100 text-sky-900"
      : row.arrival_bucket === "next_90"
      ? "bg-amber-100 text-amber-900"
      : "bg-stone-100 text-stone-700";
  return (
    <div className="flex items-center gap-2">
      <span
        className={`rounded-sm px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${tone}`}
      >
        {days === 0 ? "today" : `+${days}d`}
      </span>
      <span className="font-mono text-xs text-stone-600">
        {row.upcoming_stay_date}
      </span>
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  const tone =
    score >= 70 ? "bg-emerald-600" : score >= 40 ? "bg-amber-500" : "bg-stone-300";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-12 rounded-full bg-stone-100">
        <div
          className={`h-full rounded-full ${tone}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="font-mono text-[10px] text-stone-500 tabular-nums">
        {score}
      </span>
    </div>
  );
}
