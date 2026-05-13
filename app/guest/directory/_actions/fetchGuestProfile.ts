// app/guest/directory/_actions/fetchGuestProfile.ts
"use server";

import { createClient } from "@/lib/supabase/server";

export type FallbackContact = {
  email: string | null;
  phone: string | null;
  source: "reservation" | null;
};

export async function fetchGuestProfile(guestId: string) {
  const sb = createClient();

  // PBS 2026-05-13: extras pulled direct from pms.guests_cb because
  // mv_guest_profile doesn't expose address / document fields. Single-row
  // PK lookup — performance impact negligible. Avoids dropping + recreating
  // the MV plus its dependent v_directory_facets.
  const [{ data: profile }, { data: reservations }, { data: extras }, { data: lang }] = await Promise.all([
    sb
      .schema("guest")
      .from("mv_guest_profile")
      .select("*")
      .eq("guest_id", guestId)
      .maybeSingle(),
    sb
      .schema("guest")
      .from("v_guest_reservations")
      .select("*")
      .eq("guest_id", guestId)
      .order("check_in_date", { ascending: false }),
    sb
      .schema("pms")
      .from("guests_cb")
      .select("address, document_type, document_number, total_stays, total_spent, last_stay_date")
      .eq("guest_id", guestId)
      .maybeSingle(),
    // PBS 2026-05-13: language now comes from guest.v_inferred_language —
    // resolves with Cloudbeds value first, country-heuristic second, returns
    // source + confidence so the drawer can flag inferred ones.
    sb
      .schema("guest")
      .from("v_inferred_language")
      .select("language, language_alt, language_source, confidence")
      .eq("guest_id", guestId)
      .maybeSingle(),
  ]);

  const mergedProfile = profile
    ? {
        ...profile,
        address: extras?.address ?? null,
        document_type: extras?.document_type ?? null,
        document_number: extras?.document_number ?? null,
        language: lang?.language ?? profile.language ?? null,
        language_alt: lang?.language_alt ?? null,
        language_source: (lang?.language_source ?? "unknown") as
          | "cloudbeds"
          | "inferred"
          | "unknown",
        language_confidence: lang?.confidence ?? 0,
      }
    : profile;

  // PBS 2026-05-09 (PR repair-list — JOB 1):
  //   The Contactable button needs a fallback when guest.email/phone are NULL
  //   (Cloudbeds anonymises them on every getGuest payload today). Read the
  //   most recent reservations.guest_email / guest_phone for the same guest
  //   so the button can still surface a real contact when one ever lands.
  //   public.reservations columns confirmed via information_schema 2026-05-09:
  //   guest_email text, guest_country text, cb_guest_id text. There is no
  //   guest_phone column today, so we only project email; we still return the
  //   shape so the button can render once a phone column is added.
  let fallback: FallbackContact = { email: null, phone: null, source: null };
  if (!profile?.email && !profile?.phone) {
    const { data: latest } = await sb
      .from("reservations")
      .select("guest_email, check_in_date")
      .eq("cb_guest_id", guestId)
      .not("guest_email", "is", null)
      .order("check_in_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest?.guest_email) {
      fallback = {
        email: latest.guest_email,
        phone: null,
        source: "reservation",
      };
    }
  }

  return {
    profile: mergedProfile as any,
    reservations: (reservations as any[]) ?? [],
    fallbackContact: fallback,
  };
}
