// app/guest/directory/_components/ProfileDrawer.tsx
"use client";

import { useEffect, useState } from "react";
import { fmtUSD, EMPTY } from "@/lib/format";
import { fetchGuestProfile, type FallbackContact } from "../_actions/fetchGuestProfile";

type Profile = {
  guest_id: string;
  full_name: string;
  country: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  language: string | null;
  date_of_birth: string | null;
  gender: string | null;
  bookings_count: number;
  stays_count: number;
  cancellations_count: number;
  lifetime_revenue: number | null;
  avg_adr: number | null;
  total_nights: number | null;
  first_stay_date: string | null;
  last_stay_date: string | null;
  upcoming_stay_date: string | null;
  days_until_arrival: number | null;
  arrival_bucket: string;
  top_source: string | null;
  top_segment: string | null;
  is_repeat: boolean;
  marketing_readiness_score: number;
};

type Reservation = {
  reservation_id: string;
  status: string;
  source_name: string | null;
  market_segment: string | null;
  rate_plan: string | null;
  room_type_name: string | null;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  adults: number;
  children: number;
  total_amount: number | null;
  currency: string | null;
  is_cancelled: boolean;
  phase: "upcoming" | "in_house" | "past" | "cancelled";
};

type Tab = "info" | "bookings";

export function ProfileDrawer({
  guestId,
  onClose,
}: {
  guestId: string | null;
  onClose: () => void;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [fallbackContact, setFallbackContact] = useState<FallbackContact>({
    email: null,
    phone: null,
    source: null,
  });
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("info");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!guestId) {
      setProfile(null);
      setReservations([]);
      setFallbackContact({ email: null, phone: null, source: null });
      return;
    }
    let cancelled = false;
    setLoading(true);
    setTab("info"); // reset to info whenever a new guest opens
    fetchGuestProfile(guestId)
      .then((res) => {
        if (cancelled) return;
        setProfile(res.profile);
        setReservations(res.reservations);
        setFallbackContact(res.fallbackContact ?? { email: null, phone: null, source: null });
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [guestId]);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const open = guestId !== null;

  // Booking-tab counts (independent of matview filters — derived from raw list)
  const bookingsTotal = reservations.length;
  const upcomingCount = reservations.filter((r) => r.phase === "upcoming").length;
  const cancelledCount = reservations.filter((r) => r.phase === "cancelled").length;

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-stone-900/30 transition-opacity ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-[640px] flex-col bg-stone-50 shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-label="Guest profile"
      >
        <header className="flex items-center justify-between border-b border-stone-300 bg-white px-6 py-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-stone-500">
            Guest profile
          </p>
          <button
            onClick={onClose}
            className="rounded-sm px-2 py-1 text-stone-500 hover:bg-stone-100 hover:text-stone-900"
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        {loading && (
          <div className="flex flex-1 items-center justify-center text-sm text-stone-500">
            Loading…
          </div>
        )}

        {profile && !loading && (
          <div className="flex flex-1 flex-col overflow-hidden">
            <ProfileHero profile={profile} />

            {/* Action strip — Contactable · Repeat (PBS 2026-05-09 wiring) */}
            <ActionStrip
              profile={profile}
              fallbackContact={fallbackContact}
              onToggleRepeat={(next) => setProfile((p) => (p ? { ...p, is_repeat: next } : p))}
              onToast={setToast}
            />

            {/* Tab strip — Information · Bookings */}
            <nav
              role="tablist"
              aria-label="Guest profile sections"
              className="flex gap-0 border-b border-stone-300 bg-white px-6"
            >
              <TabButton
                label="Information"
                active={tab === "info"}
                onClick={() => setTab("info")}
              />
              <TabButton
                label={`Bookings · ${bookingsTotal}`}
                active={tab === "bookings"}
                onClick={() => setTab("bookings")}
                hint={
                  upcomingCount > 0
                    ? `${upcomingCount} upcoming`
                    : cancelledCount === bookingsTotal && bookingsTotal > 0
                    ? "all cancelled"
                    : undefined
                }
              />
            </nav>

            <div className="flex-1 overflow-y-auto">
              {tab === "info" ? (
                <>
                  <ContactBlock profile={profile} fallbackContact={fallbackContact} />
                  <StatsBlock profile={profile} />
                </>
              ) : (
                <ReservationTimeline reservations={reservations} />
              )}
            </div>
          </div>
        )}

        {/* Toast — surfaces button feedback ("No reachable contact on file" etc) */}
        {toast && (
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-sm bg-stone-900 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-white shadow-lg"
          >
            {toast}
          </div>
        )}
      </aside>
    </>
  );
}

// ============================================================================
// Action strip — Contactable · Repeat (PBS 2026-05-09 directory wiring)
// ============================================================================

function ActionStrip({
  profile,
  fallbackContact,
  onToggleRepeat,
  onToast,
}: {
  profile: Profile;
  fallbackContact: FallbackContact;
  onToggleRepeat: (next: boolean) => void;
  onToast: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  // Resolve a reachable contact channel.
  // Priority: profile.email → fallback.email → wa.me (phone w/ country code) → tel.
  // Anything matching "+<digits>" is treated as country-coded; we strip the +
  // for the wa.me URL per WhatsApp's spec.
  const resolveContact = (): {
    href: string;
    label: string;
    target?: string;
  } | null => {
    const email = profile.email || fallbackContact.email;
    if (email) {
      return { href: `mailto:${email}`, label: `Email ${email}` };
    }
    const phone = profile.phone || fallbackContact.phone;
    if (phone) {
      const trimmed = phone.replace(/\s+/g, "");
      if (/^\+\d{6,}/.test(trimmed)) {
        // E.164 — preferred. WhatsApp wa.me URL.
        const digits = trimmed.replace(/\D/g, "");
        return {
          href: `https://wa.me/${digits}`,
          label: `WhatsApp ${trimmed}`,
          target: "_blank",
        };
      }
      // Local format — fall back to tel:.
      return { href: `tel:${trimmed}`, label: `Call ${trimmed}` };
    }
    return null;
  };

  const handleContact = () => {
    const r = resolveContact();
    if (!r) {
      onToast("No reachable contact on file");
      return;
    }
    if (r.target === "_blank") {
      window.open(r.href, "_blank", "noopener,noreferrer");
    } else {
      window.location.href = r.href;
    }
  };

  const handleRepeat = async () => {
    if (busy) return;
    const next = !profile.is_repeat;
    setBusy(true);
    onToggleRepeat(next); // optimistic flip
    try {
      const res = await fetch(`/api/guest/${encodeURIComponent(profile.guest_id)}/repeat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ is_repeat: next }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        onToggleRepeat(!next); // revert
        onToast(json?.error ? `Repeat failed: ${json.error}` : "Repeat failed");
      } else {
        onToast(next ? "Marked as repeat" : "Repeat flag cleared");
      }
    } catch (e: any) {
      onToggleRepeat(!next);
      onToast(`Repeat failed: ${e?.message ?? "network error"}`);
    } finally {
      setBusy(false);
    }
  };

  const contact = resolveContact();
  const contactDisabled = !contact;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-stone-200 bg-white px-6 py-3">
      <button
        type="button"
        onClick={handleContact}
        title={contact?.label ?? "No email / phone on file — Cloudbeds returns anonymised contact"}
        className={`rounded-sm border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition ${
          contactDisabled
            ? "border-stone-200 bg-stone-50 text-stone-400 hover:bg-stone-100"
            : "border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800"
        }`}
      >
        Contactable
      </button>
      <button
        type="button"
        onClick={handleRepeat}
        disabled={busy}
        className={`rounded-sm border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition disabled:opacity-50 ${
          profile.is_repeat
            ? "border-amber-700 bg-amber-700 text-white hover:bg-amber-800"
            : "border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
        }`}
      >
        {profile.is_repeat ? "✓ Repeat" : "Mark as repeat"}
      </button>
      {fallbackContact.source === "reservation" && (
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-stone-500">
          fallback · reservation
        </span>
      )}
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
  hint,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`relative -mb-px border-b-2 px-3 py-3 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors ${
        active
          ? "border-stone-900 text-stone-900"
          : "border-transparent text-stone-500 hover:text-stone-800"
      }`}
    >
      {label}
      {hint && (
        <span className="ml-2 rounded-sm bg-stone-100 px-1.5 py-0.5 text-[9px] text-stone-600">
          {hint}
        </span>
      )}
    </button>
  );
}

function ProfileHero({ profile }: { profile: Profile }) {
  return (
    <section className="border-b border-stone-200 bg-white px-6 py-6">
      <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-stone-500">
        <span className="font-mono">{profile.guest_id}</span>
        {profile.country && <span>· {profile.country}</span>}
        {profile.is_repeat && (
          <span className="rounded-sm bg-emerald-100 px-2 py-0.5 font-mono text-emerald-900">
            Repeat
          </span>
        )}
        {profile.arrival_bucket === "next_7" && (
          <span className="rounded-sm bg-emerald-100 px-2 py-0.5 font-mono text-emerald-900">
            Arriving in {profile.days_until_arrival ?? 0}d
          </span>
        )}
      </div>
      <h2 className="mt-2 font-serif text-3xl text-stone-900">{profile.full_name}</h2>
      {(profile.top_source || profile.top_segment) && (
        <p className="mt-2 text-sm text-stone-600">
          {profile.top_source && (
            <>
              Books via{" "}
              <em className="not-italic font-medium">{profile.top_source}</em>
            </>
          )}
          {profile.top_source && profile.top_segment && " · "}
          {profile.top_segment && <span>{profile.top_segment}</span>}
        </p>
      )}
    </section>
  );
}

function ContactBlock({
  profile,
  fallbackContact,
}: {
  profile: Profile;
  fallbackContact: FallbackContact;
}) {
  const effEmail = profile.email || fallbackContact.email;
  const effPhone = profile.phone || fallbackContact.phone;
  const hasAny =
    effEmail ||
    effPhone ||
    profile.city ||
    profile.date_of_birth ||
    profile.language ||
    profile.gender;

  return (
    <section className="border-b border-stone-200 px-6 py-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="font-serif text-xs uppercase tracking-[0.16em] text-stone-700">
          Contact
        </h3>
        <span className="font-mono text-[10px] uppercase tracking-wider text-stone-500">
          Marketing readiness {profile.marketing_readiness_score}/100
        </span>
      </div>

      {!hasAny && (
        <div className="mb-3 rounded-sm border border-amber-300 bg-amber-50/60 p-3 text-xs text-amber-900">
          <p className="font-medium">No contact details on file.</p>
          <p className="mt-0.5 text-amber-800">
            Cloudbeds enriched-guest sync (<code>getGuest</code>) hasn&apos;t
            populated email / phone / city yet. Fields below show all the
            tracked attributes — em-dashes mark genuinely missing values.
          </p>
        </div>
      )}

      {/* Always render the full set of fields so PBS sees what's tracked.
          Empty values display as em-dash per design spec. */}
      <ul className="grid grid-cols-2 gap-3 text-sm">
        <ContactItem
          label={effEmail && !profile.email ? "Email · fallback" : "Email"}
          value={effEmail}
          href={effEmail ? `mailto:${effEmail}` : undefined}
        />
        <ContactItem
          label={effPhone && !profile.phone ? "Phone · fallback" : "Phone"}
          value={effPhone}
          href={effPhone ? `tel:${effPhone}` : undefined}
        />
        <ContactItem label="Country" value={profile.country} />
        <ContactItem label="City" value={profile.city} />
        <ContactItem label="Date of birth" value={profile.date_of_birth} />
        <ContactItem label="Language" value={profile.language} />
        <ContactItem label="Gender" value={profile.gender} />
      </ul>
    </section>
  );
}

function ContactItem({
  label,
  value,
  href,
}: {
  label: string;
  value: string | null | undefined;
  href?: string;
}) {
  const display = value && value.trim() !== "" ? value : EMPTY;
  const isEmpty = display === EMPTY;
  return (
    <li>
      <p className="text-[10px] uppercase tracking-[0.14em] text-stone-500">
        {label}
      </p>
      {href && !isEmpty ? (
        <a href={href} className="text-sm text-stone-900 hover:underline">
          {display}
        </a>
      ) : (
        <p className={`text-sm ${isEmpty ? "text-stone-400" : "text-stone-900"}`}>
          {display}
        </p>
      )}
    </li>
  );
}

function StatsBlock({ profile }: { profile: Profile }) {
  return (
    <section className="grid grid-cols-2 gap-3 border-b border-stone-200 bg-stone-100/40 px-6 py-5">
      <Stat
        label="Lifetime revenue"
        value={
          profile.lifetime_revenue
            ? fmtUSD(Number(profile.lifetime_revenue))
            : EMPTY
        }
      />
      <Stat
        label="Avg ADR"
        value={profile.avg_adr ? fmtUSD(Number(profile.avg_adr)) : EMPTY}
      />
      <Stat label="Stays" value={String(profile.stays_count)} />
      <Stat
        label="Total nights"
        value={profile.total_nights?.toString() ?? EMPTY}
      />
      <Stat label="Bookings" value={String(profile.bookings_count)} />
      <Stat
        label="Cancellations"
        value={String(profile.cancellations_count)}
      />
      <Stat label="First stay" value={profile.first_stay_date ?? EMPTY} />
      <Stat label="Last stay" value={profile.last_stay_date ?? EMPTY} />
      {profile.upcoming_stay_date && (
        <Stat
          label="Next arrival"
          value={profile.upcoming_stay_date}
          tone="emerald"
        />
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "emerald";
}) {
  return (
    <div className="rounded-sm bg-white p-3">
      <p className="text-[10px] uppercase tracking-[0.14em] text-stone-500">
        {label}
      </p>
      <p
        className={`mt-1 font-serif text-base tabular-nums ${
          tone === "emerald" ? "text-emerald-900" : "text-stone-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function ReservationTimeline({ reservations }: { reservations: Reservation[] }) {
  if (reservations.length === 0) {
    return (
      <section className="px-6 py-8 text-center text-sm text-stone-500">
        No reservations on file.
      </section>
    );
  }
  return (
    <section className="px-6 py-6">
      <h3 className="mb-3 font-serif text-xs uppercase tracking-[0.16em] text-stone-700">
        Reservation history · {reservations.length}
      </h3>
      <ul className="space-y-2">
        {reservations.map((r) => (
          <li
            key={r.reservation_id}
            className={`rounded-sm border bg-white px-4 py-3 ${
              r.phase === "upcoming"
                ? "border-emerald-300"
                : r.phase === "cancelled"
                ? "border-stone-200 opacity-60"
                : "border-stone-200"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-xs text-stone-600">
                  {r.check_in_date} → {r.check_out_date}{" "}
                  <span className="text-stone-400">· {r.nights}n</span>
                </p>
                <p className="mt-0.5 text-sm text-stone-900">
                  {r.room_type_name ?? EMPTY}{" "}
                  <span className="text-xs text-stone-500">
                    · {r.adults} adult{r.adults !== 1 ? "s" : ""}
                    {r.children > 0 && ` + ${r.children} child`}
                  </span>
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium tabular-nums text-stone-900">
                  {r.total_amount ? (
                    fmtUSD(Number(r.total_amount))
                  ) : (
                    <span className="text-stone-300">{EMPTY}</span>
                  )}
                </p>
                <PhaseBadge phase={r.phase} />
              </div>
            </div>
            <p className="mt-1.5 text-[11px] uppercase tracking-wider text-stone-500">
              {r.source_name ?? EMPTY} · {r.market_segment ?? EMPTY} · {r.rate_plan ?? EMPTY}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PhaseBadge({ phase }: { phase: Reservation["phase"] }) {
  const map = {
    upcoming: { c: "bg-emerald-100 text-emerald-900", t: "Upcoming" },
    in_house: { c: "bg-sky-100 text-sky-900", t: "In-house" },
    past: { c: "bg-stone-100 text-stone-700", t: "Past" },
    cancelled: { c: "bg-rose-100 text-rose-900", t: "Cancelled" },
  } as const;
  const v = map[phase];
  return (
    <span
      className={`mt-1 inline-block rounded-sm px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${v.c}`}
    >
      {v.t}
    </span>
  );
}
