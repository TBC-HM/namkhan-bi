// app/api/cockpit/bugs/route.ts
// Bugs box on dept-entry pages (PBS 2026-05-09).
// GET  ?dept=<slug>             → bugs for a department, newest first
// POST { dept, body }           → file a new bug (status='new')
// PATCH { id, status, fix_link, fix_label } → flip workflow state

import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://build-placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "build-placeholder-key"
);

const STATUSES = ["new", "acked", "processing", "done"] as const;
type Status = (typeof STATUSES)[number];

export async function GET(req: Request) {
  noStore();
  const url = new URL(req.url);
  const dept = url.searchParams.get("dept");
  if (!dept) return NextResponse.json({ error: "dept required" }, { status: 400 });
  const { data, error } = await supabase
    .from("cockpit_bugs")
    .select("id, dept_slug, body, status, fix_link, fix_label, created_at, acked_at, started_at, done_at")
    .eq("dept_slug", dept)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data ?? [] });
}

export async function POST(req: Request) {
  noStore();
  const body = (await req.json().catch(() => ({}))) as {
    dept?: string;
    body?: string;
    created_by?: string;
  };
  const dept = (body.dept ?? "").trim();
  const text = (body.body ?? "").trim();
  if (!dept || !text) return NextResponse.json({ error: "dept and body required" }, { status: 400 });
  const { data, error } = await supabase
    .from("cockpit_bugs")
    .insert({
      dept_slug: dept,
      body: text,
      created_by: body.created_by ?? null,
      status: "new",
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data?.id });
}

export async function PATCH(req: Request) {
  noStore();
  const body = (await req.json().catch(() => ({}))) as {
    id?: number;
    status?: Status;
    fix_link?: string;
    fix_label?: string;
  };
  const id = Number(body.id);
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.status) {
    if (!STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    }
    patch.status = body.status;
    const ts = new Date().toISOString();
    if (body.status === "acked") patch.acked_at = ts;
    if (body.status === "processing") patch.started_at = ts;
    if (body.status === "done") patch.done_at = ts;
  }
  if (typeof body.fix_link === "string") patch.fix_link = body.fix_link;
  if (typeof body.fix_label === "string") patch.fix_label = body.fix_label;

  const { error } = await supabase.from("cockpit_bugs").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  noStore();
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await supabase.from("cockpit_bugs").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
