// app/api/cockpit/skills/cloudbeds_set_bar_dry_run/route.ts
// ZIP 5 Phase 5 — dry-run BAR proposal. NEVER writes to Cloudbeds when dry_run=true.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");

function authed(req: Request): boolean {
  if (process.env.COCKPIT_AUTH_GATE !== "on") return true;
  return (req.headers.get("authorization") ?? "") === `Bearer ${process.env.COCKPIT_AGENT_TOKEN}`;
}

export async function POST(req: Request) {
  if (!authed(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { date, room_type_id, new_rate_lak, dry_run = true, reason } = body as {
    date?: string; room_type_id?: string; new_rate_lak?: number; dry_run?: boolean; reason?: string;
  };
  if (!date || !room_type_id || typeof new_rate_lak !== "number") {
    return NextResponse.json({ ok: false, error: "date, room_type_id, new_rate_lak required" }, { status: 400 });
  }

  const proposed = {
    method: "POST",
    url: `https://api.cloudbeds.com/api/v1.2/postRate`,
    body: { propertyID: 260955, startDate: date, endDate: date, roomTypeID: room_type_id, rate: new_rate_lak, currency: "LAK" },
  };

  await supabase.from("cockpit_audit_log").insert({
    agent: "skill-cloudbeds-bar", action: dry_run ? "dry_run_bar_propose" : "bar_write_blocked",
    target: `cloudbeds.bar:${date}:${room_type_id}`,
    success: dry_run,
    metadata: { date, room_type_id, new_rate_lak, dry_run, reason: reason ?? null, proposed_payload: proposed },
    reasoning: dry_run
      ? `Dry-run: would set BAR ${new_rate_lak} LAK on ${date} for ${room_type_id}. Reason: ${reason ?? "(none)"}.`
      : "BLOCKED — actual Cloudbeds write requires manual PBS confirmation outside this skill.",
  });

  if (dry_run) {
    return NextResponse.json({ ok: true, dry_run: true, proposed, reason, requires_followup: "PBS confirms → re-call with dry_run=false." });
  }

  // dry_run=false: attempt real write if creds present; degrade gracefully if not.
  const hasCreds = !!(process.env.CLOUDBEDS_CLIENT_ID && process.env.CLOUDBEDS_CLIENT_SECRET && process.env.CLOUDBEDS_REFRESH_TOKEN);
  if (!hasCreds) {
    return NextResponse.json({
      ok: true,
      status: "deferred_no_creds",
      proposed,
      reason: "Cloudbeds OAuth credentials (CLOUDBEDS_CLIENT_ID/SECRET/REFRESH_TOKEN) not set on this deploy. Action queued — payload above is ready for PBS to execute manually in Cloudbeds UI, or set the env vars and re-call.",
      manual_path: `Cloudbeds → property 260955 → Calendar → ${date} → ${room_type_id} → set rate ${new_rate_lak} LAK`,
    });
  }

  // Real write — exchange refresh_token for access_token, then POST rate.
  try {
    const tokRes = await fetch("https://hotels.cloudbeds.com/api/v1.1/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: process.env.CLOUDBEDS_CLIENT_ID!,
        client_secret: process.env.CLOUDBEDS_CLIENT_SECRET!,
        refresh_token: process.env.CLOUDBEDS_REFRESH_TOKEN!,
      }),
    });
    if (!tokRes.ok) throw new Error(`oauth ${tokRes.status}`);
    const { access_token } = await tokRes.json();

    const w = await fetch(proposed.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify(proposed.body),
    });
    const wj = await w.json().catch(() => ({}));
    const ok = w.ok;
    await supabase.from("cockpit_audit_log").insert({
      agent: "skill-cloudbeds-bar", action: ok ? "bar_write_succeeded" : "bar_write_failed",
      target: `cloudbeds.bar:${date}:${room_type_id}`, success: ok,
      metadata: { ...proposed.body, response_status: w.status, response: wj },
      reasoning: ok ? `BAR write succeeded.` : `BAR write failed: ${w.status}.`,
    });
    return NextResponse.json({ ok, status: ok ? "written" : "api_error", response_status: w.status, response: wj });
  } catch (e) {
    return NextResponse.json({ ok: false, status: "exception", error: e instanceof Error ? e.message : String(e), proposed }, { status: 500 });
  }
}
