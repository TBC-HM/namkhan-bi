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

  const [{ data: profile }, { data: reservations }] = await Promise.all([
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
  ]);

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
    profile: profile as any,
    reservations: (reservations as any[]) ?? [],
    fallbackContact: fallback,
  };
}
