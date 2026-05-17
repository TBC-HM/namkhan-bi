"use client";

import { useState } from "react";
import Link from "next/link";

type Person = { staff_id: string; full_name: string; dept_name: string; meta?: string | null };
type Stat = { label: string; value: string | number; accent?: 'ok' | 'amber' | 'red' | 'muted' };

const ACCENT_COLOR: Record<NonNullable<Stat['accent']>, string> = {
  ok:    'text-emerald-700',
  amber: 'text-amber-700',
  red:   'text-rose-700',
  muted: 'text-stone-500',
};

export function InsightCard({
  title,
  subtitle,
  stats,
  people,
  scorePct,
}: {
  title: string;
  subtitle: string;
  stats: Stat[];
  people: Person[];
  scorePct?: number | null;
}) {
  const [open, setOpen] = useState(false);
  const hasPeople = people.length > 0;
  const flagged = stats.some((s) => s.accent === 'amber' || s.accent === 'red');

  return (
    <div
      className={`rounded-sm border p-5 transition ${
        flagged || hasPeople
          ? "border-stone-300 bg-white shadow-sm"
          : "border-stone-200 bg-stone-50/40"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-serif text-sm uppercase tracking-[0.14em] text-stone-800">
          {title}
        </h3>
        {typeof scorePct === 'number' && (
          <span
            className={`font-serif text-2xl ${
              scorePct >= 90 ? 'text-emerald-700' :
              scorePct >= 60 ? 'text-amber-700' :
              'text-rose-700'
            }`}
          >
            {scorePct}%
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-stone-500">{subtitle}</p>

      <dl className="mt-3 space-y-1.5">
        {stats.map((s) => (
          <div key={s.label} className="flex items-baseline justify-between gap-3 border-b border-stone-100 pb-1.5 last:border-b-0">
            <dt className="text-[11px] uppercase tracking-wider text-stone-500">{s.label}</dt>
            <dd className={`font-serif text-base tabular-nums ${ACCENT_COLOR[s.accent ?? 'muted']}`}>
              {s.value}
            </dd>
          </div>
        ))}
      </dl>

      {hasPeople && (
        <button
          onClick={() => setOpen((v) => !v)}
          className="mt-4 text-[11px] uppercase tracking-[0.14em] text-stone-700 hover:text-stone-900"
        >
          {open ? "▲ hide" : `▼ show ${people.length} ${people.length === 1 ? 'person' : 'people'}`}
        </button>
      )}

      {open && hasPeople && (
        <ul className="mt-3 space-y-1 border-t border-stone-200 pt-3 text-xs">
          {people.slice(0, 200).map((p) => (
            <li key={p.staff_id} className="flex justify-between gap-3">
              <Link
                href={`/operations/staff/${encodeURIComponent(p.staff_id)}`}
                className="truncate font-medium uppercase tracking-wider text-stone-800 hover:underline"
              >
                {p.full_name}
              </Link>
              <span className="shrink-0 text-stone-500">
                · {p.dept_name}
                {p.meta ? ` · ${p.meta}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
