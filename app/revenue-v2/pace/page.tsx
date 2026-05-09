// app/revenue-v2/pace/page.tsx — booking pace report

import { paceData } from "../_data";
import { KpiGrid, PageHeader, Card, PeriodSwitch, Selector } from "../_components/UI";

export default function PacePage() {
  const d = paceData;
  const max = Math.max(
    ...d.pace_curve.map((p) => Math.max(p.stly, p.otb, p.actual ?? 0, p.budget))
  );
  return (
    <main className="page">
      <PageHeader
        title={d.header.title}
        narrative={<span>Pacing <em>+18.4%</em> ahead of STLY on the books. Three group-rate windows opened — decision needed by Friday.</span>}
        meta={d.header.meta}
        actions={
          <>
            <button className="btn">Save</button>
            <button className="btn">Share</button>
            <button className="btn">⋯</button>
          </>
        }
      />

      <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <PeriodSwitch active="Next 30" />
        <Selector label="Compare" options={["No comp", "Prior", "STLY"]} active="STLY" />
        <Selector label="Segment" options={["All", "Retail", "DMC", "Group"]} active="All" />
      </div>

      <KpiGrid items={d.summary} />

      <Card title="Pace curve" sub="−30 days actual + next 30 days OTB · vs STLY · vs Budget">
        <div className="legend">
          <span><span className="sw" style={{ background: "var(--accent)" }} />Actual / OTB</span>
          <span><span className="sw" style={{ background: "var(--text-2)", opacity: 0.5 }} />STLY</span>
          <span><span className="sw" style={{ background: "var(--green)", opacity: 0.5 }} />Budget</span>
        </div>
        <div className="chart-bars" style={{ height: 220 }}>
          {d.pace_curve.map((p, i) => {
            const future = p.actual === null;
            const main = future ? p.otb : p.actual ?? 0;
            return (
              <div className="bar-col" key={i}>
                <div
                  className="b"
                  style={{
                    height: `${(main / max) * 100}%`,
                    background: future ? "var(--accent)" : "var(--accent)",
                    opacity: future ? 0.55 : 0.9,
                  }}
                />
                <div className="lab">{i % 6 === 0 ? p.d : ""}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)", marginTop: 6 }}>
          <span>−30d</span><span style={{ color: "var(--accent)" }}>today</span><span>+30d</span>
        </div>
      </Card>

      <Card title="Pickup velocity" sub="Last 28 days · daily bookings + 7-day MA">
        <div className="chart-bars" style={{ height: 140 }}>
          {d.pickup_28d.map((p, i) => (
            <div className="bar-col" key={i}>
              <div className="b" style={{ height: `${(p.daily / 12) * 100}%` }} />
              <div className="lab">{i % 4 === 0 ? p.d : ""}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Daily breakdown" sub="Next 15 days · drill-down available">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th className="num">OTB rms</th>
              <th className="num">STLY rms</th>
              <th className="num">Var</th>
              <th className="num">Pickup 24h</th>
              <th className="num">Pickup 7d</th>
              <th className="num">Revenue OTB</th>
            </tr>
          </thead>
          <tbody>
            {d.daily.map((r) => (
              <tr key={r.date}>
                <td className="mono">{r.date}</td>
                <td className="num"><b>{r.otb}</b></td>
                <td className="num">{r.stly}</td>
                <td className="num mono" style={{ color: r.var > 0 ? "var(--green)" : r.var < 0 ? "var(--red)" : "var(--muted)" }}>
                  {r.var > 0 ? "+" : ""}{r.var.toFixed(1)}%
                </td>
                <td className="num">{r.p24}</td>
                <td className="num">{r.p7}</td>
                <td className="num"><b>${(r.rev / 1000).toFixed(1)}k</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </main>
  );
}
