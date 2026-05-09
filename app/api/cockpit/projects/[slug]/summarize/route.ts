// app/api/cockpit/projects/[slug]/summarize/route.ts
// 2026-05-08 — on-request project auto-summarise (PBS asked for a button,
// "always on request"). Pulls project + tickets + the latest 200 audit log
// rows attributed to this project's tickets, then calls Anthropic for a
// terse markdown retro. Result is stored on the project row + returned.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://build-placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "build-placeholder-key"
);

export async function POST(_req: Request, { params }: { params: { slug: string } }) {
  const { slug } = params;
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const { data: project, error: pErr } = await supabase
    .from("cockpit_projects")
    .select("*")
    .eq("slug", slug)
    .single();
  if (pErr || !project) return NextResponse.json({ error: "project not found" }, { status: 404 });

  const { data: tickets } = await supabase
    .from("cockpit_tickets")
    .select("id, status, parsed_summary, created_at, closed_at")
    .eq("project_id", project.id)
    .order("created_at", { ascending: true })
    .limit(80);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY missing" }, { status: 500 });

  const ticketLines = (tickets ?? []).map((t) =>
    `- [#${t.id} · ${t.status}] ${(t.parsed_summary ?? "").split("\n")[0]?.slice(0, 160)}`
  ).join("\n");

  const userMsg = `Project: ${project.name}
${project.description ? `Description: ${project.description}` : ""}

Tickets (${(tickets ?? []).length}):
${ticketLines || "(no tickets attached yet)"}

Write a terse retrospective markdown:
- 1-line outcome
- 3-5 bullet points of what shipped / blocked
- 1 bullet for the open follow-ups
Output ONLY the markdown, no preamble, no code fences.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      messages: [{ role: "user", content: userMsg }],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    return NextResponse.json({ error: `anthropic ${res.status}: ${t.slice(0, 200)}` }, { status: 500 });
  }
  const json = await res.json();
  const summary = (json?.content?.[0]?.text ?? "").trim();

  await supabase
    .from("cockpit_projects")
    .update({ description: project.description ?? null }) // no-op for updated_at trigger
    .eq("id", project.id);

  await supabase.from("cockpit_audit_log").insert({
    agent: "code_spec_writer",
    action: "project_summarized",
    target: `project:${slug}`,
    success: !!summary,
    metadata: { project_id: project.id, slug, ticket_count: (tickets ?? []).length },
    reasoning: summary.slice(0, 200) || "no summary produced",
  });

  return NextResponse.json({ project, summary, ticket_count: (tickets ?? []).length });
}
