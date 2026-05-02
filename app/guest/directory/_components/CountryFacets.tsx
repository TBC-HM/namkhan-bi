// app/guest/directory/_components/CountryFacets.tsx
"use client";

import { useMemo } from "react";
import { fmtUSD } from "@/lib/format";

type Facet = {
  country: string;
  guest_count: number;
  total_revenue: number;
  total_stays: number;
  repeat_guests: number;
  contactable_email: number;
  arriving_30d: number;
};

export function CountryFacets({
  facets,
  selected,
  onSelect,
}: {
  facets: Facet[];
  selected: string | null;
  onSelect: (country: string) => void;
}) {
  const dn = useMemo(() => {
    try {
      return new Intl.DisplayNames(["en"], { type: "region" });
    } catch {
      return null;
    }
  }, []);

  const maxRev = Math.max(
    ...facets.map((f) => Number(f.total_revenue) || 0),
    1
  );

  return (
    <div className="rounded-sm border border-stone-300 bg-white">
      <header className="border-b border-stone-200 px-4 py-3">
        <h2 className="font-serif text-sm uppercase tracking-[0.14em] text-stone-800">
          By country
        </h2>
        <p className="mt-0.5 text-[11px] text-stone-500">Sorted by lifetime revenue</p>
      </header>
      <ul className="max-h-[600px] overflow-y-auto">
        {facets.map((f) => {
          const isSel = selected === f.country;
          const pct = (Number(f.total_revenue) / maxRev) * 100;
          let display = f.country;
          if (dn) {
            try {
              display = dn.of(f.country) ?? f.country;
            } catch {}
          }
          return (
            <li key={f.country}>
              <button
                onClick={() => onSelect(f.country)}
                className={`relative w-full px-4 py-2.5 text-left text-sm transition ${
                  isSel ? "bg-emerald-900/10" : "hover:bg-stone-50"
                }`}
              >
                <div
                  className="absolute inset-y-0 left-0 bg-stone-100/60"
                  style={{ width: `${pct}%` }}
                />
                <div className="relative flex items-center justify-between">
                  <div>
                    <p className="font-medium text-stone-900">
                      <span className="font-mono text-xs text-stone-500">
                        {f.country}
                      </span>
                      <span className="ml-1.5">{display}</span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-stone-500">
                      {f.guest_count} guests · {f.repeat_guests} repeat
                      {f.arriving_30d > 0 && (
                        <span className="ml-1 text-emerald-800">
                          · {f.arriving_30d} arriving
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="font-mono text-xs tabular-nums text-stone-700">
                    {fmtUSD(Number(f.total_revenue))}
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
