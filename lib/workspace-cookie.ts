// lib/workspace-cookie.ts
// Sign + verify the workspace_session cookie payload.
// HMAC-SHA256 over base64url(JSON). Cookie format: <payload>.<sig>
//
// Why: avoid a DB lookup per request. The cookie carries the access flags
// signed with COOKIE_SECRET so middleware can trust them without re-querying
// workspace_users on every page load. Refresh the cookie when admin updates
// the row (or accept up to 30-day staleness — admin can flip active=false
// to instantly revoke since middleware re-checks active on cookie verify).

import crypto from "node:crypto";

export type WorkspacePayload = {
  email: string;
  is_owner: boolean;
  access_revenue: boolean;
  access_sales: boolean;
  access_marketing: boolean;
  access_operations: boolean;
  access_finance: boolean;
  iat: number; // issued-at seconds
};

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Buffer {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function getSecret(): Buffer {
  // Reuse CRON_SECRET / COCKPIT_PASSWORD as fallback, but prefer dedicated.
  const s = process.env.COOKIE_SECRET || process.env.COCKPIT_AGENT_TOKEN || "";
  if (!s || s.length < 16) {
    throw new Error("COOKIE_SECRET (or COCKPIT_AGENT_TOKEN fallback) not set or too short");
  }
  return Buffer.from(s, "utf8");
}

export function signWorkspaceCookie(p: WorkspacePayload): string {
  const json = JSON.stringify(p);
  const payload = b64url(Buffer.from(json, "utf8"));
  const sig = b64url(crypto.createHmac("sha256", getSecret()).update(payload).digest());
  return `${payload}.${sig}`;
}

export function verifyWorkspaceCookie(cookie: string | undefined): WorkspacePayload | null {
  if (!cookie || !cookie.includes(".")) return null;
  const [payload, sig] = cookie.split(".");
  if (!payload || !sig) return null;
  let expected: string;
  try {
    expected = b64url(crypto.createHmac("sha256", getSecret()).update(payload).digest());
  } catch {
    return null;
  }
  // Constant-time compare
  if (expected.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff !== 0) return null;
  try {
    const obj = JSON.parse(fromB64url(payload).toString("utf8")) as WorkspacePayload;
    if (typeof obj.email !== "string") return null;
    return obj;
  } catch {
    return null;
  }
}
