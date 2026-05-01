// app/operations/staff/_components/AttendanceCalendar.tsx
"use client";

import type { AttendanceRow } from "../[staffId]/page";

const CODE_COLOR: Record<string, string> = {
  D: "bg-emerald-600",
  X: "bg-stone-300",
  AL: "bg-sky-500",
  PH: "bg-amber-500",
};

const CODE_LABEL: Record<string, string> = {
  D: "Worked",
  X: "Day off",
  AL: "Annual leave",
  PH: "Public holiday",
};

export function AttendanceCalendar({ rows }: { rows: AttendanceRow[] }) {
  if (!rows.length) {
    return (
      <p className="py-8 text-center text-sm text-stone-500">
        No attendance recorded.
      </p>
    );
  }

  // Aggregate counts
  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.code] = (acc[r.code] || 0) + 1;
    return acc;
  }, {});
  const otHours = rows.reduce(
    (s, r) =>
      s + Number(r.overtime_15x_h ?? 0) + Number(r.overtime_2x_h ?? 0),
    0
  );

  // Order ascending for grid render
  const sorted = [...rows].sort((a, b) =>
    a.attendance_date.localeCompare(b.attendance_date)
  );

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-4 text-xs">
        {Object.entries(CODE_LABEL).map(([k, label]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span
              className={`h-3 w-3 rounded-sm ${CODE_COLOR[k] ?? "bg-stone-200"}`}
            />
            <span className="text-stone-700">{label}</span>
            <span className="font-mono text-stone-500">
              {counts[k] ?? 0}
            </span>
          </span>
        ))}
        {otHours > 0 && (
          <span className="ml-auto font-mono text-stone-700">
            OT total: {otHours.toFixed(1)} h
          </span>
        )}
      </div>

      {/* Grid: each cell = 1 day */}
      <div className="grid grid-cols-15 gap-1 md:grid-cols-30">
        {sorted.map((r) => (
          <div
            key={r.attendance_date}
            title={`${r.attendance_date} · ${CODE_LABEL[r.code] ?? r.code}${
              r.notes ? " · " + r.notes : ""
            }`}
            className={`aspect-square rounded-[2px] ${
              CODE_COLOR[r.code] ?? "bg-stone-200"
            }`}
          />
        ))}
      </div>

      <p className="text-[10px] uppercase tracking-wider text-stone-500">
        Hover a square for the date and code.
      </p>
    </div>
  );
}
