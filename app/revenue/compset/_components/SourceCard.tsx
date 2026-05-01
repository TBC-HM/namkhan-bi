// app/revenue/compset/_components/SourceCard.tsx
"use client";

import Link from "next/link";

type Props = {
  setId: string;
  label: string;
  setType: "pms" | "bdc_rate_insights" | "manual" | "ai_proposed" | "external_feed";
  properties: number;
  lastShop: string | null;
  freshness: "fresh" | "aging" | "stale" | "no_data";
  isPrimary: boolean;
  note: string;
};

const FRESH_META = {
  fresh:   { tone: "bg-emerald-100 text-emerald-900", label: "Fresh ≤ 2d" },
  aging:   { tone: "bg-amber-100 text-amber-900",     label: "Aging" },
  stale:   { tone: "bg-rose-100 text-rose-900",       label: "Stale" },
  no_data: { tone: "bg-stone-100 text-stone-500",     label: "No data" },
} as const;

export function SourceCard({
  setId,
  label,
  setType,
  properties,
  lastShop,
  freshness,
  isPrimary,
  note,
}: Props) {
  const f = FRESH_META[freshness];
  const isEmpty = properties === 0;

  // Manual set is implemented but waiting for owner input — escalate the empty
  // state to action-required tone instead of the passive "No data" gray.
  const manualNeedsAction =
    setType === "manual" && properties > 0 && freshness === "no_data";
  const badge = manualNeedsAction
    ? { tone: "bg-amber-100 text-amber-900", label: "Action needed" }
    : f;

  return (
    <div
      className={`rounded-sm border p-5 transition ${
        isPrimary
          ? "border-emerald-700 bg-white shadow-sm"
          : isEmpty
          ? "border-stone-200 bg-stone-50/40"
          : "border-stone-300 bg-white"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              isPrimary ? "bg-emerald-700" : isEmpty ? "bg-stone-300" : "bg-stone-500"
            }`}
          />
          <h3 className="font-serif text-sm uppercase tracking-[0.14em] text-stone-800">
            {label}
          </h3>
        </div>
        <span
          className={`rounded-sm px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${badge.tone}`}
        >
          {badge.label}
        </span>
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="font-serif text-3xl text-stone-900 tabular-nums">
          {properties}
        </span>
        <span className="text-xs text-stone-500">
          {properties === 1 ? "property" : "properties"}
        </span>
      </div>

      {lastShop ? (
        <p className="mt-1 text-xs text-stone-500">
          Last shop: <span className="font-mono">{lastShop}</span>
        </p>
      ) : manualNeedsAction ? (
        <p className="mt-1 text-xs font-medium text-amber-900">
          Log this week&apos;s rates →
        </p>
      ) : (
        <p className="mt-1 text-xs text-stone-400">No rates observed yet</p>
      )}

      <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-stone-500">
        {note}
      </p>

      <div className="mt-4 flex items-center gap-3">
        {setType === "manual" ? (
          <Link
            href="/revenue/compset/manual"
            className="text-[11px] uppercase tracking-[0.14em] text-emerald-900 hover:underline"
          >
            Manage →
          </Link>
        ) : setType === "bdc_rate_insights" ? (
          <span className="text-[11px] uppercase tracking-[0.14em] text-stone-400">
            Awaiting BDC import
          </span>
        ) : setType === "ai_proposed" ? (
          <span className="text-[11px] uppercase tracking-[0.14em] text-stone-400">
            Phase 4 — Vertex
          </span>
        ) : (
          <span className="text-[11px] uppercase tracking-[0.14em] text-stone-400">
            Static config
          </span>
        )}
        {isPrimary && (
          <span className="rounded-sm bg-emerald-900/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald-900">
            Primary
          </span>
        )}
      </div>
    </div>
  );
}
