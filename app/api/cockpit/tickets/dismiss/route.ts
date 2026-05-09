// app/api/cockpit/tickets/dismiss/route.ts
// PBS 2026-05-09: dismiss an awaits_user ticket from the dept-entry bug box.
// Sets ticket.status='archived' + writes audit log. Used when PBS clicks the
// X on a virtual bug row (chat-created task that he doesn't want to approve).

import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://build-placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "build-placeholder-key",
);

export async function POST(req: Request) {
  noStore();
  const body = (await req.json().catch(() => ({}))) as {
    ticket_id?: number;
    approver?: string;
    reason?: string;
  };
  const ticketId = Number(body.ticket_id);
  if (!ticketId) {
    return NextResponse.json({ error: "ticket_id required" }, { status: 400 });
  }
  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("cockpit_tickets")
    .update({
      status: "archived",
      closed_at: nowIso,
      notes: JSON.stringify({
        dismissed_at: nowIso,
        dismissed_by: body.approver ?? "PBS",
        reason: body.reason ?? "dismissed from dept-entry bug box",
      }),
    })
    .eq("id", ticketId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabase.from("cockpit_audit_log").insert({
    agent: "ticket_dismiss",
    action: "ticket_dismissed",
    success: true,
    ticket_id: ticketId,
    notes: JSON.stringify({ approver: body.approver ?? "PBS", reason: body.reason ?? null }),
  });
  return NextResponse.json({ ok: true, ticket_id: ticketId });
}
