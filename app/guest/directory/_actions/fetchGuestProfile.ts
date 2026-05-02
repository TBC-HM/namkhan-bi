// app/guest/directory/_actions/fetchGuestProfile.ts
"use server";

import { createClient } from "@/lib/supabase/server";

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

  return {
    profile: profile as any,
    reservations: (reservations as any[]) ?? [],
  };
}
