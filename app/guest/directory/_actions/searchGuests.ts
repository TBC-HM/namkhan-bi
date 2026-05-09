// app/guest/directory/_actions/searchGuests.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import type { ArrivalWindow, StayedSince } from "../_components/DirectoryShell";

type Args = {
  q: string;
  country: string | null;
  sort: string;
  arrival: ArrivalWindow;
  stayedSince: StayedSince;
  repeatOnly: boolean;
  contactableOnly: boolean;
  page: number;
  pageSize: number;
};

const ARRIVAL_BUCKETS: Record<ArrivalWindow, string[] | null> = {
  any: null,
  next_7: ["next_7"],
  next_30: ["next_7", "next_30"],
  next_90: ["next_7", "next_30", "next_90"],
};

const STAYED_SINCE_DAYS: Record<StayedSince, number | null> = {
  any: null, '30d': 30, '90d': 90, '365d': 365, '730d': 730,
};

export async function searchGuests(args: Args) {
  const sb = createClient();

  // Sort: "field.direction[.nullslast]"
  const [sortField, sortDir, nullsHint] = args.sort.split(".");

  let query = sb
    .schema("guest")
    .from("mv_guest_profile")
    .select(
      "guest_id, full_name, country, email, phone, stays_count, bookings_count, " +
        "cancellations_count, lifetime_revenue, last_stay_date, upcoming_stay_date, " +
        "days_until_arrival, arrival_bucket, top_source, top_segment, is_repeat, " +
        "marketing_readiness_score",
      { count: "exact" }
    );

  // Combinable filters (each is independent and they AND together)
  if (args.q.trim().length >= 2) {
    query = query.ilike("full_name", `%${args.q.trim()}%`);
  }
  if (args.country) {
    query = query.eq("country", args.country);
  }
  if (args.repeatOnly) {
    query = query.eq("is_repeat", true);
  }
  if (args.contactableOnly) {
    query = query.not("email", "is", null);
  }
  const buckets = ARRIVAL_BUCKETS[args.arrival];
  if (buckets) {
    query = query.in("arrival_bucket", buckets);
  }
  const days = STAYED_SINCE_DAYS[args.stayedSince];
  if (days) {
    const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
    query = query.gte("last_stay_date", since);
  }

  // Sort
  query = query.order(sortField, {
    ascending: sortDir === "asc",
    nullsFirst: nullsHint !== "nullslast",
  });

  // Pagination
  const from = args.page * args.pageSize;
  const to = from + args.pageSize - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;
  if (error) {
    console.error("[searchGuests]", error);
    return { rows: [], total: 0 };
  }
  return { rows: (data as any[]) ?? [], total: count ?? 0 };
}
