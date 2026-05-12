// middleware.ts
// Two layered concerns:
//   1. Auth gate (existing) — verifies workspace_session for /cockpit/*, /revenue/*, etc.
//      Currently in OPEN MODE per PBS 2026-05-07; enable via COCKPIT_AUTH_GATE=on.
//   2. Multi-tenant URL routing (new, ADR-024):
//      /h/[property_id]/...  -> resolves active property, sets cookie
//      /settings/*, /        -> redirects to /h/[cookie-or-default]/...
//
// Note: /p/[token]/ is RESERVED for public proposal sharing — multi-tenant
// routes live under /h/[property_id]/ to avoid collision.

import { NextResponse, type NextRequest } from "next/server";
import { verifyWorkspaceCookie } from "@/lib/workspace-cookie";

const PROPERTY_COOKIE = "tbc.active_property";
const DEFAULT_PROPERTY = 260955; // Namkhan

const STATIC_PATHS = ["/_next", "/api", "/favicon", "/static", "/images", "/fonts"];

// Routes gated by the auth-gate layer (only enforced when COCKPIT_AUTH_GATE=on)
const AUTH_GATED_PREFIXES = ["/cockpit", "/revenue", "/sales", "/marketing", "/operations", "/finance", "/overview"];

const DEPT_PREFIXES: Array<{ prefix: string; flag: string }> = [
  { prefix: "/revenue",    flag: "access_revenue" },
  { prefix: "/sales",      flag: "access_sales" },
  { prefix: "/marketing",  flag: "access_marketing" },
  { prefix: "/operations", flag: "access_operations" },
  { prefix: "/finance",    flag: "access_finance" },
];

function isStatic(p: string) {
  return STATIC_PATHS.some((s) => p.startsWith(s));
}

function notFound() {
  return new NextResponse("Not Found", { status: 404 });
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isStatic(pathname)) return NextResponse.next();

  // ===== LAYER 1: AUTH GATE (only when COCKPIT_AUTH_GATE=on) =====
  const gateOn = process.env.COCKPIT_AUTH_GATE === "on";
  const isAuthGated = AUTH_GATED_PREFIXES.some((p) => pathname.startsWith(p));

  if (gateOn && isAuthGated) {
    if (pathname.startsWith("/api/cockpit/webhooks/") ||
        pathname.startsWith("/api/cockpit/agent/run") ||
        pathname.startsWith("/api/cockpit/auth/redeem") ||
        pathname.startsWith("/api/cockpit/audit-log") ||
        pathname.startsWith("/api/cockpit/backup/status") ||
        pathname.startsWith("/api/cockpit/deploy/rollback") ||
        pathname.startsWith("/api/cockpit/webhooks/post-deploy") ||
        pathname.startsWith("/api/cockpit/chat")) {
      // continue to layer 2
    } else {
      const cookie = req.cookies.get("workspace_session")?.value;
      let user: Awaited<ReturnType<typeof verifyWorkspaceCookie>> | null = null;
      try { user = await verifyWorkspaceCookie(cookie); } catch { user = null; }

      if (!user) {
        if (pathname.startsWith("/api/")) return notFound();
        const url = req.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("from", pathname);
        return NextResponse.redirect(url);
      }

      if (pathname.startsWith("/cockpit/users") && !(user as { is_owner?: boolean }).is_owner) {
        return notFound();
      }

      for (const { prefix, flag } of DEPT_PREFIXES) {
        if (pathname.startsWith(prefix)) {
          const u = user as Record<string, unknown>;
          const allowed = (u.is_owner === true) || (u[flag] === true);
          if (!allowed) return notFound();
        }
      }
    }
  }

  // ===== LAYER 2: MULTI-TENANT ROUTING =====

  // Case A: URL already has /h/[id]/... — set cookie, continue
  const propertyMatch = pathname.match(/^\/h\/(\d+)(\/.*)?$/);
  if (propertyMatch) {
    const propertyId = propertyMatch[1];
    const res = NextResponse.next();
    res.cookies.set(PROPERTY_COOKIE, propertyId, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 90,
    });
    return res;
  }

  // Case B: Legacy /settings/* or / — redirect to /h/[active]/...
  if (pathname.startsWith("/settings") || pathname === "/") {
    const cookieValue = req.cookies.get(PROPERTY_COOKIE)?.value;
    const activeProperty = cookieValue ?? String(DEFAULT_PROPERTY);
    const url = req.nextUrl.clone();
    url.pathname = pathname === "/" ? `/h/${activeProperty}` : `/h/${activeProperty}${pathname}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
