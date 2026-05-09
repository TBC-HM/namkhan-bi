// app/api/cockpit/auth/magic-link/route.ts
// Generates a one-time magic-link URL. Caller must already be authenticated
// (Basic Auth via middleware). The link, when visited, sets a 30-day cookie
// `cockpit_magic` that the middleware accepts in lieu of Basic Auth — useful
// on mobile where Basic prompts every reload.
//
// GET → returns { url, expires_at }

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://build-placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "build-placeholder-key"
);

export async function GET(req: Request) {
  // The middleware already required Basic Auth before reaching this route
  // (auth path /api/cockpit/auth/magic-link is NOT in the bypass list).
  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min to redeem

  await supabase.from("cockpit_audit_log").insert({
    agent: "auth",
    action: "magic_link_issued",
    target: "/cockpit",
    success: true,
    metadata: { token_hash: crypto.createHash("sha256").update(token).digest("hex"), expires_at: expiresAt },
    reasoning: "magic link generated for mobile login",
  });

  // Persist the hash so the redeem endpoint can validate without us needing
  // to keep state in the JWT. We use the audit_log itself as a lightweight
  // store — token is single-use because we mark it consumed by inserting
  // a 'magic_link_redeemed' row matching the hash.

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;
  const url = `${base}/api/cockpit/auth/redeem?t=${token}`;
  return NextResponse.json({ url, expires_at: expiresAt });
}
