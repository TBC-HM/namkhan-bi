// app/api/auth/callback/route.ts
// GET — Supabase Auth redirects here after the user clicks the magic link.
// Verifies the session, sets a httpOnly workspace cookie, redirects to /.
//
// Author: PBS via Claude (Cowork) · 2026-05-06.

import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { signWorkspaceCookie } from "@/lib/workspace-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  noStore();
  const url = new URL(req.url);
  const code = url.searchParams.get("code") ?? url.searchParams.get("token");
  if (!code) {
    return NextResponse.redirect(`${url.origin}/login?error=missing_token`);
  }

  // Exchange the code for a session
  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: sessionData, error } = await userClient.auth.exchangeCodeForSession(code);
  if (error || !sessionData?.user?.email) {
    return NextResponse.redirect(`${url.origin}/login?error=invalid_token`);
  }

  const email = sessionData.user.email.toLowerCase().trim();

  // Re-verify against workspace_users (account could have been disabled between request + redeem)
  const { data: user } = await admin
    .from("workspace_users")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (!user || !user.active) {
    return NextResponse.redirect(`${url.origin}/login?error=access_revoked`);
  }

  // Update last_login_at
  await admin
    .from("workspace_users")
    .update({ last_login_at: new Date().toISOString() })
    .eq("email", email);

  // Sign the access bundle into the cookie payload (single DB lookup per session)
  const cookie = await signWorkspaceCookie({
    email,
    is_owner: !!user.is_owner,
    access_revenue: !!user.is_owner || !!user.access_revenue,
    access_sales: !!user.is_owner || !!user.access_sales,
    access_marketing: !!user.is_owner || !!user.access_marketing,
    access_operations: !!user.is_owner || !!user.access_operations,
    access_finance: !!user.is_owner || !!user.access_finance,
    iat: Math.floor(Date.now() / 1000),
  });

  await admin.from("cockpit_audit_log").insert({
    agent: "auth-callback",
    action: "login_success",
    target: email,
    success: true,
    metadata: { is_owner: user.is_owner },
    reasoning: "User completed magic-link flow. Workspace cookie set.",
  });

  const res = NextResponse.redirect(`${url.origin}/`);
  res.cookies.set("workspace_session", cookie, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
