// app/guest/directory/_components/DirectoryShell.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { CountryFacets } from "./CountryFacets";
import { GuestTable } from "./GuestTable";
import { ProfileDrawer } from "./ProfileDrawer";

type Headline = {
  total: number;
  repeat_guests: number;
  upcoming_total: number;
  next_7: number;
  next_30: number;
  next_90: number;
  contactable: number;
};

type Facet = {
  country: string;
  guest_count: number;
  total_revenue: number;
  total_stays: number;
  repeat_guests: number;
  contactable_email: number;
  contactable_phone: number;
  arriving_30d: number;
};

export type ArrivalWindow = "any" | "next_7" | "next_30" | "next_90";

const SORTS = [
  { key: "lifetime_revenue.desc.nullslast", label: "Top revenue" },
  { key: "stays_count.desc", label: "Most stays" },
  { key: "last_stay_date.desc.nullslast", label: "Most recent stay" },
  { key: "upcoming_stay_date.asc.nullslast", label: "Soonest arrival" },
  { key: "marketing_readiness_score.desc", label: "Marketing-ready first" },
] as const;

const ARRIVAL_OPTS: { key: ArrivalWindow; label: string }[] = [
  { key: "any", label: "Any" },
  { key: "next_7", label: "Next 7d" },
  { key: "next_30", label: "Next 30d" },
  { key: "next_90", label: "Next 90d" },
];

export function DirectoryShell({
  facets,
  headline,
}: {
  facets: Facet[];
  headline: Headline;
}) {
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState<string | null>(null);
  const [sort, setSort] = useState<string>(SORTS[0].key);
  const [arrival, setArrival] = useState<ArrivalWindow>("any");
  const [repeatOnly, setRepeatOnly] = useState(false);
  const [contactableOnly, setContactableOnly] = useState(false);

  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);

  const handleClose = useCallback(() => setSelectedGuestId(null), []);

  // ESC closes drawer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && handleClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleClose]);

  const clearAll = () => {
    setQuery("");
    setCountry(null);
    setArrival("any");
    setRepeatOnly(false);
    setContactableOnly(false);
  };

  const filtersActive =
    !!query ||
    !!country ||
    arrival !== "any" ||
    repeatOnly ||
    contactableOnly;

  return (
    <div className="space-y-8 px-8 py-6">
      {/* Header */}
      <header className="flex items-end justify-between border-b border-stone-300/30 pb-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-stone-500">
            Pillar 05 · Guest
          </p>
          <h1 className="mt-2 font-serif text-3xl tracking-tight text-stone-900">
            Guest <em className="font-serif italic">directory</em>
          </h1>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-stone-500">
            {headline.total.toLocaleString()} profiles · live · cloudbeds
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">
            Source
          </p>
          <p className="font-mono text-xs text-stone-700">
            guest.mv_guest_profile · refreshed nightly 03:15 UTC
          </p>
        </div>
      </header>

      {/* KPI strip — 5 cards, arrival breakdown is now native */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Kpi label="Total" value={headline.total.toLocaleString()} sub="all profiles" />
        <Kpi
          label="Repeat"
          value={headline.repeat_guests.toLocaleString()}
          sub={`${pct(headline.repeat_guests, headline.total)}% of base`}
        />
        <KpiClickable
          label="Next 7 days"
          value={headline.next_7.toLocaleString()}
          sub="arriving"
          active={arrival === "next_7"}
          onClick={() => setArrival(arrival === "next_7" ? "any" : "next_7")}
          tone="emerald"
        />
        <KpiClickable
          label="Next 30 days"
          value={headline.next_30.toLocaleString()}
          sub="arriving (cum.)"
          active={arrival === "next_30"}
          onClick={() => setArrival(arrival === "next_30" ? "any" : "next_30")}
          tone="emerald"
        />
        <Kpi
          label="Contactable"
          value={headline.contactable.toLocaleString()}
          sub={
            headline.contactable === 0
              ? "0 emails — getGuest sync pending"
              : `${pct(headline.contactable, headline.total)}% of base`
          }
          warn={headline.contactable === 0}
        />
      </section>

      {/* Body */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-6">
          <CountryFacets
            facets={facets}
            selected={country}
            onSelect={(c) => setCountry((cur) => (cur === c ? null : c))}
          />
        </aside>

        <main className="space-y-4">
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3 rounded-sm border border-stone-300 bg-white px-4 py-3">
            <input
              type="search"
              placeholder="Search name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-72 rounded-sm border border-stone-300 px-3 py-1.5 text-sm focus:border-stone-700 focus:outline-none"
            />

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="rounded-sm border border-stone-300 bg-white px-3 py-1.5 text-sm"
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>

            {/* Arrival-window segmented control */}
            <div className="flex items-center gap-1 rounded-sm border border-stone-300 bg-white p-0.5">
              {ARRIVAL_OPTS.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setArrival(o.key)}
                  className={`rounded-sm px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition ${
                    arrival === o.key
                      ? "bg-stone-900 text-white"
                      : "text-stone-600 hover:bg-stone-50"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>

            <Toggle
              on={repeatOnly}
              onChange={() => setRepeatOnly((v) => !v)}
              label="Repeat"
            />
            <Toggle
              on={contactableOnly}
              onChange={() => setContactableOnly((v) => !v)}
              label="Contactable"
            />

            {country && (
              <span className="rounded-sm bg-emerald-900/10 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-emerald-900">
                {country}
                <button
                  onClick={() => setCountry(null)}
                  className="ml-2 hover:underline"
                >
                  ✕
                </button>
              </span>
            )}

            {filtersActive && (
              <button
                onClick={clearAll}
                className="ml-auto font-mono text-[10px] uppercase tracking-wider text-stone-500 hover:text-stone-900"
              >
                Clear all
              </button>
            )}
          </div>

          <GuestTable
            query={query}
            country={country}
            sort={sort}
            arrival={arrival}
            repeatOnly={repeatOnly}
            contactableOnly={contactableOnly}
            onSelect={setSelectedGuestId}
            selectedId={selectedGuestId}
          />
        </main>
      </div>

      <ProfileDrawer guestId={selectedGuestId} onClose={handleClose} />
    </div>
  );
}

const pct = (a: number, b: number) =>
  ((a / Math.max(1, b)) * 100).toFixed(1);

function Kpi({
  label,
  value,
  sub,
  warn,
}: {
  label: string;
  value: string;
  sub?: string;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-sm border bg-white p-4 ${
        warn ? "border-amber-300" : "border-stone-300"
      }`}
    >
      <p className="text-[10px] uppercase tracking-[0.16em] text-stone-500">
        {label}
      </p>
      <p className="mt-2 font-serif text-2xl text-stone-900 tabular-nums">{value}</p>
      {sub && (
        <p
          className={`mt-1 text-xs ${warn ? "text-amber-800" : "text-stone-500"}`}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

function KpiClickable({
  label,
  value,
  sub,
  active,
  onClick,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  active: boolean;
  onClick: () => void;
  tone?: "emerald";
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-sm border bg-white p-4 text-left transition ${
        active
          ? tone === "emerald"
            ? "border-emerald-700 ring-1 ring-emerald-700/30"
            : "border-stone-900 ring-1 ring-stone-900/30"
          : "border-stone-300 hover:border-stone-400"
      }`}
    >
      <p className="text-[10px] uppercase tracking-[0.16em] text-stone-500">
        {label}
      </p>
      <p className="mt-2 font-serif text-2xl text-stone-900 tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-stone-500">{sub}</p>}
    </button>
  );
}

function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`rounded-sm border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition ${
        on
          ? "border-stone-900 bg-stone-900 text-white"
          : "border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
      }`}
    >
      {label}
    </button>
  );
}
