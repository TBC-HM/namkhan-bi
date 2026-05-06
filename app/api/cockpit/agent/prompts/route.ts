// app/api/cockpit/agent/prompts/route.ts
// Read-only listing of the active agent prompts + version history.
// The /cockpit Team tab reads this to show "what each agent thinks it is".

import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  noStore();
  const url = new URL(req.url);
  const includeHistory = url.searchParams.get("history") === "1";

  const q = supabase
    .from("cockpit_agent_prompts")
    .select("id, role, prompt, version, active, source, notes, created_at, updated_at, ticket_id")
    .order("role", { ascending: true })
    .order("version", { ascending: false });

  if (!includeHistory) {
    q.eq("active", true);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ prompts: data ?? [] });
}
