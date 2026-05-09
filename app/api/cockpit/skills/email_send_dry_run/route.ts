// app/api/cockpit/skills/email_send_dry_run/route.ts
// ZIP 5 Phase 5 — dry-run guest email proposal. NEVER actually sends when dry_run=true.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://build-placeholder.supabase.co", process.env.SUPABASE_SERVICE_ROLE_KEY || "build-placeholder-key");

function authed(req: Request): boolean {
  if (process.env.COCKPIT_AUTH_GATE !== "on") return true;
  return (req.headers.get("authorization") ?? "") === `Bearer ${process.env.COCKPIT_AGENT_TOKEN}`;
}

export async function POST(req: Request) {
  if (!authed(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { to, subject, body_md, dry_run = true, thread_id } = body as {
    to?: string; subject?: string; body_md?: string; dry_run?: boolean; thread_id?: string;
  };
  if (!to || !subject || !body_md) return NextResponse.json({ ok: false, error: "to, subject, body_md required" }, { status: 400 });

  const proposed = { to, from: "pb@thenamkhan.com", subject, body_md, thread_id: thread_id ?? null };

  await supabase.from("cockpit_audit_log").insert({
    agent: "skill-email-send", action: dry_run ? "dry_run_email_propose" : "email_send_blocked",
    target: `gmail:${to}`, success: dry_run,
    metadata: { dry_run, proposed, char_count: body_md.length },
    reasoning: dry_run
      ? `Dry-run: would send subject="${subject.slice(0, 60)}" to ${to}.`
      : "BLOCKED — actual Gmail send requires gmail.send OAuth scope (currently only readonly).",
  });

  if (dry_run) return NextResponse.json({ ok: true, dry_run: true, proposed, requires_followup: "PBS approves draft → re-call with dry_run=false." });

  // dry_run=false: attempt real send if Gmail creds present; degrade to draft otherwise.
  const hasCreds = !!(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN);
  if (!hasCreds) {
    const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body_md)}`;
    return NextResponse.json({
      ok: true,
      status: "deferred_no_creds",
      proposed,
      mailto_link: mailto,
      reason: "Gmail send credentials (GMAIL_CLIENT_ID/SECRET/REFRESH_TOKEN) not set. Draft above is ready — open the mailto_link OR set credentials and re-call.",
    });
  }

  // Real send via Gmail API
  try {
    const tokRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: process.env.GMAIL_CLIENT_ID!,
        client_secret: process.env.GMAIL_CLIENT_SECRET!,
        refresh_token: process.env.GMAIL_REFRESH_TOKEN!,
      }),
    });
    if (!tokRes.ok) throw new Error(`oauth ${tokRes.status}`);
    const { access_token } = await tokRes.json();
    const raw = `From: pb@thenamkhan.com\r\nTo: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${body_md}`;
    const b64 = Buffer.from(raw).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const sendRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw: b64, ...(thread_id ? { threadId: thread_id } : {}) }),
    });
    const sj = await sendRes.json().catch(() => ({}));
    const ok = sendRes.ok;
    await supabase.from("cockpit_audit_log").insert({
      agent: "skill-email-send", action: ok ? "email_sent" : "email_send_failed",
      target: `gmail:${to}`, success: ok,
      metadata: { to, subject, gmail_message_id: sj.id, status: sendRes.status },
      reasoning: ok ? `Email sent (Gmail msg ${sj.id}).` : `Send failed: ${sendRes.status}.`,
    });
    return NextResponse.json({ ok, status: ok ? "sent" : "api_error", gmail_message_id: sj.id, response_status: sendRes.status });
  } catch (e) {
    return NextResponse.json({ ok: false, status: "exception", error: e instanceof Error ? e.message : String(e), proposed }, { status: 500 });
  }
}
