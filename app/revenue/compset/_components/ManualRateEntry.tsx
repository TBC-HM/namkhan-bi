// app/revenue/compset/_components/ManualRateEntry.tsx
"use client";

import { useState, useTransition } from "react";
import { saveRates } from "../_actions/saveRates";

type Peer = {
  comp_id: string;
  property_name: string;
  star_rating: number | null;
  rooms: number | null;
  bdc_url: string | null;
  notes: string | null;
};

type ExistingRate = {
  comp_id: string;
  stay_date: string;
  rate_usd: number;
  channel: string;
  shop_date: string;
};

export function ManualRateEntry({
  peers,
  dates,
  existing,
  setId,
}: {
  peers: Peer[];
  dates: string[];
  existing: ExistingRate[];
  setId: string;
}) {
  // Pre-fill grid from existing observations
  const initial: Record<string, Record<string, string>> = {};
  for (const p of peers) {
    initial[p.comp_id] = {};
    for (const d of dates) {
      const hit = existing.find(
        (e) => e.comp_id === p.comp_id && e.stay_date === d
      );
      initial[p.comp_id][d] = hit ? String(hit.rate_usd) : "";
    }
  }

  const [grid, setGrid] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const handleChange = (compId: string, date: string, value: string) => {
    setGrid((g) => ({
      ...g,
      [compId]: { ...g[compId], [date]: value },
    }));
  };

  const handleSave = () => {
    const payload: {
      comp_id: string;
      stay_date: string;
      rate_usd: number;
    }[] = [];
    for (const compId of Object.keys(grid)) {
      for (const date of Object.keys(grid[compId])) {
        const raw = grid[compId][date].trim();
        if (!raw) continue;
        const n = Number(raw);
        if (!Number.isFinite(n) || n <= 0) continue;
        payload.push({ comp_id: compId, stay_date: date, rate_usd: n });
      }
    }
    if (payload.length === 0) return;

    startTransition(async () => {
      await saveRates(payload);
      setSavedAt(new Date().toISOString());
    });
  };

  const fmtDay = (iso: string) => {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    });
  };

  return (
    <section className="space-y-4">
      <div className="overflow-x-auto rounded-sm border border-stone-300 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.16em] text-stone-500">
              <th className="px-4 py-3">Property</th>
              <th className="px-4 py-3">★</th>
              <th className="px-4 py-3">Rooms</th>
              {dates.map((d) => (
                <th key={d} className="px-2 py-3 text-right">
                  {fmtDay(d)}
                </th>
              ))}
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {peers.map((p) => (
              <tr key={p.comp_id} className="border-t border-stone-100">
                <td className="px-4 py-3 font-medium text-stone-900">
                  {p.property_name}
                  {p.notes ? (
                    <span className="ml-2 text-xs italic text-stone-400">
                      · {p.notes}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 tabular-nums text-stone-700">
                  {p.star_rating ?? "—"}
                </td>
                <td className="px-4 py-3 tabular-nums text-stone-700">
                  {p.rooms ?? "—"}
                </td>
                {dates.map((d) => (
                  <td key={d} className="px-2 py-2">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      placeholder="USD"
                      value={grid[p.comp_id]?.[d] ?? ""}
                      onChange={(e) =>
                        handleChange(p.comp_id, d, e.target.value)
                      }
                      className="w-20 rounded-sm border border-stone-300 px-2 py-1 text-right text-sm tabular-nums focus:border-stone-700 focus:outline-none"
                    />
                  </td>
                ))}
                <td className="px-4 py-3">
                  {p.bdc_url ? (
                    <a
                      href={p.bdc_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] uppercase tracking-[0.14em] text-stone-700 hover:underline"
                    >
                      BDC ↗
                    </a>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={pending}
          className="rounded-sm bg-stone-900 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-white transition hover:bg-stone-700 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save observations"}
        </button>
        {savedAt && (
          <span className="text-xs text-emerald-800">
            Saved at {new Date(savedAt).toLocaleTimeString()}
          </span>
        )}
        <p className="text-[11px] uppercase tracking-[0.16em] text-stone-500">
          Empty cells are skipped. Re-saving overwrites today&apos;s shop.
        </p>
      </div>
    </section>
  );
}
