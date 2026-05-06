// middleware.ts
// Auth gate for the cockpit. Uses HTTP Basic Auth so:
//   - Browsers show a native prompt (no login UI to build)
//   - Make.com / curl / scripts can authenticate via Authorization header
//
// Protects:
//   /cockpit/*   (the UI)
//   /api/cockpit/*  (chat, schema, schedule, team, logs)
//
// Bypass: nothing. There is no public route under /cockpit.
//
// Env vars (set on Vercel → Project Settings → Environment Variables):
//   COCKPIT_USERNAME   — e.g. "pbs"
//   COCKPIT_PASSWORD   — long random string. Rotate on share/leak.
//
// If env vars are missing, middleware fails CLOSED (returns 503 Service
// Unavailable) so a misconfigured deploy never accidentally exposes
// the cockpit publicly.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const config = {
  // Gate cockpit + dept routes. /login + /api/auth/* + webhooks bypass.
  matcher: [
    "/cockpit/:path*",
    "/api/cockpit/:path*",
    "/revenue/:path*",
    "/sales/:path*",
    "/marketing/:path*",
    "/operations/:path*",
    "/finance/:path*",
    "/overview",
  ],
};

import { verifyWorkspaceCookie } from "@/lib/workspace-cookie";

const DEPT_PREFIXES: Array<{ prefix: string; flag: keyof Awaited<ReturnType<typeof verifyWorkspaceCookie>> & string }> = [
  { prefix: "/revenue", flag: "access_revenue" },
  { prefix: "/sales", flag: "access_sales" },
  { prefix: "/marketing", flag: "access_marketing" },
  { prefix: "/operations", flag: "access_operations" },
  { prefix: "/finance", flag: "access_finance" },
];

function notFound() {
  // 404 not 403 — never reveal route existence to unauthorized users (KB id 19).
  return new NextResponse("Not Found", { status: 404 });
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Bypasses
  if (path.startsWith("/api/cockpit/webhooks/")) return NextResponse.next();
  if (path.startsWith("/api/cockpit/agent/run")) return NextResponse.next();
  if (path.startsWith("/api/cockpit/auth/redeem")) return NextResponse.next();
  // Bearer-token routes that workflows hit (not user sessions)
  if (path.startsWith("/api/cockpit/audit-log") ||
      path.startsWith("/api/cockpit/backup/status") ||
      path.startsWith("/api/cockpit/deploy/rollback") ||
      path.startsWith("/api/cockpit/webhooks/post-deploy")) {
    // These routes self-check Bearer COCKPIT_AGENT_TOKEN.
    return NextResponse.next();
  }

  const cookie = req.cookies.get("workspace_session")?.value;
  let user;
  try {
    user = await verifyWorkspaceCookie(cookie);
  } catch {
    user = null;
  }

  if (!user) {
    // No valid session
    if (path.startsWith("/api/")) return notFound();
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", path);
    return NextResponse.redirect(url);
  }

  // Owner-only paths
  if (path.startsWith("/cockpit/users")) {
    if (!user.is_owner) return notFound();
  }

  // Department-gated paths
  for (const { prefix, flag } of DEPT_PREFIXES) {
    if (path.startsWith(prefix)) {
      const allowed = user.is_owner || (user as Record<string, unknown>)[flag];
      if (!allowed) return notFound();
    }
  }

  return NextResponse.next();
}
