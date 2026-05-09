// app/revenue-v2/parity/page.tsx — parity breaches + acknowledge flow

import { parityData } from "../_data";
import { KpiGrid, PageHeader, Card, Pill, Selector } from "../_components/UI";

export default function ParityPage() {
  const d = parityData;
  return (
    <main className="page">
      <PageHeader
        title={d.header.title}
        narrative={<span><em>12 open breaches</em> across 3 channels. Worst gap −12.0% on Booking.com (May 4) — needs ack now.</span>}
        meta={d.header.meta}
        actions={
          <>
            <button className="btn">Save</button>
            <button className="btn">Share</button>
            <button className="btn cta">Acknowledge all open ›</button>
          </>
        }
      />

      <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Selector label="Status" options={["Open", "All", "Acknowledged", "Resolved"]} active="Open" />
        <Selector label="Window" options={["Last 24h", "Last 7d", "Last 30d"]} active="Last 24h" />
      </div>

      <KpiGrid items={d.summary} />

      <Card title="Open breaches" sub={`Channels monitored: ${d.channels_monitored.join(", ")}`}>
        <table>
          <thead>
            <tr>
              <th>Detected</th>
              <th>Channel</th>
              <th>Target date</th>
              <th className="num">Our rate</th>
              <th className="num">Their rate</th>
              <th className="num">Δ%</th>
              <th>Status</th>
              <th>Last seen</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {d.breaches.map((b) => {
              const sevKind = Math.abs(b.delta) > 8 ? "red" : Math.abs(b.delta) > 5 ? "warn" : "tan";
              const statusKind = b.status === "open" ? "red" : b.status === "acknowledged" ? "warn" : "ok";
              return (
                <tr key={b.id}>
                  <td className="mono">{b.det.replace("T", " ")}</td>
                  <td><b>{b.ch}</b></td>
                  <td className="mono">{b.date}</td>
                  <td className="num">${b.our}</td>
                  <td className="num">${b.their}</td>
                  <td className="num mono">
                    <Pill kind={sevKind as any}>{b.delta > 0 ? "+" : "−"}{Math.abs(b.delta).toFixed(1)}%</Pill>
                  </td>
                  <td><Pill kind={statusKind as any}>{b.status}</Pill></td>
                  <td className="mono" style={{ fontSize: 11 }}>
                    {b.seen}
                    {b.by ? <div style={{ color: "var(--muted)" }}>by {b.by}</div> : null}
                    {b.note ? <div style={{ color: "var(--green)" }}>{b.note}</div> : null}
                  </td>
                  <td>
                    {b.status === "open" ? (
                      <button className="btn" style={{ padding: "4px 8px", fontSize: 11 }}>Ack</button>
                    ) : (
                      <span style={{ color: "var(--muted)", fontSize: 11 }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <div style={{ marginTop: 20, fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>
        Agent: {d.agent.id} · last run {d.agent.last_run} · next run {d.agent.next_run} · {d.agent.findings_24h} findings 24h
      </div>
    </main>
  );
}
