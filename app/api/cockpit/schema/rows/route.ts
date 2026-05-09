// app/api/cockpit/schema/rows/route.ts
// Returns rows + columns for a specific table.
// Read-only. Service role key required to read regardless of RLS.

import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// PBS 2026-05-09: lazy-init the Supabase client so the build's "collect
// page data" step doesn't crash when env vars aren't available at build
// time (CI doesn't pass NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).
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

const ALLOWED_TABLES = new Set([
  "cockpit_tickets",
  "cockpit_decisions",
  "cockpit_incidents",
  "cockpit_kpi_snapshots",
  "cockpit_audit_log",
  "bookings",
  "parity_check_results",
  "rate_shop_results",
  "channel_performance",
  "pickup_snapshots",
  "fx_rates",
  "usali_mapping",
  "packages",
  "page_views",
  "v_bookings_research",
  "v_analytics_research",
]);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tableParam = url.searchParams.get("table") || "";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 500);

  // table is "schema.name" — strip schema, validate against allowlist.
  const tableName = tableParam.includes(".") ? tableParam.split(".")[1] : tableParam;
  if (!ALLOWED_TABLES.has(tableName)) {
    return NextResponse.json({ error: "table not allowed" }, { status: 403 });
  }

  const { data, error } = await supa().from(tableName).select("*").limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Infer columns from the first row (good enough for read-only display)
  const columns: Array<{ name: string; type: string }> = data && data.length > 0
    ? Object.entries(data[0]).map(([name, value]) => ({ name, type: inferType(value) }))
    : [];

  return NextResponse.json({ rows: data ?? [], columns });
}

function inferType(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return Number.isInteger(v) ? "int" : "numeric";
  if (typeof v === "boolean") return "bool";
  if (typeof v === "object") return "jsonb";
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return "timestamptz";
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return "date";
    return "text";
  }
  return "text";
}
