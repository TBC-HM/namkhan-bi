// app/api/cockpit/docs/promote/route.ts
// POST /api/cockpit/docs/promote
// Body: { doc_type, action: "approve" | "reject" | "request_changes", notes?, staging_version }
// Owner-only operation (cockpit-authenticated). Calls documentation.promote_doc()
// for approve, otherwise updates staging status.

import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);

export async function POST(req: Request) {
  noStore();
  const body = await req.json().catch(() => ({}));
  const { doc_type, action, notes, staging_version } = body as {
    doc_type?: string; action?: string; notes?: string; staging_version?: number;
  };
  if (!doc_type) return NextResponse.json({ error: "doc_type required" }, { status: 400 });
  if (!["approve", "reject", "request_changes"].includes(action ?? "")) {
    return NextResponse.json({ error: "action must be approve|reject|request_changes" }, { status: 400 });
  }

  if (action === "approve") {
    if (typeof staging_version !== "number") return NextResponse.json({ error: "staging_version required" }, { status: 400 });
    const prodCurrent = await supabase.schema("documentation" as never).from("documents").select("version").eq("doc_type", doc_type).maybeSingle();
    const prodBefore = prodCurrent.data?.version ?? 0;
    const { data, error } = await supabase.schema("documentation" as never).rpc("promote_doc", {
      p_doc_type: doc_type,
      p_staging_version: staging_version,
      p_promoted_by: "PBS",
      p_promotion_type: "manual",
      p_approver: "PBS",
      p_notes: notes ?? null,
      p_expected_prod_version_before: prodBefore,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Mark approval row as approved.
    const sDoc = await supabase.schema("documentation_staging" as never).from("documents").select("id").eq("doc_type", doc_type).maybeSingle();
    if (sDoc.data) {
      await supabase.schema("documentation_staging" as never).from("approvals")
        .update({ status: "approved", approver: "PBS", approved_at: new Date().toISOString(), notes: notes ?? null })
        .eq("document_id", sDoc.data.id).eq("status", "pending");
    }
    return NextResponse.json({ ok: true, action: "approve", result: data });
  }

  if (action === "reject" || action === "request_changes") {
    const sDoc = await supabase.schema("documentation_staging" as never).from("documents").select("id").eq("doc_type", doc_type).maybeSingle();
    if (!sDoc.data) return NextResponse.json({ error: "staging doc not found" }, { status: 404 });
    await supabase.schema("documentation_staging" as never).from("documents").update({ status: "draft" }).eq("id", sDoc.data.id);
    await supabase.schema("documentation_staging" as never).from("approvals")
      .update({ status: "rejected", approver: "PBS", approved_at: new Date().toISOString(), notes: notes ?? action })
      .eq("document_id", sDoc.data.id).eq("status", "pending");
    return NextResponse.json({ ok: true, action });
  }

  return NextResponse.json({ error: "unhandled" }, { status: 400 });
}
