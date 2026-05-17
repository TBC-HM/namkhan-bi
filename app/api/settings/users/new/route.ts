// app/api/settings/users/new/route.ts
// POST — creates a workspace_users row + sends Supabase Auth invitation email.
// Holding-level admins only (verified via app.is_holding_admin()).
// Author: IT-team agent · 2026-05-13.
//
// Body:
// {
//   name: string,
//   email: string,
//   phone?: string,
//   property_ids: number[],   // empty + role_level='holding' => all properties
//   dept_ids?: string[],      // uuid[] of ops.departments
//   role_level: 'holding' | 'property' | 'hod',
// }

import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { verifyWorkspaceCookie } from "@/lib/workspace-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://build-placeholder.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "build-placeholder-key";

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

type Body = {
  name?: string;
  email?: string;
  phone?: string | null;
  property_ids?: number[];
  dept_ids?: string[];
  role_level?: "holding" | "property" | "hod";
};

// ---------------------------------------------------------------------------
// holding-only guard: trusts the signed workspace cookie (is_owner) OR queries
// workspace_users.role_level when the caller has only a supabase auth session.
async function callerIsHoldingAdmin(req: Request): Promise<{ ok: boolean; actor?: string }> {
  const cookieHdr = req.headers.get("cookie") ?? "";
  const m = cookieHdr.match(/workspace_session=([^;]+)/);
  const ws = m ? await verifyWorkspaceCookie(decodeURIComponent(m[1])) : null;

  if (ws && ws.is_owner) {
    return { ok: true, actor: ws.email };
  }

  // Fallback: any holding-level row that maps to this email
  if (ws?.email) {
    const { data } = await admin
      .from("workspace_users")
      .select("email, is_owner, role_level, active")
      .eq("email", ws.email)
      .maybeSingle();
    if (data?.active && (data.is_owner || data.role_level === "holding")) {
      return { ok: true, actor: data.email };
    }
  }

  return { ok: false };
}

export async function POST(req: Request) {
  noStore();

  const guard = await callerIsHoldingAdmin(req);
  if (!guard.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const email = (body.email ?? "").toString().trim().toLowerCase();
  const name = (body.name ?? "").toString().trim();
  const phone = body.phone ? body.phone.toString().trim() : null;
  const role_level = body.role_level ?? "property";
  const property_ids = Array.isArray(body.property_ids) ? body.property_ids.map(Number).filter((n) => Number.isFinite(n)) : [];
  const dept_ids = Array.isArray(body.dept_ids) ? body.dept_ids.filter((s) => typeof s === "string") : [];

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }
  if (!["holding", "property", "hod"].includes(role_level)) {
    return NextResponse.json({ error: "invalid role_level" }, { status: 400 });
  }
  if (role_level === "hod" && dept_ids.length === 0) {
    return NextResponse.json({ error: "hod role requires at least one dept_id" }, { status: 400 });
  }
  if (role_level === "property" && property_ids.length === 0) {
    return NextResponse.json({ error: "property role requires at least one property_id" }, { status: 400 });
  }

  // 1. Send invitation email (creates auth.users row if not already present)
  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: (req.headers.get("origin") ?? "https://namkhan-bi.vercel.app") + "/api/auth/callback",
    data: { display_name: name, phone, role_level },
  });

  let auth_user_id: string | null = invited?.user?.id ?? null;

  if (inviteErr) {
    // If user already exists in auth.users, look them up.
    const { data: existing } = await admin
      .from("workspace_users")
      .select("auth_user_id")
      .eq("email", email)
      .maybeSingle();
    auth_user_id = existing?.auth_user_id ?? null;

    if (!auth_user_id) {
      // Try resolving via auth admin listUsers (filter by email)
      const { data: list } = await admin.auth.admin.listUsers();
      const users = (list as { users?: Array<{ id: string; email?: string }> } | null)?.users ?? [];
      const match = users.find((u) => (u.email ?? "").toLowerCase() === email);
      if (match) auth_user_id = match.id;
    }
  }

  // 2. Upsert workspace_users row
  const row = {
    email,
    display_name: name || null,
    phone,
    role_level,
    property_ids,
    dept_ids,
    auth_user_id,
    invited_by: null, // populated below if we can resolve actor's auth uid
    invited_at: new Date().toISOString(),
    accepted_at: null,
    active: true,
    is_owner: false,
    // Module-flag mirrors for the legacy cookie payload.
    access_revenue: role_level === "holding",
    access_sales: role_level === "holding",
    access_marketing: role_level === "holding",
    access_operations: role_level === "holding",
    access_finance: role_level === "holding",
    created_by: guard.actor ?? "settings-users-new",
    notes: role_level === "hod"
      ? `HOD scoped to ${dept_ids.length} department(s)`
      : role_level === "property"
        ? `Property-level access to ${property_ids.length} hotel(s)`
        : "Holding-level (all properties)",
  };

  // Resolve invited_by from the actor's email
  if (guard.actor) {
    const { data: actorRow } = await admin
      .from("workspace_users")
      .select("auth_user_id")
      .eq("email", guard.actor)
      .maybeSingle();
    if (actorRow?.auth_user_id) row.invited_by = actorRow.auth_user_id;
  }

  const { data: upserted, error: upsertErr } = await admin
    .from("workspace_users")
    .upsert(row, { onConflict: "email" })
    .select()
    .single();

  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 400 });
  }

  await admin.from("cockpit_audit_log").insert({
    agent: "settings-users-new",
    action: "workspace_user_invited",
    target: email,
    success: true,
    metadata: { actor: guard.actor ?? null, role_level, property_ids, dept_ids, auth_user_id },
    reasoning: `Holding admin ${guard.actor ?? "unknown"} invited ${email} as ${role_level}.`,
  });

  return NextResponse.json({ ok: true, row: upserted });
}
