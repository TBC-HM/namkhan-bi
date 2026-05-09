// app/api/cockpit/projects/[slug]/archive/route.ts
// 2026-05-08 — POST to archive a project. PBS rule: archive = gone.
// We flip status='archived' + stamp archived_at; the GET list filters
// these out by default so they vanish from the UI.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://build-placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "build-placeholder-key"
);

export async function POST(_req: Request, { params }: { params: { slug: string } }) {
  const { slug } = params;
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const { data, error } = await supabase
    .from("cockpit_projects")
    .update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("slug", slug)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "project not found" }, { status: 404 });
  }

  await supabase.from("cockpit_audit_log").insert({
    agent: "pbs",
    action: "project_archived",
    target: `project:${slug}`,
    success: true,
    metadata: { project_id: data.id, slug },
    reasoning: `Project "${data.name}" archived from dept entry page.`,
  });

  return NextResponse.json({ project: data });
}
