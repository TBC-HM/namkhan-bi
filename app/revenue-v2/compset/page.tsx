// app/revenue-v2/compset/page.tsx — competitor set + promo activity

import { compSetData } from "../_data";
import { KpiGrid, PageHeader, Card, Pill, Selector } from "../_components/UI";

export default function CompSetPage() {
  const d = compSetData;
  return (
    <main className="page">
      <PageHeader
        title={d.header.title}
        narrative={<span>We sit <em>#2 of 7</em>, +2.1% above comp avg. Burasari is in always-discount mode at 67.8% — keep watching.</span>}
        meta={d.header.meta}
        actions={
          <>
            <button className="btn">Save</button>
            <button className="btn">Share</button>
            <button className="btn cta">Run shop now ›</button>
          </>
        }
      />

      <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Selector label="Source" options={["Manual sheet", "Lighthouse", "Scraper", "Both"]} active="Scraper" />
        <Selector label="Window" options={["Next 7", "Next 14", "Next 30"]} active="Next 7" />
      </div>

      <KpiGrid items={d.summary} />

      <Card title="Rate grid" sub={`${d.competitors.length} competitors · 7 days forward · BDC source`}>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                {d.competitors.map((c) => <th key={c} className="num">{c.split(" ")[0]}</th>)}
                <th className="num">Comp avg</th>
                <th className="num">Our BAR</th>
                <th className="num">vs avg</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {d.rate_grid.map((row) => (
                <tr key={row.date}>
                  <td className="mono">{row.date}</td>
                  {row.rates.map((r, i) => (
                    <td key={i} className="num">${r}</td>
                  ))}
                  <td className="num"><b>${row.avg}</b></td>
                  <td className="num"><b>${row.ours}</b></td>
                  <td className="num mono" style={{ color: row.delta > 0 ? "var(--green)" : "var(--red)" }}>
                    {row.delta > 0 ? "+" : "−"}{Math.abs(row.delta).toFixed(1)}%
                  </td>
                  <td className="mono" style={{ fontSize: 11 }}>{row.source} · {row.shopper} · {row.ts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Promo activity" sub="Comp Set Scanner · classification + last seen">
        <div className="grid-2" style={{ marginTop: 0 }}>
          {d.promo.map((p) => {
            const cls = p.cls === "always_discounts" ? "red" : p.cls === "frequent_promo" ? "warn" : "ok";
            return (
              <div
                key={p.name}
                style={{
                  padding: 18,
                  background: "var(--bg-2)",
                  border: "1px solid var(--border-soft)",
                  borderRadius: 10,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontFamily: "var(--serif)", fontSize: 18, color: "var(--text)" }}>{p.name}</div>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                      Last seen {p.last}
                    </div>
                  </div>
                  <Pill kind={cls as any}>{p.cls.replace("_", " ")}</Pill>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 14 }}>
                  <div>
                    <div className="lbl-up">Promo frequency</div>
                    <div style={{ fontFamily: "var(--serif)", fontSize: 28, marginTop: 6 }}>{p.freq.toFixed(1)}%</div>
                    <div className="bar-track" style={{ marginTop: 8 }}>
                      <div className={`bar-fill ${p.freq > 50 ? "warn" : ""}`} style={{ width: `${p.freq}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="lbl-up">Avg discount</div>
                    <div style={{ fontFamily: "var(--serif)", fontSize: 28, marginTop: 6 }}>
                      {p.disc !== null ? `${p.disc.toFixed(1)}%` : "—"}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div style={{ marginTop: 20, fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>
        Source: {d.source_config.source} · last refresh {d.source_config.last_refresh} · {d.source_config.is_stale ? "STALE" : "fresh"}
      </div>
    </main>
  );
}
