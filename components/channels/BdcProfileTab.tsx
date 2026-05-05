// components/channels/BdcProfileTab.tsx — Profile Crawler agent tab.
// Reads public.v_profile_crawls + v_profile_recommendations + v_profile_measurements.
// Operations·Staff visual: title + 5 KpiBox tiles + 3 hero panels + recommendations table.

import { supabase } from '@/lib/supabase';
import KpiBox from '@/components/kpi/KpiBox';

interface CrawlRow {
  id: string;
  ota_source: string;
  page_url: string | null;
  crawl_date: string;
  parser_version: string;
  scores: Record<string, any>;
  notes: string | null;
}

interface RecRow {
  id: string;
  crawl_id: string;
  ota_source: string;
  category: string;
  severity: 'critical' | 'warn' | 'info' | 'positive';
  title: string;
  evidence: string;
  recommendation: string;
  expected_impact: string | null;
  metric_to_watch: string | null;
  baseline_value: number | null;
  status: string;
  applied_at: string | null;
  measure_after: string | null;
  created_at: string;
}

interface MeasureRow {
  id: string;
  recommendation_id: string;
  measured_at: string;
  baseline_value: number | null;
  current_value: number | null;
  delta_pct: number | null;
  verdict: 'worked' | 'no_change' | 'regressed' | 'inconclusive';
  notes: string | null;
}

const SEV_STYLES = {
  critical: { border: '#b03826', chip: 'rgba(176,56,38,0.12)', chipText: '#7a2618', label: 'CRITICAL' },
  warn:     { border: '#a87a18', chip: 'rgba(168,122,24,0.12)', chipText: '#6e4d0d', label: 'WARN' },
  info:     { border: 'var(--brass)', chip: 'rgba(177,138,72,0.12)', chipText: '#6b5022', label: 'INFO' },
  positive: { border: '#3b6b3a', chip: 'rgba(59,107,58,0.12)', chipText: '#2a4d29', label: 'STRENGTH' },
} as const;

const STATUS_STYLES: Record<string, { color: string; label: string }> = {
  open:                  { color: 'var(--brass)',          label: 'OPEN' },
  applied:               { color: 'var(--moss-glow)',      label: 'APPLIED' },
  dismissed:             { color: 'var(--ink-mute)',       label: 'DISMISSED' },
  superseded:            { color: 'var(--ink-mute)',       label: 'SUPERSEDED' },
  measured_worked:       { color: 'var(--moss-glow)',      label: 'WORKED' },
  measured_no_change:    { color: 'var(--ink-mute)',       label: 'NO CHANGE' },
  measured_regressed:    { color: 'var(--st-bad-tx, #b03826)', label: 'REGRESSED' },
};

async function fetchAll(otaSource: string) {
  const [{ data: latest }, { data: crawlHistory }, { data: recs }, { data: measurements }] = await Promise.all([
    supabase.from('v_profile_latest_crawl').select('*').eq('ota_source', otaSource).limit(1).maybeSingle(),
    supabase.from('v_profile_crawls').select('*').eq('ota_source', otaSource).eq('status', 'parsed').order('crawl_date', { ascending: false }).limit(20),
    supabase.from('v_profile_recommendations').select('*').eq('ota_source', otaSource).order('created_at', { ascending: false }),
    supabase.from('v_profile_measurements').select('*'),
  ]);
  return { latest: latest as CrawlRow | null, history: (crawlHistory ?? []) as CrawlRow[], recs: (recs ?? []) as RecRow[], measurements: (measurements ?? []) as MeasureRow[] };
}

function fmtDate(s: string | null): string {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function daysAgo(s: string | null): string {
  if (!s) return '—';
  const d = (Date.now() - new Date(s).getTime()) / (1000 * 60 * 60 * 24);
  if (d < 1) return 'today';
  return `${Math.round(d)}d ago`;
}

export default async function BdcProfileTab({ otaSource = 'Booking.com' }: { otaSource?: string }) {
  const { latest, history, recs, measurements } = await fetchAll(otaSource);

  const open = recs.filter((r) => r.status === 'open');
  const applied = recs.filter((r) => r.status === 'applied');
  const measured = recs.filter((r) => r.status.startsWith('measured_'));
  const worked = measured.filter((r) => r.status === 'measured_worked').length;

  // KPI 1 — profile completeness (search_score / max)
  const ss = latest?.scores?.search_score ?? null;
  const ssMax = latest?.scores?.search_score_max ?? null;
  const completenessPct = ss != null && ssMax != null && ssMax > 0 ? (Number(ss) / Number(ssMax)) * 100 : null;

  // KPI 4 — conversion lift since last cycle (worked vs total measured)
  const liftPct = measured.length > 0 ? (worked / measured.length) * 100 : null;

  // KPI 5 — days since last crawl
  const lastCrawlDays = latest?.crawl_date
    ? Math.round((Date.now() - new Date(latest.crawl_date).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // Score history series — extract review_score per crawl
  const scoreHistory = history
    .slice()
    .reverse()
    .map((c) => ({
      date: c.crawl_date,
      review_score: Number(c.scores?.review_score ?? null),
      search_score: Number(c.scores?.search_score ?? null),
    }))
    .filter((p) => isFinite(p.review_score) || isFinite(p.search_score));

  return (
    <>
      {/* Title block — Operations·Staff style */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', color: 'var(--ink-mute)' }}>
            Profile crawler
          </div>
          <h2 style={{ margin: '4px 0 4px', fontFamily: 'var(--serif)', fontWeight: 500, fontSize: 'var(--t-2xl)' }}>
            What {otaSource} <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>sees about us</em>
          </h2>
          <div style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-mute)' }}>
            {latest
              ? <>Last crawl <strong>{fmtDate(latest.crawl_date)}</strong> ({daysAgo(latest.crawl_date)}) · parser <code>{latest.parser_version}</code> · {open.length} open · {applied.length} applied · {measured.length} measured ({worked} worked)</>
              : <>No crawls yet — schedule the agent to run on this OTA.</>}
          </div>
        </div>
        <button
          type="button"
          disabled
          title="The actual Nimble + LLM scraper Edge Function is not wired yet. This button will trigger a manual crawl once that's built."
          style={{
            padding: '8px 14px', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
            textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)',
            color: 'var(--ink-mute)', background: 'var(--paper-deep)',
            border: 'none', borderRadius: 4, cursor: 'not-allowed',
          }}
        >
          Run crawl now (pending)
        </button>
      </div>

      {/* 5 KPI tiles */}
      <section className="kpi-strip cols-5" style={{ marginBottom: 14 }}>
        <KpiBox
          value={completenessPct}
          unit="pct"
          label="Profile completeness"
          tooltip={ss != null ? `${ss}/${ssMax} BDC search-score points filled.` : 'Awaiting first scraper crawl.'}
          state={completenessPct != null && completenessPct < 30 ? 'data-needed' : 'live'}
          needs={completenessPct != null && completenessPct < 30 ? 'Open BDC Score booster.' : undefined}
        />
        <KpiBox value={open.length} unit="count" label="Open recommendations" tooltip="Recommendations still waiting on action." />
        <KpiBox value={applied.length} unit="count" label="Applied (awaiting measurement)" tooltip="Recommendations marked applied; agent will re-measure 14d after apply date." />
        <KpiBox
          value={liftPct}
          unit="pct"
          label="Worked rate"
          tooltip={`${worked} of ${measured.length} measured recommendations resulted in a positive metric move.`}
          state={liftPct == null ? 'data-needed' : liftPct < 50 ? 'data-needed' : 'live'}
          needs={liftPct == null ? 'No measurements yet · need 14d post-apply data.' : undefined}
        />
        <KpiBox
          value={lastCrawlDays}
          unit="d"
          label="Days since last crawl"
          tooltip="Weekly cadence target. Stale = scraper not running."
          state={lastCrawlDays != null && lastCrawlDays > 14 ? 'data-needed' : 'live'}
          needs={lastCrawlDays != null && lastCrawlDays > 14 ? 'Crawl is overdue — re-trigger.' : undefined}
        />
      </section>

      {/* 3 hero panels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
        {/* Score history */}
        <Section title="Score history" sub={`${scoreHistory.length} crawl${scoreHistory.length === 1 ? '' : 's'}`}>
          {scoreHistory.length === 0 ? (
            <Empty>Need 2+ crawls to plot a trend. First crawl seeded today.</Empty>
          ) : (
            <table className="tbl">
              <thead><tr><th>Date</th><th className="num">Review</th><th className="num">Search score</th></tr></thead>
              <tbody>
                {scoreHistory.map((p) => (
                  <tr key={p.date}>
                    <td className="lbl">{fmtDate(p.date)}</td>
                    <td className="num">{isFinite(p.review_score) ? p.review_score.toFixed(1) : '—'}</td>
                    <td className="num">{isFinite(p.search_score) ? p.search_score.toFixed(0) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* Open recommendations summary */}
        <Section title="Open recommendations" sub={`${open.length} awaiting action`}>
          {open.length === 0 ? (
            <Empty>No open recommendations — profile is in good shape.</Empty>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {open.slice(0, 5).map((r) => {
                const s = SEV_STYLES[r.severity];
                return (
                  <div key={r.id} style={{ borderLeft: `3px solid ${s.border}`, paddingLeft: 8 }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', background: s.chip, color: s.chipText, padding: '1px 4px', borderRadius: 2, marginRight: 6 }}>{s.label}</span>
                    <span style={{ fontSize: 'var(--t-sm)', color: 'var(--ink)' }}>{r.title}</span>
                  </div>
                );
              })}
              {open.length > 5 && <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>+ {open.length - 5} more · see table below</div>}
            </div>
          )}
        </Section>

        {/* Measured outcomes */}
        <Section title="Measured outcomes" sub={`${measured.length} re-measured · ${worked} worked`}>
          {measured.length === 0 ? (
            <Empty>No outcomes yet. Apply an open recommendation, agent re-measures 14 days later.</Empty>
          ) : (
            <table className="tbl">
              <thead><tr><th>Title</th><th>Verdict</th><th className="num">Δ%</th></tr></thead>
              <tbody>
                {measured.slice(0, 5).map((r) => {
                  const m = measurements.find((x) => x.recommendation_id === r.id);
                  return (
                    <tr key={r.id}>
                      <td className="lbl" style={{ fontSize: 'var(--t-xs)' }}>{r.title.slice(0, 40)}</td>
                      <td>{STATUS_STYLES[r.status]?.label ?? r.status}</td>
                      <td className="num">{m?.delta_pct != null ? `${m.delta_pct >= 0 ? '+' : ''}${m.delta_pct}%` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Section>
      </div>

      {/* Full recommendations table */}
      <div style={{ background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 8, padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--serif)', fontWeight: 500, fontSize: 'var(--t-xl)' }}>All recommendations</h2>
          <span style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-mute)' }}>{recs.length} total · sorted by severity then recency</span>
        </div>
        {recs.length === 0 ? (
          <Empty>No recommendations yet — first crawl pending.</Empty>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recs.map((r) => {
              const s = SEV_STYLES[r.severity];
              const ss = STATUS_STYLES[r.status];
              return (
                <div key={r.id} style={{
                  background: 'var(--paper)', border: `1px solid ${s.border}`, borderLeft: `4px solid ${s.border}`,
                  borderRadius: 6, padding: '12px 14px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', background: s.chip, color: s.chipText, padding: '2px 6px', borderRadius: 3, marginRight: 6 }}>{s.label}</span>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', color: 'var(--ink-mute)' }}>{r.category}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', color: ss?.color ?? 'var(--ink-mute)' }}>
                        {ss?.label ?? r.status}
                      </span>
                      {r.measure_after && r.status === 'applied' && (
                        <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--ink-mute)' }}>
                          measure {fmtDate(r.measure_after)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ fontFamily: 'var(--serif)', fontSize: 'var(--t-lg)', color: 'var(--ink)', lineHeight: 1.3, marginBottom: 6 }}>{r.title}</div>
                  <div style={{ fontSize: 'var(--t-sm)', color: 'var(--ink)', lineHeight: 1.5, marginBottom: 4 }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', color: 'var(--brass)', marginRight: 6 }}>Why:</span>
                    {r.evidence}
                  </div>
                  <div style={{ fontSize: 'var(--t-sm)', color: 'var(--ink)', lineHeight: 1.5, marginBottom: r.expected_impact ? 4 : 0 }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', color: 'var(--brass)', marginRight: 6 }}>Action:</span>
                    {r.recommendation}
                  </div>
                  {r.expected_impact && (
                    <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', borderTop: '1px solid var(--paper-deep)', paddingTop: 6, marginTop: 6 }}>
                      <span style={{ fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', marginRight: 6 }}>Expected:</span>
                      {r.expected_impact}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--paper)', border: '1px dashed var(--line-soft)', borderRadius: 6, fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', lineHeight: 1.5 }}>
        <strong style={{ color: 'var(--brass)' }}>How this agent works (and what's pending):</strong> The crawler runs weekly per OTA via a planned Nimble + LLM Edge Function. It reads the live profile page (photos, description, amenities, response rate, sustainability badge) plus the BDC ranking metrics, generates recommendations, and 14 days after a recommendation is marked &quot;applied&quot; it re-measures the metric to score the outcome. <strong>Today's crawl was synthesized from the existing BDC ranking PDF</strong> — full Nimble scraping wires in next session. Coverage planned: Booking.com, Expedia, Agoda, Trip.com, Airbnb, TripAdvisor, Google Business, Direct.
      </div>
    </>
  );
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 8, padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontFamily: 'var(--serif)', fontWeight: 500, fontSize: 'var(--t-lg)' }}>{title}</h3>
        {sub && <span style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>{sub}</span>}
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '12px', background: 'var(--paper)', border: '1px dashed var(--line-soft)', borderRadius: 6, color: 'var(--ink-mute)', fontSize: 'var(--t-sm)' }}>
      {children}
    </div>
  );
}
