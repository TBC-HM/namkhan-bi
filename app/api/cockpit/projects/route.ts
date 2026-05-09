// app/api/cockpit/projects/route.ts
// 2026-05-08 — GET list active projects, POST create new project.
// Archive lives in /api/cockpit/projects/[slug]/archive.
//
// MVP: no auth gate beyond service-role on the server side. Project slug
// is auto-derived from name (kebab-cased + uniqueness check). Owner / dept
// passed by the caller (the dept entry page knows which dept it is).

import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://build-placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "build-placeholder-key"
);

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || `project-${Date.now()}`;
}

export async function GET(req: Request) {
  noStore();
  const url = new URL(req.url);
  const dept = url.searchParams.get("dept"); // optional filter
  const includeArchived = url.searchParams.get("archived") === "true";

  let q = supabase
    .from("cockpit_projects")
    .select("id, slug, name, description, goal, dept, owner_role, status, created_at, archived_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (!includeArchived) q = q.eq("status", "active");
  if (dept) q = q.eq("dept", dept);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ projects: data ?? [] });
}

export async function POST(req: Request) {
  noStore();
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const description = String(body.description ?? "").trim();
  const goal = String(body.goal ?? "").trim();
  const dept = String(body.dept ?? "").trim() || null;
  const owner_role = String(body.owner_role ?? "").trim() || null;
  const created_by = String(body.created_by ?? "PBS").trim();

  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  // Derive a unique slug. Try base, then base-2, base-3, ...
  const base = slugify(name);
  let slug = base;
  for (let i = 2; i < 50; i++) {
    const { data: existing } = await supabase
      .from("cockpit_projects")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!existing) break;
    slug = `${base}-${i}`;
  }

  const { data, error } = await supabase
    .from("cockpit_projects")
    .insert({ slug, name, description: description || null, goal: goal || null, dept, owner_role, created_by, status: "active" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("cockpit_audit_log").insert({
    agent: "pbs",
    action: "project_created",
    target: `project:${slug}`,
    success: true,
    metadata: { project_id: data.id, slug, dept, owner_role },
    reasoning: `Project "${name}" created from dept entry page.`,
  });

  return NextResponse.json({ project: data });
}
