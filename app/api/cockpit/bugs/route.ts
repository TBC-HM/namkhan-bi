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
  const [{ data: bugRows, error: bugErr }, { data: pendingTickets, error: tErr }] = await Promise.all([
    supabase
      .from("cockpit_bugs")
      .select("id, dept_slug, body, status, fix_link, fix_label, created_at, acked_at, started_at, done_at")
      .eq("dept_slug", dept)
      .order("created_at", { ascending: false })
      .limit(50),
    // PBS 2026-05-09: fold awaits_user tickets into the bug box so PBS sees
    // approvals where the request was made. Two cases:
    //  (a) ticket linked to an existing bug — already shows via bug row.
    //  (b) ticket created via chat (no bug row) — surface as a virtual bug
    //      so the "✓ approve · deploy" button is reachable from dept-entry.
    supabase
      .from("cockpit_tickets")
      .select("id, status, arm, parsed_summary, email_subject, preview_url, pr_url, created_at, metadata")
      .eq("status", "awaits_user")
      .or(`arm.eq.${dept},metadata->>dept_slug.eq.${dept}`)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  if (bugErr) return NextResponse.json({ error: bugErr.message }, { status: 500 });
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });

  const bugs = bugRows ?? [];
  const linkedTicketIds = new Set<number>();
  // bug.fix_link encodes the linked ticket's preview indirectly — we use
  // metadata.cockpit_bug_id on the ticket side as the canonical join, but
  // since we already loaded bugs above, build a set of "bug-linked" ticket ids
  // by re-querying the tickets table. Cheap (<=50 IDs).
  const bugIds = bugs.map((b) => b.id);
  if (bugIds.length > 0) {
    const { data: linked } = await supabase
      .from("cockpit_tickets")
      .select("id, metadata")
      .in("metadata->>cockpit_bug_id", bugIds.map((n) => String(n)));
    for (const t of linked ?? []) linkedTicketIds.add(t.id as number);
  }

  type VirtualBug = {
    id: number;
    dept_slug: string;
    body: string;
    status: "processing";
    fix_link: string | null;
    fix_label: string | null;
    created_at: string;
    acked_at: null;
    started_at: string | null;
    done_at: null;
    virtual: true;
    ticket_id: number;
  };
  const virtual: VirtualBug[] = [];
  for (const t of pendingTickets ?? []) {
    if (linkedTicketIds.has(t.id as number)) continue; // already represented by a real bug
    const previewLink = (t.preview_url as string | null) || null;
    virtual.push({
      id: -1 * (t.id as number), // negative IDs distinguish virtual from real bugs
      dept_slug: dept,
      body: String(t.parsed_summary ?? t.email_subject ?? `[ticket #${t.id}] awaits approval`).slice(0, 460),
      status: "processing",
      fix_link: previewLink,
      fix_label: previewLink ? "preview · approve to promote" : "awaits approval",
      created_at: String(t.created_at),
      acked_at: null,
      started_at: String(t.created_at),
      done_at: null,
      virtual: true,
      ticket_id: t.id as number,
    });
  }

  return NextResponse.json({ rows: [...bugs, ...virtual] });
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
