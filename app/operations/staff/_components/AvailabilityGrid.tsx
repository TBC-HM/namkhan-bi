// app/operations/staff/_components/AvailabilityGrid.tsx
"use client";

import type { AvailabilityRow } from "./staff-detail-types";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function AvailabilityGrid({ rows }: { rows: AvailabilityRow[] }) {
  if (!rows?.length) {
    return (
      <p className="py-6 text-center text-sm text-stone-500">
        No weekly pattern recorded.
      </p>
    );
  }
  // weekday is ISO 1=Mon..7=Sun; tolerate 0=Sun if encountered
  const byDay = new Map<number, AvailabilityRow>();
  for (const r of rows) byDay.set(r.weekday, r);

  return (
    <ul className="divide-y divide-stone-100 text-sm">
      {WEEKDAYS.map((label, idx) => {
        const day = idx + 1; // 1..7
        const r = byDay.get(day);
        return (
          <li
            key={day}
            className="flex items-center justify-between py-2 first:pt-0 last:pb-0"
          >
            <span className="font-mono text-[11px] uppercase tracking-wider text-stone-500">
              {label}
            </span>
            {r ? (
              <span className="text-stone-800 tabular-nums">
                {r.start_time?.slice(0, 5)}–{r.end_time?.slice(0, 5)}
                {r.break_minutes ? (
                  <span className="ml-2 text-xs text-stone-500">
                    · {r.break_minutes} min break
                  </span>
                ) : null}
              </span>
            ) : (
              <span className="text-stone-300">off</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
