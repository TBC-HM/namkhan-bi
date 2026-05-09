// app/revenue-v2/channels/page.tsx — channel mix + commission + net ADR

import { channelData } from "../_data";
import { KpiGrid, PageHeader, Card, PeriodSwitch, Selector, StackedBars } from "../_components/UI";

export default function ChannelsPage() {
  const d = channelData;
  return (
    <main className="page">
      <PageHeader
        title={d.header.title}
        narrative={<span>Direct mix at <em>41.2%</em> and climbing. OTA volume holding, commission creep on Wholesale needs a look.</span>}
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
        <PeriodSwitch active="30d" />
        <Selector label="Compare" options={["No comp", "Prior", "STLY"]} active="STLY" />
      </div>

      <KpiGrid items={d.summary} />

      <Card title="Mix over time" sub="Last 12 months · revenue share by channel group">
        <StackedBars months={d.months} series={d.mix_over_time} />
      </Card>

      <Card title="Channel performance" sub="Last 30 days · gross & net ADR after commission">
        <table>
          <thead>
            <tr>
              <th>Channel</th>
              <th className="num">Rooms</th>
              <th className="num">Gross ADR</th>
              <th className="num">Comm %</th>
              <th className="num">Net ADR</th>
              <th className="num">Net revenue</th>
              <th className="num">Δ vs prior</th>
            </tr>
          </thead>
          <tbody>
            {d.channels.map((c) => (
              <tr key={c.name}>
                <td><b>{c.name}</b></td>
                <td className="num">{c.rms}</td>
                <td className="num">${c.gross}</td>
                <td className="num mono">{c.comm.toFixed(1)}%</td>
                <td className="num"><b>${c.net}</b></td>
                <td className="num">${(c.rev / 1000).toFixed(1)}k</td>
                <td className="num mono" style={{ color: c.cls === "pos" ? "var(--green)" : "var(--red)" }}>{c.delta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="OTA breakdown" sub="Booking.com · Expedia · Agoda — sub-channel performance + promo participation">
        <table>
          <thead>
            <tr>
              <th>Sub-channel</th>
              <th>Parent</th>
              <th className="num">Rooms</th>
              <th className="num">Net revenue</th>
              <th className="num">Promo %</th>
              <th className="num">Δ</th>
            </tr>
          </thead>
          <tbody>
            {d.ota_breakdown.map((o) => (
              <tr key={o.sub}>
                <td><b>{o.sub}</b></td>
                <td className="mono">{o.parent}</td>
                <td className="num">{o.rms}</td>
                <td className="num">${(o.rev / 1000).toFixed(1)}k</td>
                <td className="num mono">{o.promo}%</td>
                <td className="num mono" style={{ color: o.cls === "pos" ? "var(--green)" : "var(--red)" }}>{o.delta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </main>
  );
}
