// app/revenue-v2/_components/UI.tsx
// Shared atomic components — server-safe (no client hooks). Used across all 9 pages.

type Delta = { vs: string; t: string; c: string };

export function KpiTile({ l, v, d }: { l: string; v: string; d?: Delta[] }) {
  return (
    <div className="kpi">
      <div className="kpi-l">{l}</div>
      <div className="kpi-v">{v}</div>
      {d && d.length > 0 && (
        <div className="kpi-d">
          {d.map((x, i) => (
            <span key={i} className={x.c}>
              <b>{x.vs}</b>{x.t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function KpiGrid({ items }: { items: { l: string; v: string; d?: Delta[] }[] }) {
  return (
    <div className="kpis">
      {items.map((k, i) => (
        <KpiTile key={i} l={k.l} v={k.v} d={k.d} />
      ))}
    </div>
  );
}

export function PageHeader({
  title, narrative, meta, actions,
}: {
  title: React.ReactNode; narrative?: React.ReactNode; meta?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="h-row">
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 className="h-title">{title}</h1>
        {narrative && <p className="h-narrative">{narrative}</p>}
        {meta && <div className="h-meta">{meta}</div>}
      </div>
      {actions && <div className="h-actions">{actions}</div>}
    </div>
  );
}

export function Card({
  title, sub, right, children,
}: {
  title?: string; sub?: string; right?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="card">
      {(title || right) && (
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: title ? 8 : 0 }}>
          <div>
            {title && <h3 className="c-title">{title}</h3>}
            {sub && <div className="c-sub">{sub}</div>}
          </div>
          {right && <div>{right}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

export function Pill({
  children, kind = "default",
}: {
  children: React.ReactNode; kind?: "default" | "ok" | "warn" | "red" | "tan";
}) {
  return <span className={`pill ${kind === "default" ? "" : kind}`}>{children}</span>;
}

// Static (non-interactive) period switcher — display-only for staging.
export function PeriodSwitch({ active = "30d" }: { active?: string }) {
  const opts = ["Today", "7d", "30d", "90d", "YTD", "Next 7", "Next 30", "Next 90"];
  return (
    <div className="seg" role="tablist" aria-label="Period">
      {opts.map((o) => (
        <button key={o} className={o.toLowerCase().replace(" ", "") === active.toLowerCase() ? "on" : ""}>
          {o}
        </button>
      ))}
    </div>
  );
}

export function Selector({
  label, options, active,
}: {
  label: string; options: string[]; active: string;
}) {
  return (
    <div className="seg" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o} className={o === active ? "on" : ""}>
          {o}
        </button>
      ))}
    </div>
  );
}

// Simple CSS bar chart with two series (actual + comparison).
export function BarChart({
  points, height = 200, showLabelsEvery = 4,
}: {
  points: { d: string; a: number; c?: number; fwd?: boolean }[];
  height?: number; showLabelsEvery?: number;
}) {
  const max = Math.max(...points.map((p) => Math.max(p.a, p.c ?? 0))) || 1;
  return (
    <div className="chart-bars" style={{ height }}>
      {points.map((p, i) => (
        <div className="bar-col" key={i}>
          <div className={`b ${p.fwd ? "fwd" : ""}`} style={{ height: `${(p.a / max) * 100}%` }} />
          {p.c !== undefined && (
            <div className="b cmp" style={{ height: `${(p.c / max) * 100}%`, position: "absolute", width: "40%", marginLeft: "60%", opacity: 0.4 }} />
          )}
          <div className="lab">{i % showLabelsEvery === 0 ? p.d : ""}</div>
        </div>
      ))}
    </div>
  );
}

// Stacked bar chart (channel mix over time).
export function StackedBars({
  months, series,
}: {
  months: string[];
  series: { name: string; color: string; values: number[] }[];
}) {
  return (
    <div>
      <div className="legend">
        {series.map((s) => (
          <span key={s.name}>
            <span className="sw" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
      <div className="chart-bars" style={{ height: 200 }}>
        {months.map((m, i) => (
          <div className="bar-col" key={m} style={{ position: "relative" }}>
            <div style={{ width: "100%", display: "flex", flexDirection: "column-reverse", height: "100%" }}>
              {series.map((s) => (
                <div
                  key={s.name}
                  style={{
                    background: s.color,
                    height: `${s.values[i]}%`,
                    width: "100%",
                  }}
                />
              ))}
            </div>
            <div className="lab" style={{ position: "absolute", bottom: -18 }}>{m}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Mini activity sparkline — used on Agents page.
export function Spark({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <div style={{ display: "flex", gap: 1, alignItems: "flex-end", height: 24 }}>
      {values.map((v, i) => (
        <div
          key={i}
          style={{
            flex: 1, minWidth: 1,
            height: `${(v / max) * 100}%`,
            background: v === 0 ? "var(--border-soft)" : "var(--accent)",
            opacity: v === 0 ? 0.3 : 0.7,
            borderRadius: 1,
            minHeight: v === 0 ? 1 : 2,
          }}
        />
      ))}
    </div>
  );
}

export const EM = "—";
