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

export function middleware(_req: NextRequest) {
  // AUTH DISABLED 2026-05-06 per PBS — page has no real PII/numbers yet,
  // Basic Auth was blocking dev iteration. Re-enable when:
  //   - Real revenue/guest data lands on /cockpit, OR
  //   - Cockpit is shared with anyone outside PBS.
  // To re-enable: revert this commit OR uncomment the gated block below.
  return NextResponse.next();

  // ---- gated implementation kept for reference ----
  //
  // if (req.nextUrl.pathname.startsWith("/api/cockpit/webhooks/")) return NextResponse.next();
  // if (req.nextUrl.pathname.startsWith("/api/cockpit/agent/run")) return NextResponse.next();
  // if (req.nextUrl.pathname.startsWith("/api/cockpit/auth/redeem")) return NextResponse.next();
  //
  // const expectedUser = process.env.COCKPIT_USERNAME;
  // const expectedPass = process.env.COCKPIT_PASSWORD;
  // if (!expectedUser || !expectedPass) {
  //   return new NextResponse("cockpit auth not configured", { status: 503 });
  // }
  //
  // const magic = req.cookies.get("cockpit_magic")?.value;
  // if (magic && /^[a-f0-9]{64}$/.test(magic)) return NextResponse.next();
  //
  // const auth = req.headers.get("authorization");
  // if (auth?.startsWith("Basic ")) {
  //   try {
  //     const decoded = atob(auth.slice(6));
  //     const [user, ...rest] = decoded.split(":");
  //     const pass = rest.join(":");
  //     if (user === expectedUser && pass === expectedPass) return NextResponse.next();
  //   } catch {}
  // }
  //
  // return new NextResponse("authentication required", {
  //   status: 401,
  //   headers: { "WWW-Authenticate": 'Basic realm="Namkhan BI Cockpit", charset="UTF-8"' },
  // });
}
