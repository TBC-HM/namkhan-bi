// app/cockpit/docs-registry/page.tsx
// Three-pillar documentation registry:
//   1. Knowledge Base (cockpit_knowledge_base)  — internal rules + protocols
//   2. Product Documentation (documentation)    — 7-doc governed product specs (Phase 1B placeholder)
//   3. Reference Library (reference_sources)    — external system docs (Phase 1A — this PR)
//
// Author: PBS via Claude (Cowork) · 2026-05-06.

import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://build-placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || "build-placeholder-key")
);

type RefSource = {
  id: string;
  system_name: string;
  category: string;
  canonical_url: string;
  last_verified_at: string | null;
  staleness_days_threshold: number;
  status: string;
  owner_agent: string | null;
  notes: string | null;
};

const EMPTY = "—";

function isoDate(s: string | null): string {
  if (!s) return EMPTY;
  return s.slice(0, 10);
}

function stalenessBadge(
  lastVerifiedAt: string | null,
  thresholdDays: number
): { label: string; tone: "green" | "amber" | "red" } {
  if (!lastVerifiedAt) return { label: "NEVER VERIFIED", tone: "red" };
  const ageMs = Date.now() - new Date(lastVerifiedAt).getTime();
  const ageDays = ageMs / 86_400_000;
  if (ageDays < thresholdDays / 2) return { label: `${Math.round(ageDays)}D`, tone: "green" };
  if (ageDays < thresholdDays) return { label: `${Math.round(ageDays)}D`, tone: "amber" };
  return { label: `${Math.round(ageDays)}D — STALE`, tone: "red" };
}

async function loadKbCount(): Promise<number> {
  const { count } = await supabase
    .from("cockpit_knowledge_base")
    .select("id", { count: "exact", head: true })
    .eq("active", true);
  return count ?? 0;
}

async function loadProductDocs(): Promise<{ doc_type: string; status: string; chars: number }[]> {
  const { data } = await supabase
    .schema("documentation" as never)
    .from("documents")
    .select("doc_type, status, content_md");
  return (data ?? []).map((r: { doc_type: string; status: string; content_md: string }) => ({
    doc_type: r.doc_type,
    status: r.status,
    chars: (r.content_md ?? "").length,
  }));
}

async function loadReferenceSources(): Promise<RefSource[]> {
  const { data } = await supabase
    .from("reference_sources")
    .select(
      "id, system_name, category, canonical_url, last_verified_at, staleness_days_threshold, status, owner_agent, notes"
    )
    .eq("status", "active")
    .order("category")
    .order("system_name");
  return (data ?? []) as RefSource[];
}

export default async function DocsRegistryPage() {
  noStore();

  const [kbCount, productDocs, refSources] = await Promise.all([
    loadKbCount(),
    loadProductDocs(),
    loadReferenceSources(),
  ]);

  const refByCategory = refSources.reduce<Record<string, RefSource[]>>((acc, r) => {
    (acc[r.category] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div style={{ padding: "2rem 3rem", maxWidth: "1280px", margin: "0 auto" }}>
      <div
        style={{
          fontSize: "var(--t-xs)",
          letterSpacing: "var(--ls-extra)",
          color: "var(--brass)",
          textTransform: "uppercase",
        }}
      >
        Cockpit · Documentation
      </div>
      <h1
        style={{
          fontFamily: "var(--font-fraunces, Georgia), serif",
          fontStyle: "italic",
          fontSize: "var(--t-3xl)",
          margin: "0.25rem 0 0.5rem",
        }}
      >
        Docs Registry
      </h1>
      <p style={{ color: "var(--text-2)", maxWidth: "60ch", margin: 0 }}>
        Three documentation pillars in one place — knowledge, product specs, external references.
      </p>

      {/* SECTION A — Knowledge Base */}
      <section style={{ marginTop: "2.5rem" }}>
        <h2
          style={{
            fontSize: "var(--t-xs)",
            letterSpacing: "var(--ls-extra)",
            color: "var(--brass)",
            textTransform: "uppercase",
            margin: "0 0 0.5rem",
          }}
        >
          A · Knowledge Base
        </h2>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "1rem",
            padding: "1rem 1.25rem",
            background: "var(--surface-1, #f6f3ee)",
            borderRadius: "8px",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-fraunces, Georgia), serif",
              fontStyle: "italic",
              fontSize: "var(--t-2xl)",
            }}
          >
            {kbCount}
          </span>
          <span style={{ color: "var(--text-2)" }}>active entries</span>
          <span style={{ flex: 1 }} />
          <Link href="/cockpit?tab=knowledge" style={{ color: "var(--brass)" }}>
            View full KB →
          </Link>
        </div>
      </section>

      {/* SECTION B — Product Documentation */}
      <section style={{ marginTop: "2rem" }}>
        <h2
          style={{
            fontSize: "var(--t-xs)",
            letterSpacing: "var(--ls-extra)",
            color: "var(--brass)",
            textTransform: "uppercase",
            margin: "0 0 0.5rem",
          }}
        >
          B · Product Documentation (7 docs)
        </h2>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-1, #ddd)" }}>
              <th style={thStyle}>Doc</th>
              <th style={thStyle}>Status</th>
              <th style={thStyleRight}>Length</th>
            </tr>
          </thead>
          <tbody>
            {productDocs.map((d) => (
              <tr key={d.doc_type} style={{ borderBottom: "1px solid var(--border-2, #f0ece5)" }}>
                <td style={tdStyle}>{d.doc_type.replace("_", " ")}</td>
                <td style={tdStyle}>{d.status}</td>
                <td style={tdStyleRight}>
                  {d.chars > 100 ? `${d.chars.toLocaleString()} chars` : EMPTY}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ color: "var(--text-3)", fontSize: "var(--t-sm)", marginTop: "0.5rem" }}>
          Phase 1B will populate the empty stubs. Documentarian (Scribe Scott) owns the writes.
        </p>
      </section>

      {/* SECTION C — Reference Library */}
      <section style={{ marginTop: "2rem" }}>
        <h2
          style={{
            fontSize: "var(--t-xs)",
            letterSpacing: "var(--ls-extra)",
            color: "var(--brass)",
            textTransform: "uppercase",
            margin: "0 0 0.5rem",
          }}
        >
          C · Reference Library — external systems ({refSources.length})
        </h2>
        {Object.entries(refByCategory).map(([cat, rows]) => (
          <div key={cat} style={{ marginBottom: "1.5rem" }}>
            <div
              style={{
                fontSize: "var(--t-xs)",
                letterSpacing: "var(--ls-extra)",
                color: "var(--text-3)",
                textTransform: "uppercase",
                marginBottom: "0.5rem",
              }}
            >
              {cat}
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-1, #ddd)" }}>
                  <th style={thStyle}>System</th>
                  <th style={thStyle}>Last verified</th>
                  <th style={thStyle}>Staleness</th>
                  <th style={thStyle}>Owner</th>
                  <th style={thStyle}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const badge = stalenessBadge(r.last_verified_at, r.staleness_days_threshold);
                  const badgeColor =
                    badge.tone === "green"
                      ? "var(--good, #2a7d2e)"
                      : badge.tone === "amber"
                      ? "var(--warn, #b07a00)"
                      : "var(--bad, #b3261e)";
                  return (
                    <tr
                      key={r.id}
                      style={{ borderBottom: "1px solid var(--border-2, #f0ece5)" }}
                    >
                      <td style={tdStyle}>
                        <a href={r.canonical_url} target="_blank" rel="noopener noreferrer">
                          {r.system_name}
                        </a>
                      </td>
                      <td style={tdStyle}>{isoDate(r.last_verified_at)}</td>
                      <td style={{ ...tdStyle, color: badgeColor, fontWeight: 600 }}>
                        {badge.label}
                      </td>
                      <td style={tdStyle}>{r.owner_agent ?? EMPTY}</td>
                      <td style={{ ...tdStyle, color: "var(--text-2)" }}>{r.notes ?? EMPTY}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </section>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "0.5rem 0.75rem",
  fontSize: "var(--t-xs)",
  letterSpacing: "var(--ls-extra)",
  color: "var(--brass)",
  textTransform: "uppercase",
  fontWeight: 600,
};
const thStyleRight: React.CSSProperties = { ...thStyle, textAlign: "right" };
const tdStyle: React.CSSProperties = {
  padding: "0.5rem 0.75rem",
  fontSize: "var(--t-sm)",
};
const tdStyleRight: React.CSSProperties = { ...tdStyle, textAlign: "right" };
