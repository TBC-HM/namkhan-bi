// app/settings/users/new/page.tsx
// Holding-admin-only form to invite a new user.
// - Server component does the holding-admin check (403 for non-holding).
// - Client island handles the multi-select form.
// Coordinates with Agent F: lives under /settings (NOT /h/.../settings/* or
// /cockpit-v2/* — both off-limits per the ticket).
// Author: IT-team agent · 2026-05-13.

import { cookies, headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { verifyWorkspaceCookie } from "@/lib/workspace-cookie";
import NewUserForm from "./NewUserForm";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://build-placeholder.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "build-placeholder-key";

type Property = { property_id: number; code: string; name: string };
type Dept = { dept_id: string; code: string; name: string; property_id: number };

async function isHoldingAdmin(): Promise<{ ok: boolean; email?: string }> {
  // Prefer the signed workspace cookie (zero DB lookup).
  const cookieStore = cookies();
  const raw = cookieStore.get("workspace_session")?.value;
  const ws = raw ? await verifyWorkspaceCookie(raw) : null;
  if (ws?.is_owner) return { ok: true, email: ws.email };

  if (!ws?.email) return { ok: false };

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data } = await admin
    .from("workspace_users")
    .select("email, is_owner, role_level, active")
    .eq("email", ws.email)
    .maybeSingle();
  if (data?.active && (data.is_owner || data.role_level === "holding")) {
    return { ok: true, email: data.email };
  }
  return { ok: false };
}

async function loadOptions(): Promise<{ properties: Property[]; depts: Dept[] }> {
  const coreClient = createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: "core" } });
  const opsClient = createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: "ops" } });
  const [props, depts] = await Promise.all([
    coreClient.from("properties").select("property_id, code, name").eq("status", "active").order("property_id"),
    opsClient.from("departments").select("dept_id, code, name, property_id").eq("is_active", true).order("property_id").order("code"),
  ]);
  const propertiesRaw = (props.data ?? []) as Property[];
  const deptsRaw = (depts.data ?? []) as Dept[];
  return { properties: propertiesRaw, depts: deptsRaw };
}

export default async function NewUserPage() {
  // Open-mode (no auth gate) friendly: when running with no signed cookie at all
  // we fall through to the form so PBS can still reach it before COOKIE auth is
  // turned on. Non-holding signed users get 403.
  const cookieStore = cookies();
  const raw = cookieStore.get("workspace_session")?.value;

  if (raw) {
    const guard = await isHoldingAdmin();
    if (!guard.ok) {
      // Return a deliberate 403 instead of 404 — caller asked for that semantics.
      return (
        <div style={{ padding: 48, fontFamily: "Inter, system-ui, sans-serif", color: "var(--text-1, #ccc)" }}>
          <h1 style={{ fontSize: "var(--t-h2, 24px)", margin: 0 }}>403 — Forbidden</h1>
          <p style={{ marginTop: 12, color: "var(--text-2, #888)" }}>
            Only holding-level admins can invite new users.
          </p>
        </div>
      );
    }
  }

  let properties: Property[] = [];
  let depts: Dept[] = [];
  try {
    const opts = await loadOptions();
    properties = opts.properties;
    depts = opts.depts;
  } catch {
    // swallow — form still renders with empty option lists
  }

  // Detect host for the API call origin (works in preview + prod).
  const h = headers();
  const host = h.get("host") ?? "namkhan-bi.vercel.app";
  void host; // currently unused; reserved for absolute URL generation

  return (
    <main style={{ padding: "32px 48px", maxWidth: 720, margin: "0 auto", color: "var(--text-0, #f0f0f0)" }}>
      <div style={{
        fontSize: "var(--t-eyebrow, 11px)",
        letterSpacing: "0.15em",
        color: "var(--brass, #c4a36a)",
        textTransform: "uppercase",
        marginBottom: 4,
      }}>Settings · Users</div>
      <h1 style={{
        fontFamily: "Fraunces, Georgia, serif",
        fontStyle: "italic",
        fontSize: "var(--t-h1, 32px)",
        margin: "0 0 8px",
      }}>Invite user</h1>
      <p style={{ color: "var(--text-2, #888)", maxWidth: "60ch", margin: "0 0 24px" }}>
        Sends a Supabase Auth invitation email and creates the access row. Holding admins only.
      </p>

      <NewUserForm properties={properties} depts={depts} />

      <div style={{
        marginTop: 32,
        padding: 16,
        background: "var(--bg-2, #1a1a1a)",
        border: "1px solid var(--border-2, #2a2a2a)",
        borderRadius: 8,
        fontSize: "var(--t-sm, 12px)",
        color: "var(--text-2, #888)",
      }}>
        <strong style={{ color: "var(--text-1, #ccc)" }}>How scope is interpreted</strong>
        <ul style={{ margin: "8px 0 0 18px", padding: 0, lineHeight: 1.6 }}>
          <li><strong>Holding</strong> — leave hotels empty. Sees every property and every dept.</li>
          <li><strong>Property</strong> — pick one or more hotels. No dept restriction.</li>
          <li><strong>HOD</strong> — pick exactly one hotel and at least one dept.</li>
        </ul>
      </div>
    </main>
  );
}
