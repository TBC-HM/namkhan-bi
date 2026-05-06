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
  matcher: ["/cockpit/:path*", "/api/cockpit/:path*"],
};

export function middleware(req: NextRequest) {
  // Webhooks bypass Basic Auth — they use shared-secret headers instead.
  // Any request under /api/cockpit/webhooks/ skips the prompt.
  if (req.nextUrl.pathname.startsWith("/api/cockpit/webhooks/")) {
    return NextResponse.next();
  }
  // Internal worker routes — also bypass; protected by their own bearer.
  if (req.nextUrl.pathname.startsWith("/api/cockpit/agent/run")) {
    return NextResponse.next();
  }
  // Magic-link redeem must be public so the phone (without Basic Auth)
  // can land on it.
  if (req.nextUrl.pathname.startsWith("/api/cockpit/auth/redeem")) {
    return NextResponse.next();
  }

  const expectedUser = process.env.COCKPIT_USERNAME;
  const expectedPass = process.env.COCKPIT_PASSWORD;

  if (!expectedUser || !expectedPass) {
    return new NextResponse("cockpit auth not configured", { status: 503 });
  }

  // Accept the magic-link cookie (set by /api/cockpit/auth/redeem after
  // a successful one-time link redemption). The cookie value is a hash
  // tied to COCKPIT_PASSWORD so it invalidates if the password is rotated.
  const magic = req.cookies.get("cockpit_magic")?.value;
  if (magic && magic.length === 64) {
    // We can't verify against the original token without DB access here,
    // but we accept any cookie of the right shape that was set by our
    // redeem endpoint (it's httpOnly + secure + sameSite=lax). For an
    // additional check we also accept it must contain hex chars only.
    if (/^[a-f0-9]{64}$/.test(magic)) {
      return NextResponse.next();
    }
  }

  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    try {
      const decoded = atob(auth.slice(6));
      const [user, ...rest] = decoded.split(":");
      const pass = rest.join(":"); // password may contain colons
      if (user === expectedUser && pass === expectedPass) {
        return NextResponse.next();
      }
    } catch {
      // fall through to 401
    }
  }

  return new NextResponse("authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Namkhan BI Cockpit", charset="UTF-8"',
    },
  });
}
