// app/api/cockpit/projects/[slug]/attach-ticket/route.ts
// 2026-05-08 — POST { ticket_id } to associate a cockpit_ticket with this
// project (sets cockpit_tickets.project_id). Used by the "Add to project"
// action inside the /cockpit chat tab so PBS can promote a mid-thread
// conversation to a project retroactively.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://build-placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "build-placeholder-key"
);

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const { slug } = params;
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const ticketId = Number(body.ticket_id);
  if (!Number.isFinite(ticketId)) {
    return NextResponse.json({ error: "ticket_id required" }, { status: 400 });
  }

  const { data: project } = await supabase
    .from("cockpit_projects")
    .select("id, slug, name")
    .eq("slug", slug)
    .single();
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });

  const { error } = await supabase
    .from("cockpit_tickets")
    .update({ project_id: project.id })
    .eq("id", ticketId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("cockpit_audit_log").insert({
    ticket_id: ticketId,
    agent: "pbs",
    action: "ticket_attached_to_project",
    target: `project:${slug}`,
    success: true,
    metadata: { project_id: project.id, project_slug: slug },
    reasoning: `Ticket #${ticketId} attached to project "${project.name}".`,
  });

  return NextResponse.json({ ok: true, project, ticket_id: ticketId });
}
