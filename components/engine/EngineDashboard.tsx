// components/engine/EngineDashboard.tsx
// Shared engine-style department dashboard. Wired onto canonical primitives
// (PBS manifesto 2026-05-09): renders inside <Page>, KPIs as <KpiBox>, each
// panel as <Panel> with <ArtifactActions>. Data layer unchanged — same
// supabase view/column reads, same filter / order_by / limit semantics.
//
// Originally drafted by PBS via Claude (Cowork) · 2026-05-07. Re-chromed by
// Claude (Opus 4.7) · 2026-05-09.

import { createClient } from "@supabase/supabase-js";
import Page from "@/components/page/Page";
import Panel from "@/components/page/Panel";
import KpiBox from "@/components/kpi/KpiBox";
import ArtifactActions from "@/components/page/ArtifactActions";

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

  // Map config formats to KpiBox units (same shape as KpiBox elsewhere).
  const kpiUnit = (f?: EngineKpi['format']): 'usd' | 'lak' | 'pct' | 'count' | 'pp' | 'nights' => {
    switch (f) {
      case 'usd': return 'usd';
      case 'lak': return 'lak';
      case 'pct': return 'pct';
      case 'pp':  return 'pp';
      case 'k':   return 'count';
      case 'int': return 'count';
      default:    return 'count';
    }
  };
  const ctx = (kind: 'panel' | 'kpi' | 'brief' | 'table', title: string) => ({ kind, title, dept: cfg.dept_label.toLowerCase() });
  const askHref = `/cockpit?role=${encodeURIComponent(cfg.hod_role)}`;

  return (
    <Page
      eyebrow={`${cfg.dept_label} · ${cfg.scope}`}
      title={<><em style={{ fontStyle: 'italic' }}>{cfg.dept_label}</em> · live</>}
      topRight={
        <a href={askHref} style={{
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase',
          color: '#c4a06b', textDecoration: 'none',
          border: '1px solid #2a261d', borderRadius: 6, padding: '5px 12px',
        }}>Ask {cfg.hod_display_name} ↗</a>
      }
    >
      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 14 }}>
        {cfg.kpis.map((k, i) => {
          const row = kpiRows[i];
          const n = typeof row.value === 'string' ? Number(row.value) : (row.value as number | null);
          const value = (n === null || Number.isNaN(n)) ? 0 : (n as number);
          return (
            <KpiBox
              key={k.label}
              value={value}
              unit={kpiUnit(k.format)}
              label={k.label}
              tooltip={`${k.label} · ${k.view}.${k.column}`}
            />
          );
        })}
      </div>

      {/* Panels */}
      {cfg.panels.map((p, pi) => {
        const rows = panelRows[pi];
        return (
          <div key={p.title} style={{ marginBottom: 14 }}>
            <Panel title={p.title} eyebrow={p.view} actions={<ArtifactActions context={ctx('table', p.title)} />}>
              {rows.length === 0 ? (
                <div style={{ color: '#7d7565', fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 12, padding: 12 }}>— no rows from {p.view} —</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr>{p.columns.map((c) => <th key={c.key} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7d7565', borderBottom: '1px solid #25252d' }}>{c.label}</th>)}</tr>
                    </thead>
                    <tbody>
                      {rows.map((row, ri) => (
                        <tr key={ri} style={{ borderBottom: '1px solid #1f1c15' }}>
                          {p.columns.map((c) => (
                            <td key={c.key} style={{ padding: '8px 10px', color: '#d8cca8' }}>{fmt(row[c.key], c.format)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </div>
        );
      })}
    </Page>
  );
}
