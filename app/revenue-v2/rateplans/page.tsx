// app/revenue-v2/rateplans/page.tsx — rate plan performance + verdict

import Link from "next/link";
import { ratePlansData } from "../_data";
import { KpiGrid, PageHeader, Card, Pill, Selector } from "../_components/UI";

export default function RatePlansPage() {
  const d = ratePlansData;
  return (
    <main className="page">
      <PageHeader
        title={d.header.title}
        narrative={<span>47 plans active out of 88 total. <em>{d.retire_candidates}</em> retire candidates flagged by Cleanup agent — review before next quarter.</span>}
        meta={d.header.meta}
        actions={
          <>
            <button className="btn">Save</button>
            <button className="btn">Share</button>
            <button className="btn cta">Review retire candidates ›</button>
          </>
        }
      />

      <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Selector label="Channel" options={["All", "Direct", "OTA", "Wholesale"]} active="All" />
        <Selector label="Verdict" options={["All", "Keep", "Review", "Close"]} active="All" />
      </div>

      <KpiGrid items={d.summary} />

      <Card title="Rate plans" sub="Performance · last 30 days · auto-verdict from Rate Plan Cleanup agent">
        <table>
          <thead>
            <tr>
              <th>Plan</th>
              <th>Channel</th>
              <th className="num">Bookings</th>
              <th className="num">Rooms</th>
              <th className="num">ADR</th>
              <th className="num">Active days</th>
              <th className="num">Trend</th>
              <th>Verdict</th>
              <th>Rationale</th>
            </tr>
          </thead>
          <tbody>
            {d.plans.map((p) => (
              <tr key={p.id}>
                <td><b>{p.name}</b><div className="mono" style={{ fontSize: 11 }}>{p.id}</div></td>
                <td className="mono">{p.channel}</td>
                <td className="num">{p.bookings || "—"}</td>
                <td className="num">{p.rooms || "—"}</td>
                <td className="num">{p.adr ? `$${p.adr}` : "—"}</td>
                <td className="num">{p.days || "—"}</td>
                <td className="num mono" style={{ color: p.trend > 0 ? "var(--green)" : p.trend < 0 ? "var(--red)" : "var(--muted)" }}>
                  {p.trend > 0 ? "+" : p.trend < 0 ? "−" : ""}{Math.abs(p.trend).toFixed(1)}%
                </td>
                <td>
                  <Pill kind={p.verdict === "keep" ? "ok" : p.verdict === "review" ? "warn" : "red"}>
                    {p.verdict}
                  </Pill>
                </td>
                <td style={{ fontSize: 12 }}>{p.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div style={{ marginTop: 28, fontSize: 12, color: "var(--muted)" }}>
        <Link href="/revenue-v2/pricing">Pricing recommendations ›</Link> &nbsp;·&nbsp;
        <Link href="/revenue-v2/channels">Channels ›</Link>
      </div>
    </main>
  );
}
