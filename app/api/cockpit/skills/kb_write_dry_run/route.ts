// app/api/cockpit/skills/kb_write_dry_run/route.ts
// ZIP 5 Phase 5 — dry-run KB row insertion. dry_run=false actually inserts (KB writes are safe).

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function authed(req: Request): boolean {
  if (process.env.COCKPIT_AUTH_GATE !== "on") return true;
  return (req.headers.get("authorization") ?? "") === `Bearer ${process.env.COCKPIT_AGENT_TOKEN}`;
}

export async function POST(req: Request) {
  if (!authed(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { topic, scope, key_fact, source, confidence = "medium", dry_run = true } = body as {
    topic?: string; scope?: string; key_fact?: string; source?: string; confidence?: string; dry_run?: boolean;
  };
  if (!topic || !scope || !key_fact || !source) return NextResponse.json({ ok: false, error: "topic, scope, key_fact, source required" }, { status: 400 });

  const proposed = { topic, scope, key_fact, source, confidence, active: true };

  if (dry_run) {
    await supabase.from("cockpit_audit_log").insert({
      agent: "skill-kb-write", action: "dry_run_kb_propose", target: topic, success: true,
      metadata: { dry_run: true, proposed }, reasoning: `Dry-run KB insert proposed for topic "${topic}".`,
    });
    return NextResponse.json({ ok: true, dry_run: true, proposed });
  }

  // Real insert — KB writes are non-destructive, safe to execute when dry_run=false.
  const { data, error } = await supabase.from("cockpit_knowledge_base").insert(proposed).select("id").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  await supabase.from("cockpit_audit_log").insert({
    agent: "skill-kb-write", action: "kb_inserted", target: `cockpit_knowledge_base:${data.id}`, success: true,
    metadata: { kb_id: data.id, topic, scope, source }, reasoning: `KB row #${data.id} inserted ("${topic}").`,
  });
  return NextResponse.json({ ok: true, kb_id: data.id, dry_run: false, inserted: proposed });
}
