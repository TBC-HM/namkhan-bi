// app/api/cockpit/webhooks/supabase/route.ts
// POST — receive Supabase Database Webhooks. Verify shared-secret header.
// Log + open incident on cockpit_agent_prompts UPDATE (Phase 3 trigger
// post-agent-change) and supabase_migrations INSERT.
//
// Author: PBS via Claude (Cowork) · 2026-05-06.

import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);

export async function POST(req: Request) {
  noStore();
  const expected = process.env.SUPABASE_WEBHOOK_SECRET;
  const header = req.headers.get("x-webhook-secret");
  if (!expected || !header || header !== expected) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const payload = await req.json().catch(() => ({}));
  const table = (payload?.table ?? "unknown").toString();
  const op = (payload?.type ?? "unknown").toString();

  await supabase.from("cockpit_audit_log").insert({
    agent: "supabase-webhook",
    action: `supabase_${op}_${table}`,
    target: `${payload?.schema ?? "public"}.${table}`,
    success: true,
    metadata: { schema: payload?.schema, table, op, record: payload?.record, old_record: payload?.old_record },
    reasoning: `Supabase ${op} on ${table}`,
  });

  // Post-agent-change trigger (Phase 3 Prompt 2 Part D): cockpit_agent_prompts UPDATE
  if (table === "cockpit_agent_prompts" && op === "UPDATE") {
    const role = (payload?.record as { role?: string })?.role ?? "unknown";
    await supabase.from("cockpit_incidents").insert({
      severity: "low",
      source: "supabase-webhook-agent-prompt-change",
      summary: `Agent prompt updated: ${role}`,
      details: payload,
      status: "open",
    });
  }

  // Post-migration trigger: schema_migrations INSERT (logged only — Sentinel
  // would run advisor checks here once Supabase Management API access ships)
  if (table === "schema_migrations" && op === "INSERT") {
    const version = (payload?.record as { version?: string })?.version ?? "unknown";
    await supabase.from("cockpit_audit_log").insert({
      agent: "supabase-webhook",
      action: "post_migration_logged",
      target: `migration ${version}`,
      success: true,
      metadata: { version, name: (payload?.record as { name?: string })?.name },
      reasoning: "Phase 3 Prompt 2 Part C — migration applied. Future: trigger Sentinel advisor sweep.",
    });
  }

  return NextResponse.json({ ok: true });
}
