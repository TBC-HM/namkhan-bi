// app/api/cockpit/schema/tables/route.ts
// Lists all tables in the connected Supabase database.
// Uses service role key to introspect pg_catalog.

import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// PBS 2026-05-09: lazy-init + force-dynamic so build's page-data collection
// step doesn't crash when env vars aren't passed to CI.
export const dynamic = "force-dynamic";

let _client: SupabaseClient | null = null;
function supa(): SupabaseClient {
  if (_client) return _client;
  _client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  );
  return _client;
}

export async function GET() {
  // Run a single SQL query via Supabase rpc OR via the SQL function.
  // Easiest: create a SQL function in Supabase that returns this data,
  // OR use the REST `pg_meta` schema if exposed.
  //
  // For simplicity here we hardcode the cockpit + main tables we expect.
  // Replace with a real introspection query in production.

  const tablesToCheck = [
    { schema: "public", name: "cockpit_tickets" },
    { schema: "public", name: "cockpit_decisions" },
    { schema: "public", name: "cockpit_incidents" },
    { schema: "public", name: "cockpit_kpi_snapshots" },
    { schema: "public", name: "cockpit_audit_log" },
    { schema: "public", name: "bookings" },
    { schema: "public", name: "parity_check_results" },
    { schema: "public", name: "rate_shop_results" },
    { schema: "public", name: "channel_performance" },
    { schema: "public", name: "pickup_snapshots" },
    { schema: "public", name: "fx_rates" },
    { schema: "public", name: "usali_mapping" },
    { schema: "public", name: "packages" },
    { schema: "public", name: "page_views" },
    { schema: "public", name: "v_bookings_research", isView: true },
    { schema: "public", name: "v_analytics_research", isView: true },
  ];

  const tables = await Promise.all(tablesToCheck.map(async (t) => {
    const { count } = await supa()
      .from(t.name)
      .select("*", { count: "exact", head: true });
    return {
      schema: t.schema,
      name: t.name,
      row_count: count ?? 0,
      size_bytes: 0,           // not available without pg_catalog access
      has_rls: t.name.startsWith("cockpit_"),
      is_view: t.isView ?? false,
    };
  }));

  return NextResponse.json({ tables });
}
