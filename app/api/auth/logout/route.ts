// app/api/auth/logout/route.ts
// POST or GET — clears the workspace_session cookie + redirects to /login.

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function handle(req: Request) {
  const url = new URL(req.url);
  const res = NextResponse.redirect(`${url.origin}/login`);
  res.cookies.set("workspace_session", "", { path: "/", maxAge: 0 });
  return res;
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
