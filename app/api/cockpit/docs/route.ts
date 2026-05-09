// app/api/cockpit/docs/route.ts
// Docs governance read endpoint — lists all 7 docs in both schemas + activity.

import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://build-placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "build-placeholder-key"
);

const DOC_ORDER = ["vision_roadmap", "prd", "architecture", "data_model", "api", "security", "integration"];
type DocRow = {
  id: string; doc_type: string; title: string; content_md: string;
  version: number; parent_version: number | null; status: string;
  last_updated_by: string | null; last_updated_at: string;
  locked_by: string | null; locked_at: string | null;
  requires_approval: boolean; auto_promoted: boolean; auto_promoted_at: string | null;
};

export async function GET() {
  noStore();
  const [stagingRes, prodRes, approvalsRes, promotionsRes, rollbacksRes] = await Promise.all([
    supabase.schema("documentation_staging" as never).from("documents").select("*"),
    supabase.schema("documentation" as never).from("documents").select("*"),
    supabase.schema("documentation_staging" as never).from("approvals")
      .select("id, document_id, staging_version, status, approver, approved_at, notes, created_at")
      .order("created_at", { ascending: false }).limit(100),
    supabase.schema("documentation" as never).from("promotion_log")
      .select("id, document_id, staging_version, production_version, promoted_by, promoted_at, promotion_type")
      .order("promoted_at", { ascending: false }).limit(50),
    supabase.schema("documentation" as never).from("rollback_log")
      .select("id, document_id, rolled_back_from_version, rolled_back_to_version, rolled_back_by, reason, rolled_back_at")
      .order("rolled_back_at", { ascending: false }).limit(50),
  ]);

  const staging = (stagingRes.data ?? []) as DocRow[];
  const production = (prodRes.data ?? []) as DocRow[];
  const approvals = approvalsRes.data ?? [];
  const promotions = promotionsRes.data ?? [];
  const rollbacks = rollbacksRes.data ?? [];

  const sBy = Object.fromEntries(staging.map((d) => [d.doc_type, d]));
  const pBy = Object.fromEntries(production.map((d) => [d.doc_type, d]));

  const docs = DOC_ORDER.map((dt) => {
    const s = sBy[dt];
    const p = pBy[dt];
    const recentlyAutoPromoted =
      p?.auto_promoted &&
      p?.auto_promoted_at &&
      Date.now() - new Date(p.auto_promoted_at).getTime() < 48 * 3600_000;
    return {
      doc_type: dt,
      title: s?.title ?? p?.title ?? dt,
      requires_approval: s?.requires_approval ?? p?.requires_approval ?? true,
      staging: s ? {
        version: s.version, status: s.status, last_updated_at: s.last_updated_at,
        last_updated_by: s.last_updated_by, locked_by: s.locked_by, locked_at: s.locked_at,
      } : null,
      production: p ? {
        version: p.version, status: p.status, last_updated_at: p.last_updated_at,
        last_updated_by: p.last_updated_by,
        auto_promoted: p.auto_promoted, auto_promoted_at: p.auto_promoted_at,
        recently_auto_promoted: recentlyAutoPromoted,
      } : null,
      pending_approval: !!s && s.status === "pending_approval",
    };
  });

  const pendingCount = docs.filter((d) => d.pending_approval).length;
  return NextResponse.json({
    docs,
    pending_approvals_count: pendingCount,
    recent_promotions: promotions,
    recent_rollbacks: rollbacks,
    recent_approvals: approvals,
  });
}
