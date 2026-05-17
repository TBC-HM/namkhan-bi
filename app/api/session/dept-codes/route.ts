// app/api/session/dept-codes/route.ts
// GET ?ids=uuid1,uuid2,... — resolves ops.departments.dept_id list → codes.
// Used by the N-dropdown to filter top menu items for HOD users.
// Author: IT-team agent · 2026-05-13.

import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://build-placeholder.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "build-placeholder-key";

export async function GET(req: Request) {
  noStore();
  const url = new URL(req.url);
  const raw = url.searchParams.get("ids") ?? "";
  const ids = raw.split(",").map((s) => s.trim()).filter((s) => /^[0-9a-f-]{36}$/i.test(s));
  if (ids.length === 0) return NextResponse.json({ codes: [] });

  const ops = createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: "ops" } });
  const { data, error } = await ops.from("departments").select("code").in("dept_id", ids);
  if (error) return NextResponse.json({ codes: [] }, { status: 200 });
  const codes = Array.from(new Set((data ?? []).map((r: { code: string }) => r.code)));
  return NextResponse.json({ codes });
}
