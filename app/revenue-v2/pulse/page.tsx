// app/revenue-v2/pulse/page.tsx — multi-period dashboard

import Link from "next/link";
import { pulseData, REFRESHED_AT } from "../_data";
import { KpiGrid, PageHeader, Card, PeriodSwitch, Selector, BarChart } from "../_components/UI";

export default function PulsePage() {
  const d = pulseData;
  return (
    <main className="page">
      <PageHeader
        title={d.header.title}
        narrative={<span dangerouslySetInnerHTML={{ __html: d.header.narrative }} />}
        meta={`${d.header.meta} · refreshed ${REFRESHED_AT}`}
        actions={
          <>
            <button className="btn">Save</button>
            <button className="btn">Share</button>
            <button className="btn">⋯</button>
          </>
        }
      />

      <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <PeriodSwitch active="30d" />
        <Selector label="Compare" options={["No comp", "Prior", "STLY"]} active="STLY" />
        <Selector label="Segment" options={["All", "Retail", "DMC", "Group", "Discount", "Comp"]} active="All" />
      </div>

      <KpiGrid items={d.vital} />

      {/* Hero chart */}
      <Card title={d.hero_chart.title} sub="Last 30 days · vs same time last year">
        <div className="legend">
          <span><span className="sw" style={{ background: "var(--accent)" }} />Actual</span>
          <span><span className="sw" style={{ background: "var(--text-2)", opacity: 0.4 }} />STLY</span>
        </div>
        <BarChart points={d.hero_chart.points} showLabelsEvery={5} height={220} />
      </Card>

      {/* Channel mix + Room types */}
      <div className="grid-2">
        <Card title="Channel mix" sub="Last 30 days · revenue share">
          <table>
            <thead>
              <tr>
                <th>Channel</th>
                <th className="num">Share</th>
                <th className="num">Revenue</th>
                <th className="num">Δ</th>
              </tr>
            </thead>
            <tbody>
              {d.channel_mix.map((c) => (
                <tr key={c.name}>
                  <td><b>{c.name}</b></td>
                  <td className="num">
                    <div className="bar-track" style={{ width: 80, marginLeft: "auto", marginBottom: 4 }}>
                      <div className="bar-fill" style={{ width: `${c.share}%` }} />
                    </div>
                    {c.share.toFixed(1)}%
                  </td>
                  <td className="num">${(c.rev / 1000).toFixed(1)}k</td>
                  <td className="num mono" style={{ color: c.delta.startsWith("+") ? "var(--green)" : "var(--red)" }}>{c.delta}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Room type occupancy" sub="Last 30 days">
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th className="num">Sold / Avail</th>
                <th className="num">Occ</th>
                <th className="num">vs STLY</th>
              </tr>
            </thead>
            <tbody>
              {d.room_types.map((r) => (
                <tr key={r.name}>
                  <td><b>{r.name}</b></td>
                  <td className="num">{r.sold} / {r.avail}</td>
                  <td className="num">
                    <div className="bar-track" style={{ width: 60, marginLeft: "auto", marginBottom: 4 }}>
                      <div className="bar-fill" style={{ width: `${r.occ}%` }} />
                    </div>
                    {r.occ.toFixed(1)}%
                  </td>
                  <td className="num mono" style={{ color: r.occ > r.stly ? "var(--green)" : "var(--red)" }}>
                    {r.occ > r.stly ? "+" : "−"}{Math.abs(r.occ - r.stly).toFixed(1)}pp
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Top performers / Need attention */}
      <div className="grid-2">
        <Card title="Top performers" sub="Last 30 days">
          {d.top.map((t, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: i < d.top.length - 1 ? "1px solid var(--border-soft)" : "none" }}>
              <div>
                <div style={{ color: "var(--text)" }}>{t.name}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3, fontFamily: "var(--mono)" }}>{t.meta}</div>
              </div>
              <div style={{ color: t.cls === "pos" ? "var(--green)" : "var(--red)", fontFamily: "var(--mono)", fontSize: 13 }}>{t.delta}</div>
            </div>
          ))}
        </Card>

        <Card title="Need attention" sub="Flagged by agents">
          {d.attention.map((t, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: i < d.attention.length - 1 ? "1px solid var(--border-soft)" : "none" }}>
              <div>
                <div style={{ color: "var(--text)" }}>{t.name}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3, fontFamily: "var(--mono)" }}>{t.meta}</div>
              </div>
              <div style={{ color: t.cls === "pos" ? "var(--green)" : "var(--red)", fontFamily: "var(--mono)", fontSize: 13 }}>{t.delta}</div>
            </div>
          ))}
        </Card>
      </div>

      {/* Outlook */}
      <Card title={d.outlook.title}>
        <p className="h-narrative" style={{ fontSize: 16, marginTop: 0 }} dangerouslySetInnerHTML={{ __html: d.outlook.text }} />
        <div className="kpis" style={{ marginTop: 18, gridTemplateColumns: "repeat(4, 1fr)" }}>
          {d.outlook.stats.map((s, i) => (
            <div key={i} className="kpi">
              <div className="kpi-l">{s.l}</div>
              <div className="kpi-v">{s.v}</div>
              <div className="kpi-d"><span><b /> {s.m}</span></div>
            </div>
          ))}
        </div>
      </Card>

      <div style={{ marginTop: 28, fontSize: 12, color: "var(--muted)" }}>
        <Link href="/revenue-v2/pace">Pace ›</Link> &nbsp;·&nbsp;
        <Link href="/revenue-v2/channels">Channels ›</Link> &nbsp;·&nbsp;
        <Link href="/revenue-v2/compset">Comp set ›</Link>
      </div>
    </main>
  );
}
