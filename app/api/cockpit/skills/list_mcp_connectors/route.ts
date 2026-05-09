// app/api/cockpit/skills/list_mcp_connectors/route.ts
// COWORK BRIEF v2 / GAP 9 — discovery for connector availability + auth status.
//
// Returns array of integrations the cockpit knows about, with auth_status from
// env-var presence + (where cheap) a minimal API probe. Used by HoDs / Architect
// when a task hits a capability gap.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Connector = {
  name: string;
  scopes: string[];
  auth_status: "connected" | "requires_oauth" | "misconfigured" | "unknown";
  last_check_at: string;
  detail?: string;
  auth_url?: string;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);

function isAuthorized(req: Request): boolean {
  if (process.env.COCKPIT_AUTH_GATE !== "on") return true;
  const auth = req.headers.get("authorization") ?? "";
  return auth.startsWith("Bearer ") && auth.slice(7) === process.env.COCKPIT_AGENT_TOKEN;
}

async function probeVercel(token: string | undefined): Promise<Connector> {
  const now = new Date().toISOString();
  if (!token) return { name: "vercel", scopes: ["projects:read","deployments:write","env:write"], auth_status: "misconfigured", last_check_at: now, detail: "VERCEL_TOKEN env var missing" };
  try {
    const r = await fetch("https://api.vercel.com/v2/user", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (r.ok) return { name: "vercel", scopes: ["projects:read","deployments:write","env:write"], auth_status: "connected", last_check_at: now };
    return { name: "vercel", scopes: ["projects:read","deployments:write","env:write"], auth_status: "misconfigured", last_check_at: now, detail: `vercel api ${r.status}` };
  } catch (e) {
    return { name: "vercel", scopes: [], auth_status: "misconfigured", last_check_at: now, detail: e instanceof Error ? e.message : String(e) };
  }
}

async function probeGithub(token: string | undefined): Promise<Connector> {
  const now = new Date().toISOString();
  if (!token) return { name: "github", scopes: ["repo:write","issues:write"], auth_status: "misconfigured", last_check_at: now, detail: "GITHUB_TOKEN env var missing" };
  try {
    const r = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${token}`, "User-Agent": "namkhan-cockpit" },
      cache: "no-store",
    });
    if (r.ok) {
      const scopes = (r.headers.get("x-oauth-scopes") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      return { name: "github", scopes, auth_status: "connected", last_check_at: now };
    }
    return { name: "github", scopes: ["repo","issues"], auth_status: "misconfigured", last_check_at: now, detail: `github api ${r.status}` };
  } catch (e) {
    return { name: "github", scopes: [], auth_status: "misconfigured", last_check_at: now, detail: e instanceof Error ? e.message : String(e) };
  }
}

async function probeSupabase(): Promise<Connector> {
  const now = new Date().toISOString();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { name: "supabase", scopes: [], auth_status: "misconfigured", last_check_at: now, detail: "URL or SERVICE_ROLE_KEY missing" };
  try {
    const { error } = await supabase.from("cockpit_audit_log").select("id").limit(1);
    if (error) return { name: "supabase", scopes: [], auth_status: "misconfigured", last_check_at: now, detail: error.message };
    return { name: "supabase", scopes: ["sql:write","storage:rw","rpc:call"], auth_status: "connected", last_check_at: now };
  } catch (e) {
    return { name: "supabase", scopes: [], auth_status: "misconfigured", last_check_at: now, detail: e instanceof Error ? e.message : String(e) };
  }
}

function probeEnvOnly(name: string, varName: string, scopes: string[], note?: string): Connector {
  const now = new Date().toISOString();
  if (process.env[varName]) return { name, scopes, auth_status: "connected", last_check_at: now, detail: note };
  return { name, scopes, auth_status: "misconfigured", last_check_at: now, detail: `${varName} env var missing${note ? `; ${note}` : ""}` };
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const t0 = Date.now();
  const connectors: Connector[] = await Promise.all([
    probeVercel(process.env.VERCEL_TOKEN),
    probeGithub(process.env.GITHUB_TOKEN),
    probeSupabase(),
    Promise.resolve(probeEnvOnly("anthropic", "ANTHROPIC_API_KEY", ["claude:inference"])),
    Promise.resolve(probeEnvOnly("openai", "OPENAI_API_KEY", ["embeddings"], "used by embed-kb edge function only")),
    Promise.resolve(probeEnvOnly("cloudbeds", "CLOUDBEDS_CLIENT_ID", ["pms:read","pms:write"], "OAuth flow handled in Edge Function")),
    Promise.resolve(probeEnvOnly("make_com", "MAKE_WEBHOOK_TOKEN", ["webhook:trigger"], "scenarios fired via webhook URL")),
    Promise.resolve(probeEnvOnly("nimble", "NIMBLE_API_KEY", ["scrape:read"], "comp-set scraper")),
    Promise.resolve(probeEnvOnly("gmail_oauth", "GMAIL_CLIENT_ID", ["gmail.readonly","gmail.send"], "pb@ only currently")),
  ]);

  // GET = same payload (read-only convenience)
  await supabase.from("cockpit_audit_log").insert({
    agent: "skill-mcp-discovery",
    action: "list_mcp_connectors",
    target: "cockpit",
    success: true,
    duration_ms: Date.now() - t0,
    metadata: {
      counts: {
        connected: connectors.filter((c) => c.auth_status === "connected").length,
        misconfigured: connectors.filter((c) => c.auth_status === "misconfigured").length,
      },
    },
    reasoning: `Probed ${connectors.length} connectors.`,
  });

  return NextResponse.json({ ok: true, connectors });
}

export async function GET(req: Request) {
  return POST(req);
}
