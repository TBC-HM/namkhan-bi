// app/api/cockpit/docs/detail/route.ts
// GET /api/cockpit/docs/detail?doc_type=vision_roadmap
// Returns full content of staging + production + version history for one doc.

import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  noStore();
  const url = new URL(req.url);
  const docType = url.searchParams.get("doc_type");
  if (!docType) return NextResponse.json({ error: "doc_type required" }, { status: 400 });

  const [staging, production, stagingVers, prodVers] = await Promise.all([
    supabase.schema("documentation_staging" as never).from("documents").select("*").eq("doc_type", docType).maybeSingle(),
    supabase.schema("documentation" as never).from("documents").select("*").eq("doc_type", docType).maybeSingle(),
    supabase.schema("documentation_staging" as never).from("document_versions")
      .select("version, parent_version, change_summary, created_by, created_at")
      .order("version", { ascending: false }).limit(20),
    supabase.schema("documentation" as never).from("document_versions")
      .select("version, parent_version, change_summary, created_by, created_at, content_md")
      .order("version", { ascending: false }).limit(20),
  ]);

  return NextResponse.json({
    doc_type: docType,
    staging: staging.data ?? null,
    production: production.data ?? null,
    staging_versions: stagingVers.data ?? [],
    production_versions: prodVers.data ?? [],
  });
}
