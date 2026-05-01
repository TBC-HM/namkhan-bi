// app/operations/staff/_components/AnomalyCard.tsx
"use client";

import { useState } from "react";
import Link from "next/link";

type Person = { staff_id: string; full_name: string; dept_name: string };

export function AnomalyCard({
  title,
  subtitle,
  count,
  people,
}: {
  title: string;
  subtitle: string;
  count: number;
  people: Person[];
}) {
  const [open, setOpen] = useState(false);
  const muted = count === 0;

  return (
    <div
      className={`rounded-sm border p-5 transition ${
        muted
          ? "border-stone-200 bg-stone-50/40"
          : "border-stone-300 bg-white shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-serif text-sm uppercase tracking-[0.14em] text-stone-800">
          {title}
        </h3>
        <span
          className={`font-serif text-2xl ${
            muted ? "text-stone-400" : "text-amber-700"
          }`}
        >
          {count}
        </span>
      </div>
      <p className="mt-2 text-xs text-stone-500">{subtitle}</p>

      {count > 0 && (
        <button
          onClick={() => setOpen((v) => !v)}
          className="mt-4 text-[11px] uppercase tracking-[0.14em] text-stone-700 hover:text-stone-900"
        >
          {open ? "▲ hide" : `▼ show all ${count} people`}
        </button>
      )}

      {open && (
        <ul className="mt-3 space-y-1 border-t border-stone-200 pt-3 text-xs">
          {people.slice(0, 200).map((p) => (
            <li key={p.staff_id} className="flex justify-between gap-3">
              <Link
                href={`/operations/staff/${encodeURIComponent(p.staff_id)}`}
                className="truncate font-medium uppercase tracking-wider text-stone-800 hover:underline"
              >
                {p.full_name}
              </Link>
              <span className="shrink-0 text-stone-500">· {p.dept_name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
