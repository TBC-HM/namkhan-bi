// app/revenue/engine/page.tsx
// Engine Revenue — entry page (Phase 3 Stage 2). Middleware (workspace_users)
// has already gated /revenue/* to is_owner OR access_revenue=true.
// MOCK DATA — Stage 3 (Cloudbeds wiring) is deferred.
// Existing 23 dashboards live untouched at /revenue/pulse, /revenue/compset, etc.

export const dynamic = "force-dynamic";

const VIEWS: Array<{ slug: string; label: string; src: string; description: string }> = [
  { slug: "entry", label: "Entry", src: "/_engine_prototypes/rm_entry_v2.html", description: "Prompt + 2 alerts" },
  { slug: "workspace", label: "Workspace", src: "/_engine_prototypes/rm_workspace_v3.html", description: "Conversation + agents + data view" },
  { slug: "report", label: "Report", src: "/_engine_prototypes/rm_report.html", description: "Focused report (single metric, time selector)" },
  { slug: "dashboard", label: "Dashboard", src: "/_engine_prototypes/rm_dashboard.html", description: "Weekly / Monthly / Annual" },
];

export default function EngineRevenueEntryPage({ searchParams }: { searchParams: { view?: string } }) {
  const slug = (searchParams?.view ?? "entry").toLowerCase();
  const v = VIEWS.find((x) => x.slug === slug) ?? VIEWS[0];

  return (
    <div style={{ background: "#0a0a0b", minHeight: "100vh", color: "#ededf0", fontFamily: "system-ui, sans-serif" }}>
      <div style={{
        background: "rgba(199,154,107,0.12)",
        borderBottom: "1px solid rgba(199,154,107,0.5)",
        padding: "10px 24px",
        color: "#c79a6b",
        fontSize: 11,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        display: "flex",
        gap: 16,
        alignItems: "center",
        flexWrap: "wrap",
      }}>
        <span>⚠ Engine Revenue · Phase 3 Stage 2 · MOCK DATA · Cloudbeds wiring deferred to Stage 3</span>
        <span style={{ flex: 1 }} />
        {VIEWS.map((x) => (
          <a key={x.slug}
             href={`/revenue/engine?view=${x.slug}`}
             style={{
               color: x.slug === v.slug ? "#0a0a0b" : "#c79a6b",
               background: x.slug === v.slug ? "#c79a6b" : "transparent",
               padding: "4px 10px", borderRadius: 4,
               textDecoration: "none", fontSize: 10, letterSpacing: "0.1em",
             }}>{x.label}</a>
        ))}
      </div>
      <iframe
        src={v.src}
        title={`Engine ${v.label}`}
        style={{ width: "100%", height: "calc(100vh - 40px)", border: "none", display: "block" }}
      />
    </div>
  );
}
