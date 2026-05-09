// app/revenue-v2/pricing/page.tsx — BAR recommendations + OTB-aware floor logic

import { pricingData } from "../_data";
import { KpiGrid, PageHeader, Card, Pill, Selector } from "../_components/UI";

export default function PricingPage() {
  const d = pricingData;
  const flagKind = (f: string) =>
    f === "ok" ? "ok" : f === "soft_floor" ? "warn" : f === "pace_block" ? "red" : "tan";

  return (
    <main className="page">
      <PageHeader
        title={d.header.title}
        narrative={<span><em>Recommend-only.</em> No write to Cloudbeds. 5 recs queued — 2 flagged soft-floor for weekend hold.</span>}
        meta={d.header.meta}
        actions={
          <>
            <button className="btn">Save</button>
            <button className="btn">Share</button>
            <button className="btn cta">Approve all OK ›</button>
          </>
        }
      />

      <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Selector label="Status" options={["Pending", "All", "Approved", "Overridden"]} active="Pending" />
        <Selector label="Flag" options={["All", "OK", "Soft floor", "Hard floor", "Blocked"]} active="All" />
      </div>

      <KpiGrid items={d.summary} />

      <div className="grid-3" style={{ gridTemplateColumns: "2fr 1fr" }}>
        <Card title="Recommendations" sub="Queued by Pricing agent · expires when block opens">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Room type</th>
                <th className="num">Current</th>
                <th className="num">Proposed</th>
                <th className="num">Δ%</th>
                <th>Flag</th>
                <th>Rationale</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {d.recs.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.date}</td>
                  <td><b>{r.room}</b></td>
                  <td className="num">${r.cur}</td>
                  <td className="num"><b>${r.prop}</b></td>
                  <td className="num mono" style={{ color: r.delta > 0 ? "var(--green)" : "var(--red)" }}>
                    {r.delta > 0 ? "+" : "−"}{Math.abs(r.delta).toFixed(1)}%
                  </td>
                  <td><Pill kind={flagKind(r.flag) as any}>{r.flag.replace("_", " ")}</Pill></td>
                  <td style={{ fontSize: 12 }}>{r.rationale}</td>
                  <td>
                    <button className="btn" style={{ padding: "4px 8px", fontSize: 11 }}>Approve</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="OTB-aware floor logic" sub="Pricing rules in effect">
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div className="lbl-up">Pace threshold</div>
              <div style={{ marginTop: 4 }}>+{d.floor_logic.pace_threshold_pct}% vs STLY</div>
            </div>
            <div>
              <div className="lbl-up">Days-to-arrival cutoff</div>
              <div style={{ marginTop: 4 }}>≤ {d.floor_logic.days_to_arrival_threshold} days = floor protected</div>
            </div>
            <div>
              <div className="lbl-up">Soft floor multiplier</div>
              <div style={{ marginTop: 4 }}>{d.floor_logic.soft_floor_multiplier} × hard floor</div>
            </div>
            <div>
              <div className="lbl-up">Max change per cycle</div>
              <div style={{ marginTop: 4 }}>±{d.floor_logic.max_change_pct}% · {d.floor_logic.max_dates_per_cycle} dates max</div>
            </div>
            <div>
              <div className="lbl-up">Hard floors by room type</div>
              <table style={{ marginTop: 8 }}>
                <tbody>
                  {Object.entries(d.floor_logic.hard_floor).map(([k, v]) => (
                    <tr key={k}>
                      <td style={{ padding: "6px 0", border: 0 }}>{k}</td>
                      <td className="num" style={{ padding: "6px 0", border: 0 }}><b>{v as string}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
