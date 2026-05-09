// app/revenue-v2/agents/page.tsx — agent roster + runs + activity log

import { agentsData } from "../_data";
import { KpiGrid, PageHeader, Card, Pill, Spark } from "../_components/UI";

export default function AgentsPage() {
  const d = agentsData;
  const statusKind = (s: string) =>
    s === "active" ? "ok" : s === "idle" ? "tan" : s === "paused" ? "warn" : "red";
  const typeKind = (t: string) =>
    t === "success" ? "ok" : t === "warning" ? "warn" : t === "error" ? "red" : "tan";

  return (
    <main className="page">
      <PageHeader
        title="Agents"
        narrative={<span>5 of 6 agents running. <em>47 findings</em> in last 24h, zero errors. Forecast Engine paused — needs 90d data.</span>}
        meta="Source · COCKPIT · live · refreshed every 60s"
        actions={
          <>
            <button className="btn">Save</button>
            <button className="btn">Share</button>
            <button className="btn cta">Run all now ›</button>
          </>
        }
      />

      <KpiGrid items={d.summary} />

      <Card title="Agent roster" sub="Status · last run · 24h activity">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 1, background: "var(--border-soft)", borderRadius: 12, overflow: "hidden", marginTop: 0 }}>
          {d.agents.map((a) => (
            <div key={a.id} style={{ background: "var(--bg-2)", padding: "18px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontFamily: "var(--serif)", fontSize: 17, color: "var(--text)" }}>{a.name}</div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{a.id}</div>
                </div>
                <Pill kind={statusKind(a.status) as any}>{a.status}</Pill>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14, fontSize: 12 }}>
                <div>
                  <div className="lbl-up">Last run</div>
                  <div style={{ marginTop: 3 }}>{a.last_run}</div>
                </div>
                <div>
                  <div className="lbl-up">Next run</div>
                  <div style={{ marginTop: 3 }}>{a.next_run}</div>
                </div>
                <div>
                  <div className="lbl-up">Findings</div>
                  <div style={{ marginTop: 3, fontFamily: "var(--serif)", fontSize: 22 }}>{a.findings}</div>
                </div>
                <div>
                  <div className="lbl-up">24h activity</div>
                  <div style={{ marginTop: 3 }}>
                    <Spark values={a.activity} />
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 4, marginTop: 14 }}>
                {a.actions.map((act) => (
                  <button key={act} className="btn" style={{ padding: "4px 8px", fontSize: 11 }}>
                    {act.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Recent activity" sub="Last 10 events · all agents">
        <div style={{ display: "flex", flexDirection: "column", gap: 1, background: "var(--border-soft)", borderRadius: 8, overflow: "hidden" }}>
          {d.recent.map((r, i) => (
            <div
              key={i}
              style={{
                background: "var(--bg-2)",
                padding: "10px 14px",
                display: "grid",
                gridTemplateColumns: "70px 160px 90px 1fr",
                gap: 12,
                alignItems: "center",
                fontSize: 12,
              }}
            >
              <span className="mono" style={{ color: "var(--muted)" }}>{r.ts}</span>
              <span className="mono" style={{ color: "var(--text-2)" }}>{r.id}</span>
              <Pill kind={typeKind(r.type) as any}>{r.type}</Pill>
              <span style={{ color: "var(--text)" }}>{r.msg}</span>
            </div>
          ))}
        </div>
      </Card>
    </main>
  );
}
