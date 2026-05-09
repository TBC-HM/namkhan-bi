// app/api/cockpit/webhooks/uptime/route.ts
// Receives uptime monitor alerts (UptimeRobot or Better Stack format) →
// re-checks the URL → logs to cockpit_incidents + sets resolution on recovery.
// Replaces Make.com scenario 02.
//
// UptimeRobot setup:
//   Dashboard → My Settings → Add Alert Contact → Type: Webhook
//   URL: https://namkhan-bi.vercel.app/api/cockpit/webhooks/uptime?secret=<COCKPIT_WEBHOOK_SECRET>
//   POST value (custom): {"alertType":"*alertTypeFriendlyName*","url":"*monitorURL*","monitor":"*monitorFriendlyName*","details":"*alertDetails*"}
//
// Better Stack setup: similar — set Webhook URL and JSON template.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://build-placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "build-placeholder-key"
);

function checkSecret(req: Request): boolean {
  const expected = process.env.COCKPIT_WEBHOOK_SECRET;
  if (!expected) return false;
  const url = new URL(req.url);
  return (
    url.searchParams.get("secret") === expected ||
    req.headers.get("x-cockpit-secret") === expected
  );
}

async function recheck(url: string): Promise<number> {
  try {
    const res = await fetch(`${url}?cockpit_recheck=${Date.now()}`, {
      method: "GET",
      headers: { "User-Agent": "namkhan-cockpit-uptime-recheck/1.0" },
      signal: AbortSignal.timeout(10_000),
    });
    return res.status;
  } catch {
    return 0;
  }
}

export async function POST(req: Request) {
  if (!checkSecret(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = await req.json();
  } catch {
    // UptimeRobot sometimes sends form-encoded; try that.
    const text = await req.text().catch(() => "");
    payload = { raw: text };
  }

  // Normalise UptimeRobot vs Better Stack vs custom payloads.
  const alertType =
    ((payload.alertType ?? payload.alertTypeFriendlyName ?? payload.event_type) as string) || "";
  const monitorUrl = ((payload.url ?? payload.monitorURL) as string) || "https://namkhan-bi.vercel.app";
  const monitorName = ((payload.monitor ?? payload.monitorFriendlyName) as string) || "namkhan-bi";

  const isDown = /down|critical|incident.created/i.test(alertType);
  const isUp = /up|recovery|incident.resolved/i.test(alertType);

  if (isDown) {
    // Re-check before logging — saves false positives.
    const recheckStatus = await recheck(monitorUrl);
    if (recheckStatus >= 200 && recheckStatus < 400) {
      // False alarm — alert says down but recheck succeeded.
      await supabase.from("cockpit_audit_log").insert({
        agent: "uptime_watcher",
        action: "false_alarm",
        target: monitorUrl,
        success: true,
        metadata: { alert: payload, recheck_status: recheckStatus },
        reasoning: "monitor reported down but recheck returned 2xx/3xx",
      });
      return NextResponse.json({ result: "false_alarm", recheck_status: recheckStatus });
    }

    const { data: inc, error } = await supabase
      .from("cockpit_incidents")
      .insert({
        severity: 1,
        symptom: "site down",
        source: "uptime_watcher",
        metadata: {
          url: monitorUrl,
          monitor: monitorName,
          alert: payload,
          recheck_status: recheckStatus,
        },
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ result: "down_logged", incident_id: inc?.id, recheck_status: recheckStatus });
  }

  if (isUp) {
    // Find most recent open uptime incident and mark resolved.
    const { data: open } = await supabase
      .from("cockpit_incidents")
      .select("*")
      .eq("source", "uptime_watcher")
      .is("resolved_at", null)
      .order("detected_at", { ascending: false })
      .limit(1);

    if (open && open.length > 0) {
      const incident = open[0];
      const detected = new Date(incident.detected_at).getTime();
      const mttr = Math.max(1, Math.round((Date.now() - detected) / 60_000));

      await supabase
        .from("cockpit_incidents")
        .update({
          resolved_at: new Date().toISOString(),
          auto_resolved: true,
          fix: "site recovered",
          mttr_minutes: mttr,
        })
        .eq("id", incident.id);

      return NextResponse.json({ result: "resolved", incident_id: incident.id, mttr_minutes: mttr });
    }
    return NextResponse.json({ result: "up_no_open_incident" });
  }

  // Unknown alert type — log it.
  await supabase.from("cockpit_audit_log").insert({
    agent: "uptime_watcher",
    action: "unknown_alert",
    target: monitorUrl,
    success: false,
    metadata: payload,
    reasoning: `alert type unrecognized: ${alertType}`,
  });
  return NextResponse.json({ result: "ignored", alert_type: alertType });
}

export async function GET() {
  return NextResponse.json({
    endpoint: "uptime webhook",
    auth: "?secret= or X-Cockpit-Secret",
    accepts: ["UptimeRobot", "Better Stack", "custom JSON with alertType/url"],
  });
}
