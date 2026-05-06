// app/api/auth/login/route.ts
// POST { email } — sends Supabase Auth magic link IF email is in workspace_users
// AND active=true. Always returns 200 with neutral message (no enumeration).
//
// Author: PBS via Claude (Cowork) · 2026-05-06.

import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const NEUTRAL = "If this email is allowed, a sign-in link has been sent. Check your inbox.";

function emailHash(email: string): string {
  // Simple non-cryptographic hash for audit logging — don't store raw emails in audit.
  let h = 0;
  for (let i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) | 0;
  return `hash_${(h >>> 0).toString(16)}`;
}

export async function POST(req: Request) {
  noStore();
  const body = await req.json().catch(() => ({}));
  const raw = (body?.email ?? "").toString().trim().toLowerCase();
  if (!raw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
    // Even on bad format, return neutral to prevent probing.
    return NextResponse.json({ ok: true, message: NEUTRAL });
  }

  const { data: user } = await admin
    .from("workspace_users")
    .select("email, active")
    .eq("email", raw)
    .maybeSingle();

  // Always log the attempt (hashed email, not raw)
  await admin.from("cockpit_audit_log").insert({
    agent: "auth-login",
    action: "login_requested",
    target: emailHash(raw),
    success: !!(user && user.active),
    metadata: { in_workspace_users: !!user, active: user?.active ?? false },
    reasoning: "Magic-link request. Generic 200 returned regardless of result.",
  });

  if (!user || !user.active) {
    // Indistinguishable from success path — no enumeration
    return NextResponse.json({ ok: true, message: NEUTRAL });
  }

  // Send magic link via Supabase Auth
  const origin = req.headers.get("origin") ?? "https://namkhan-bi.vercel.app";
  const redirectTo = `${origin}/api/auth/callback`;

  const { error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: raw,
    options: { redirectTo },
  });

  if (error) {
    // Still return neutral, but log internal failure
    await admin.from("cockpit_audit_log").insert({
      agent: "auth-login",
      action: "magiclink_generate_failed",
      target: emailHash(raw),
      success: false,
      metadata: { error: error.message },
      reasoning: "Supabase Auth generateLink errored.",
    });
    return NextResponse.json({ ok: true, message: NEUTRAL });
  }

  // The Supabase admin generateLink doesn't auto-send the email — it returns the
  // link payload. For v1, also call signInWithOtp to trigger the actual send.
  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  await userClient.auth.signInWithOtp({
    email: raw,
    options: { emailRedirectTo: redirectTo },
  });

  return NextResponse.json({ ok: true, message: NEUTRAL });
}
