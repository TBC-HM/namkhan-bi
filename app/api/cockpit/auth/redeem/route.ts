// app/api/cockpit/auth/redeem/route.ts
// Magic-link redeem endpoint. Public (no Basic Auth) so the phone can hit it.
// Validates the token (must be < 10 min old, not yet consumed), sets a
// 30-day cockpit_magic cookie, then redirects to /cockpit.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("t");
  if (!token) return new NextResponse("missing token", { status: 400 });

  const hash = crypto.createHash("sha256").update(token).digest("hex");

  // Look up the issuance — must exist and be < 10 min old.
  const { data: issuance } = await supabase
    .from("cockpit_audit_log")
    .select("id, created_at, metadata")
    .eq("agent", "auth")
    .eq("action", "magic_link_issued")
    .filter("metadata->>token_hash", "eq", hash)
    .order("created_at", { ascending: false })
    .limit(1);

  if (!issuance || issuance.length === 0) {
    return new NextResponse("invalid token", { status: 401 });
  }
  const ageMs = Date.now() - new Date(issuance[0].created_at).getTime();
  if (ageMs > 10 * 60 * 1000) {
    return new NextResponse("token expired", { status: 401 });
  }

  // Check not yet consumed.
  const { data: consumed } = await supabase
    .from("cockpit_audit_log")
    .select("id")
    .eq("agent", "auth")
    .eq("action", "magic_link_redeemed")
    .filter("metadata->>token_hash", "eq", hash)
    .limit(1);

  if (consumed && consumed.length > 0) {
    return new NextResponse("token already used", { status: 401 });
  }

  // Mark consumed.
  await supabase.from("cockpit_audit_log").insert({
    agent: "auth",
    action: "magic_link_redeemed",
    target: "/cockpit",
    success: true,
    metadata: { token_hash: hash, ua: req.headers.get("user-agent") ?? "" },
    reasoning: "magic link redeemed; setting 30-day cookie",
  });

  // Set cookie + redirect.
  const cookieValue = crypto.createHash("sha256")
    .update(`${hash}|${process.env.COCKPIT_PASSWORD}`)
    .digest("hex");

  const res = NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin}/cockpit`);
  res.cookies.set("cockpit_magic", cookieValue, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });
  return res;
}
