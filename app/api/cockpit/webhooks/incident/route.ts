// app/api/cockpit/webhooks/incident/route.ts
// Generic incident receiver. Replaces Make.com scenario 05.
//
// Source → severity mapping:
//   vercel_error_spike    → 2 (alerting)
//   supabase_advisor_red  → 2
//   dependency_high_vuln  → 3
//   github_workflow_fail  → 3
//   custom (anything)     → 4 unless severity passed in payload
//
// Severity ≤ 2 also opens a GitHub issue with the `incident` label.
//
// POST payload shape:
//   { source: string, symptom: string, severity?: 1|2|3|4, metadata?: object }

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
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

const SEVERITY_BY_SOURCE: Record<string, number> = {
  vercel_error_spike: 2,
  supabase_advisor_red: 2,
  dependency_high_vuln: 3,
  github_workflow_fail: 3,
  custom: 4,
};

async function openGithubIssue(severity: number, source: string, symptom: string, payload: unknown) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return { opened: false, reason: "GITHUB_TOKEN missing" };

  const body = `Auto-created from cockpit incident webhook.

**Source**: ${source}
**Symptom**: ${symptom}
**Severity**: ${severity}

\`\`\`json
${JSON.stringify(payload, null, 2)}
\`\`\`

— Namkhan BI Cockpit`;

  const res = await fetch("https://api.github.com/repos/TBC-HM/namkhan-bi/issues", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: `🚨 [S${severity}] ${symptom} (${source})`,
      body,
      labels: ["incident", "auto-created", `severity-${severity}`],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    return { opened: false, reason: `github ${res.status}: ${text.slice(0, 200)}` };
  }
  const issue = await res.json();
  return { opened: true, url: issue.html_url, number: issue.number };
}

export async function POST(req: Request) {
  if (!checkSecret(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const source = (payload.source as string) || "custom";
  const symptom = (payload.symptom as string) || "(no symptom)";
  const severity =
    typeof payload.severity === "number"
      ? (payload.severity as number)
      : SEVERITY_BY_SOURCE[source] ?? 4;

  const { data: incident, error } = await supabase
    .from("cockpit_incidents")
    .insert({
      severity,
      symptom,
      source,
      metadata: payload,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Open GitHub issue for S1/S2 only.
  let issue: Record<string, unknown> = { opened: false, reason: "severity > 2" };
  if (severity <= 2) {
    issue = await openGithubIssue(severity, source, symptom, payload);
    if (issue.opened) {
      await supabase
        .from("cockpit_incidents")
        .update({
          notified_at: new Date().toISOString(),
          metadata: { ...payload, github_issue_url: issue.url, github_issue_number: issue.number },
        })
        .eq("id", incident.id);
    }
  }

  // S1 also drops a cockpit ticket so the IT Manager triages it into the
  // queue and you see it in /cockpit alongside everything else.
  let cockpit_ticket: Record<string, unknown> = { created: false };
  if (severity === 1) {
    const { data: t } = await supabase
      .from("cockpit_tickets")
      .insert({
        source: "incident_webhook",
        arm: "health",
        intent: "fix",
        status: "new",
        email_subject: `[S1] ${symptom}`,
        email_body: `Source: ${source}\nSymptom: ${symptom}\n\nFull payload:\n${JSON.stringify(payload, null, 2)}`,
        parsed_summary: `🚨 S1 incident from ${source}: ${symptom}`,
        iterations: 0,
        notes: JSON.stringify({ kind: "incident", incident_id: incident.id, source, severity, github_issue: issue }),
      })
      .select()
      .single();
    if (t) cockpit_ticket = { created: true, id: t.id };
  }

  return NextResponse.json({
    incident_id: incident.id,
    severity,
    issue,
    cockpit_ticket,
  });
}

export async function GET() {
  return NextResponse.json({
    endpoint: "incident webhook",
    auth: "?secret= or X-Cockpit-Secret",
    payload: { source: "string", symptom: "string", severity: "1|2|3|4 (optional)", metadata: "object (optional)" },
    severity_mapping: SEVERITY_BY_SOURCE,
  });
}
