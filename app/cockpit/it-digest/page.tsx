// app/cockpit/it-digest/page.tsx
// COWORK BRIEF 2026-05-07 / GAP 5b: weekly IT digest surface.
// Reads public.v_it_weekly_digest (single row, 7-day rolling window).
// Posted Monday 09:00 LAK by Kit per his prompt v16.

import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DigestRow = {
  deploys_staging: number;
  deploys_prod: number;
  background_repairs: number;
  tickets_closed: number;
  emergencies_escalated: number;
  workers_spawned: number;
  hallucinations_caught: number;
  cost_usd: string | number;
  top_3_by_impact: { ticket_id: number; summary: string; updated_at: string }[] | null;
};

const EM = "—";

async function getDigest(): Promise<DigestRow | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const { data, error } = await supabase.from("v_it_weekly_digest").select("*").maybeSingle();
  if (error) return null;
  return data as DigestRow | null;
}

export default async function ItDigestPage() {
  const d = await getDigest();
  const now = new Date();
  const since = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  const fmt = (x: Date) => x.toISOString().slice(0, 10);

  return (
    <div className="page-wrap" style={{ padding: 28, maxWidth: 960, margin: "0 auto" }}>
      <header style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: "var(--serif, Georgia)", fontStyle: "italic", fontSize: 32, color: "var(--text-0, #ededf0)", margin: 0 }}>
          IT digest — last 7 days
        </h1>
        <div style={{ fontFamily: "var(--mono, ui-monospace)", fontSize: 11, color: "var(--brass, #c79a6b)", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 6 }}>
          {fmt(since)} → {fmt(now)} · v_it_weekly_digest
        </div>
      </header>

      {!d ? (
        <p style={{ color: "var(--text-2, #a1a1aa)" }}>{EM} digest unavailable</p>
      ) : (
        <>
          {/* KPI grid — 8 tiles */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1,
            background: "var(--border-soft, #1a1a20)", borderRadius: 12, overflow: "hidden",
            marginBottom: 24,
          }}>
            {[
              { l: "Deploys (staging)", v: d.deploys_staging },
              { l: "Deploys (prod)", v: d.deploys_prod },
              { l: "Background repairs", v: d.background_repairs },
              { l: "Tickets closed", v: d.tickets_closed },
              { l: "Emergencies escalated", v: d.emergencies_escalated },
              { l: "Workers spawned", v: d.workers_spawned },
              { l: "Hallucinations caught", v: d.hallucinations_caught },
              { l: "Cost", v: `$${d.cost_usd}` },
            ].map((k, i) => (
              <div key={i} style={{ background: "var(--bg-2, #0f0f11)", padding: "18px 20px" }}>
                <div style={{ fontFamily: "var(--mono, ui-monospace)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--brass, #c79a6b)", fontWeight: 600 }}>
                  {k.l}
                </div>
                <div style={{ fontFamily: "var(--serif, Georgia)", fontStyle: "italic", fontSize: 28, marginTop: 8, color: "var(--text-0, #ededf0)", fontVariantNumeric: "tabular-nums" }}>
                  {k.v ?? EM}
                </div>
              </div>
            ))}
          </div>

          {/* Top 3 by impact */}
          <section>
            <h2 style={{ fontFamily: "var(--serif, Georgia)", fontStyle: "italic", fontSize: 22, color: "var(--text-0, #ededf0)", margin: "0 0 14px" }}>
              Top 3 by impact
            </h2>
            {!d.top_3_by_impact || d.top_3_by_impact.length === 0 ? (
              <p style={{ color: "var(--text-2, #a1a1aa)", fontSize: 13 }}>
                {EM} no tickets tagged metadata.impact = high|critical in this window
              </p>
            ) : (
              <ol style={{ paddingLeft: 18, color: "var(--text-1, #ededf0)", fontSize: 14, lineHeight: 1.6 }}>
                {d.top_3_by_impact.map((t) => (
                  <li key={t.ticket_id}>
                    <b>#{t.ticket_id}</b> — {t.summary}
                    {" "}
                    <span style={{ fontFamily: "var(--mono, ui-monospace)", fontSize: 11, color: "var(--text-3, #6b6b75)" }}>
                      ({t.updated_at?.slice(0, 16)})
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
    </div>
  );
}
