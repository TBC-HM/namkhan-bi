// app/api/cockpit/knowledge/route.ts
// Read endpoint for the knowledge base — fuels the Knowledge tab.
// Behind cockpit Basic Auth (via middleware).

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
  const search = url.searchParams.get("q") ?? "";
  const scope = url.searchParams.get("scope") ?? "";

  let q = supabase
    .from("cockpit_knowledge_base")
    .select("id, topic, key_fact, scope, source, source_ticket_id, confidence, active, created_at, updated_at")
    .eq("active", true)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (scope) q = q.eq("scope", scope);
  if (search) q = q.or(`topic.ilike.%${search}%,key_fact.ilike.%${search}%`);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data ?? [] });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { topic, key_fact, scope = "global", confidence = "medium" } = body as {
    topic?: string;
    key_fact?: string;
    scope?: string;
    confidence?: string;
  };
  if (!topic || !key_fact) {
    return NextResponse.json({ error: "topic and key_fact required" }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("cockpit_knowledge_base")
    .insert({ topic, key_fact, scope, source: "manual", confidence })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entry: data });
}
