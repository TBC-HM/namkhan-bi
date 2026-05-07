// components/engine/EngineDashboard.tsx
// Shared engine-style department dashboard. Mirrors rm_dashboard.html visual:
// dark bg, brass accent, snap headline, KPI grid, panels.
// Driven entirely by the cfg passed in — no hardcoded data.
//
// Author: PBS via Claude (Cowork) · 2026-05-07.

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type EngineKpi = {
  label: string;
  view: string;        // public.<view>
  column: string;
  format?: "usd" | "lak" | "pct" | "int" | "pp" | "k";
  filter?: { col: string; eq: unknown };
  delta?: { ly_col?: string; bud_col?: string };
};

export type EnginePanel = {
  title: string;
  view: string;
  columns: Array<{ key: string; label: string; format?: EngineKpi["format"] }>;
  limit?: number;
  order_by?: { col: string; ascending?: boolean };
};

export type EngineConfig = {
  dept_label: string;            // "Revenue", "Sales", etc.
  hod_role: string;              // 'revenue_hod' etc.
  hod_display_name: string;
  scope: string;                 // "Today, MTD, YTD"
  kpis: EngineKpi[];             // 4-8 tiles
  panels: EnginePanel[];         // 2-4 panels
  chat_route: string;            // "/api/cockpit/chat" with role hint
};

function fmt(v: unknown, kind?: EngineKpi["format"]): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "string" ? Number(v) : (v as number);
  if (typeof n !== "number" || Number.isNaN(n)) return String(v);
  switch (kind) {
    case "usd":  return n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(0)}`;
    case "lak":  return `₭${n.toLocaleString()}`;
    case "pct":  return `${n.toFixed(1)}%`;
    case "pp":   return `${n >= 0 ? "+" : ""}${n.toFixed(1)}pp`;
    case "k":    return `${(n / 1000).toFixed(1)}k`;
    case "int":  return n.toLocaleString();
    default:     return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
}

async function fetchKpi(k: EngineKpi): Promise<{ value: unknown; ly?: unknown; bud?: unknown }> {
  let q = supabase.from(k.view).select("*").limit(1);
  if (k.filter) q = q.eq(k.filter.col, k.filter.eq);
  const { data } = await q;
  const row = (data ?? [])[0] as Record<string, unknown> | undefined;
  if (!row) return { value: null };
  return {
    value: row[k.column],
    ly: k.delta?.ly_col ? row[k.delta.ly_col] : undefined,
    bud: k.delta?.bud_col ? row[k.delta.bud_col] : undefined,
  };
}

async function fetchPanel(p: EnginePanel): Promise<Array<Record<string, unknown>>> {
  let q = supabase.from(p.view).select(p.columns.map((c) => c.key).join(","));
  if (p.order_by) q = q.order(p.order_by.col, { ascending: p.order_by.ascending ?? false });
  q = q.limit(p.limit ?? 10);
  const { data, error } = await q;
  if (error || !data) return [];
  return data as unknown as Array<Record<string, unknown>>;
}

export default async function EngineDashboard({ cfg }: { cfg: EngineConfig }) {
  const kpiPromises = cfg.kpis.map(fetchKpi);
  const panelPromises = cfg.panels.map(fetchPanel);
  const [kpiRows, panelRows] = await Promise.all([
    Promise.all(kpiPromises),
    Promise.all(panelPromises),
  ]);

  return (
    <div style={S.body}>
      {/* TOP BAR */}
      <div style={S.topbar}>
        <div style={S.logo}>
          <div style={S.logoMark}>N</div>
          <span>The Namkhan · <b>{cfg.dept_label}</b></span>
        </div>
        <div style={S.topbarRight}>
          <a href="/cockpit" style={S.topBtn}>cockpit</a>
          <a href={`/cockpit?role=${encodeURIComponent(cfg.hod_role)}`} style={{ ...S.topBtn, ...S.cta }}>
            ask {cfg.hod_display_name} ↗
          </a>
        </div>
      </div>

      {/* SNAP */}
      <div style={S.snap}>
        <div style={S.snapHeadline}>
          <em>{cfg.dept_label}</em> · {cfg.scope}
        </div>
        <div style={S.snapMeta}>
          live · {new Date().toISOString().slice(0, 16).replace("T", " ")} · sourced from Supabase views (no mocks)
        </div>
      </div>

      {/* KPI GRID */}
      <div style={S.kpiSection}>
        <div style={S.panelLabel}>Key indicators</div>
        <div style={{ ...S.kpiGrid, gridTemplateColumns: `repeat(${Math.min(cfg.kpis.length, 4)}, 1fr)` }}>
          {cfg.kpis.map((k, i) => {
            const row = kpiRows[i];
            return (
              <div key={k.label} style={S.kpiTile}>
                <div style={S.kpiLabel}>{k.label}</div>
                <div style={S.kpiValue}>{fmt(row.value, k.format)}</div>
                {(row.ly !== undefined || row.bud !== undefined) && (
                  <div style={S.kpiDeltas}>
                    {row.ly !== undefined && <span>LY {fmt(row.ly, k.format)}</span>}
                    {row.bud !== undefined && <span>Bud {fmt(row.bud, k.format)}</span>}
                  </div>
                )}
                <div style={S.kpiSrc}>{k.view}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* PANELS */}
      {cfg.panels.map((p, pi) => {
        const rows = panelRows[pi];
        return (
          <div key={p.title} style={S.panelSection}>
            <div style={S.panelLabel}>{p.title} · {p.view}</div>
            {rows.length === 0 ? (
              <div style={S.empty}>— no rows from {p.view} —</div>
            ) : (
              <table style={S.table}>
                <thead>
                  <tr>{p.columns.map((c) => <th key={c.key} style={S.th}>{c.label}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.map((row, ri) => (
                    <tr key={ri} style={S.tr}>
                      {p.columns.map((c) => (
                        <td key={c.key} style={S.td}>{fmt(row[c.key], c.format)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}

      <div style={S.footer}>
        Engine · {cfg.dept_label} · HoD <b>{cfg.hod_display_name}</b> ({cfg.hod_role}) ·{" "}
        <a href="/cockpit" style={{ color: "#c79a6b" }}>open cockpit</a>
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  body: { background: "#0a0a0b", color: "#ededf0", minHeight: "100vh", fontFamily: "-apple-system, BlinkMacSystemFont, Inter, system-ui, sans-serif", fontSize: 14, lineHeight: 1.5 },
  topbar: { height: 56, padding: "0 28px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  logo: { fontWeight: 500, fontSize: 14, display: "flex", alignItems: "center", gap: 10, color: "#a1a1aa" },
  logoMark: { width: 22, height: 22, borderRadius: 6, background: "linear-gradient(135deg, #c79a6b, #b88556)", color: "#1a1a1a", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" },
  topbarRight: { display: "flex", alignItems: "center", gap: 8 },
  topBtn: { display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 8, background: "transparent", border: "1px solid transparent", color: "#a1a1aa", fontSize: 13, textDecoration: "none" },
  cta: { color: "#c79a6b", borderColor: "#25252d" },
  snap: { padding: "26px 28px 18px", borderBottom: "1px solid #1a1a20" },
  snapHeadline: { fontFamily: "'Cooper','Source Serif Pro',Georgia,serif", fontSize: 28, lineHeight: 1.25, color: "#ededf0", fontWeight: 400, letterSpacing: "-0.01em" },
  snapMeta: { marginTop: 8, fontSize: 11, color: "#6b6b75", fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace", letterSpacing: "0.02em" },
  kpiSection: { padding: "20px 28px", borderBottom: "1px solid #1a1a20" },
  panelLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "#6b6b75", fontWeight: 600, marginBottom: 10 },
  kpiGrid: { display: "grid", gap: 1, background: "#1a1a20", borderRadius: 10, overflow: "hidden" },
  kpiTile: { background: "#0f0f11", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 4 },
  kpiLabel: { fontSize: 11, color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.05em" },
  kpiValue: { fontFamily: "'Cooper','Source Serif Pro',Georgia,serif", fontSize: 30, fontWeight: 400, color: "#ededf0", marginTop: 4 },
  kpiDeltas: { display: "flex", gap: 12, fontSize: 11, color: "#6b6b75", fontFamily: "ui-monospace, monospace", marginTop: 6 },
  kpiSrc: { marginTop: 8, fontSize: 9, color: "#3d3d45", fontFamily: "ui-monospace, monospace" },
  panelSection: { padding: "20px 28px", borderBottom: "1px solid #1a1a20" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", padding: "8px 10px", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6b6b75", borderBottom: "1px solid #25252d" },
  tr: { borderBottom: "1px solid #1a1a20" },
  td: { padding: "8px 10px", color: "#ededf0" },
  empty: { color: "#6b6b75", fontFamily: "ui-monospace, monospace", fontSize: 12, padding: 12 },
  footer: { padding: "20px 28px", color: "#6b6b75", fontSize: 12, fontFamily: "ui-monospace, monospace" },
};
