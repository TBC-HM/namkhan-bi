// app/api/cockpit/users/route.ts
// GET — list all workspace_users (owner-only via middleware gate)
// POST — upsert / toggle / soft-delete
// Author: PBS via Claude (Cowork) · 2026-05-06.

import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { verifyWorkspaceCookie } from "@/lib/workspace-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://build-placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "build-placeholder-key"
);

async function ownerOnly(req: Request): Promise<{ ok: true; email: string } | { ok: false; res: Response }> {
  const cookie = req.headers.get("cookie") ?? "";
  const m = cookie.match(/workspace_session=([^;]+)/);
  const user = m ? await verifyWorkspaceCookie(decodeURIComponent(m[1])) : null;
  if (!user || !user.is_owner) {
    return { ok: false, res: NextResponse.json({ error: "Not Found" }, { status: 404 }) };
  }
  return { ok: true, email: user.email };
}

export async function GET(req: Request) {
  noStore();
  const auth = await ownerOnly(req);
  if (auth.ok === false) return auth.res;

  const { data, error } = await admin
    .from("workspace_users")
    .select("*")
    .order("is_owner", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data ?? [] });
}

export async function POST(req: Request) {
  noStore();
  const auth = await ownerOnly(req);
  if (auth.ok === false) return auth.res;

  const body = await req.json().catch(() => ({}));
  const action = (body?.action ?? "").toString();
  const actor = auth.email;

  if (action === "create") {
    const email = (body.email ?? "").toString().trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "invalid email" }, { status: 400 });
    }
    const row = {
      email,
      display_name: body.display_name ?? null,
      access_revenue: !!body.access_revenue,
      access_sales: !!body.access_sales,
      access_marketing: !!body.access_marketing,
      access_operations: !!body.access_operations,
      access_finance: !!body.access_finance,
      is_owner: !!body.is_owner,
      active: true,
      created_by: actor,
      notes: body.notes ?? null,
    };
    const { data, error } = await admin.from("workspace_users").insert(row).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await admin.from("cockpit_audit_log").insert({
      agent: "cockpit-users-admin",
      action: "workspace_user_added",
      target: email,
      success: true,
      metadata: { actor, row },
      reasoning: `Owner ${actor} added ${email}.`,
    });
    return NextResponse.json({ ok: true, row: data });
  }

  if (action === "update") {
    const email = (body.email ?? "").toString().trim().toLowerCase();
    const patch: Record<string, unknown> = {};
    for (const k of [
      "display_name", "access_revenue", "access_sales", "access_marketing",
      "access_operations", "access_finance", "is_owner", "active", "notes",
    ]) {
      if (k in body) patch[k] = body[k];
    }
    const { data: before } = await admin
      .from("workspace_users")
      .select("*")
      .eq("email", email)
      .maybeSingle();
    const { data, error } = await admin
      .from("workspace_users")
      .update(patch)
      .eq("email", email)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await admin.from("cockpit_audit_log").insert({
      agent: "cockpit-users-admin",
      action: "workspace_user_updated",
      target: email,
      success: true,
      metadata: { actor, patch, before },
      reasoning: `Owner ${actor} updated ${email}: ${Object.keys(patch).join(", ")}`,
    });
    return NextResponse.json({ ok: true, row: data });
  }

  if (action === "deactivate" || action === "reactivate") {
    const email = (body.email ?? "").toString().trim().toLowerCase();
    const newActive = action === "reactivate";
    const { data, error } = await admin
      .from("workspace_users")
      .update({ active: newActive })
      .eq("email", email)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await admin.from("cockpit_audit_log").insert({
      agent: "cockpit-users-admin",
      action: action === "reactivate" ? "workspace_user_reactivated" : "workspace_user_deactivated",
      target: email,
      success: true,
      metadata: { actor },
      reasoning: `Owner ${actor} ${action}d ${email}.`,
    });
    return NextResponse.json({ ok: true, row: data });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
