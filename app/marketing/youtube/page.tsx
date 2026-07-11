// app/marketing/youtube/page.tsx
// PBS 2026-07-11 pm — Autonomous YouTube Channel · Namkhan landing.
// Reads public.v_yt_* bridges (marketing.yt_* base). Phase 1 shell: KPIs +
// trend briefs + render jobs + publications + rate card + vocabulary matrix.
// Phase 2 wires the 8 skill handlers under /api/cockpit/skills/*.

import { DashboardPage } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

const NAMKHAN = 260955;

const WHITE = '#FFFFFF';
const HAIR  = '#E6DFCC';
const INK   = '#1B1B1B';
const INK_M = '#5A5A5A';
const INK_S = '#3A3A3A';
const FOREST = '#084838';
const RED    = '#B03826';
const CREAM  = '#F5F0E1';
const AMBER  = '#C28F2C';

interface PubRow  { publication_id: string; title: string | null; scheduled_publish_utc: string | null; actual_publish_utc: string | null; youtube_video_id: string | null; approved_by_email: string | null }
interface JobRow  { render_job_id: string; status: string; cost_usd: number | null; submitted_at_utc: string | null; finished_at_utc: string | null; output_url: string | null; error_msg: string | null }
interface BriefRow{ brief_id: string; generated_at_utc: string | null; activation_score: number | null; keyword_seeds: string[] | null }
interface RateRow { rate_type: string; currency: string; floor_amount: number; ceiling_amount: number; valid_from: string | null; valid_to: string | null }
interface VocabRow{ banned_term_lower: string; luxury_alternative: string | null; severity: string | null }
interface BlackRow{ competitor_name: string; city: string | null; country_iso2: string | null; reason: string | null }

async function loadNamkhan() {
  const sb = getSupabaseAdmin();
  const [pubs, jobs, briefs, rates, vocab, black] = await Promise.all([
    sb.from('v_yt_publications').select('publication_id,title,scheduled_publish_utc,actual_publish_utc,youtube_video_id,approved_by_email').eq('property_id', NAMKHAN).order('created_at', { ascending: false }).limit(20),
    sb.from('v_yt_render_jobs').select('render_job_id,status,cost_usd,submitted_at_utc,finished_at_utc,output_url,error_msg').eq('property_id', NAMKHAN).order('submitted_at_utc', { ascending: false }).limit(20),
    sb.from('v_yt_trend_briefs').select('brief_id,generated_at_utc,activation_score,keyword_seeds').eq('property_id', NAMKHAN).order('generated_at_utc', { ascending: false }).limit(10),
    sb.from('v_yt_rate_card').select('rate_type,currency,floor_amount,ceiling_amount,valid_from,valid_to').eq('property_id', NAMKHAN).order('rate_type'),
    sb.from('v_yt_vocabulary_matrix').select('banned_term_lower,luxury_alternative,severity').order('severity').limit(50),
    sb.from('v_yt_competitors_blacklist').select('competitor_name,city,country_iso2,reason').eq('property_id', NAMKHAN).eq('active', true).limit(20),
  ]);
  return {
    pubs:   (pubs.data   ?? []) as PubRow[],
    jobs:   (jobs.data   ?? []) as JobRow[],
    briefs: (briefs.data ?? []) as BriefRow[],
    rates:  (rates.data  ?? []) as RateRow[],
    vocab:  (vocab.data  ?? []) as VocabRow[],
    black:  (black.data  ?? []) as BlackRow[],
  };
}

const KPI_SPEC = [
  { slug: 'yt_publication_count', label: 'Publications',      unit: 'count'   },
  { slug: 'yt_reach',             label: 'Reach',              unit: 'count'   },
  { slug: 'yt_subs',              label: 'Subscribers',        unit: 'count'   },
  { slug: 'yt_watch_time',        label: 'Watch time',         unit: 'minutes' },
  { slug: 'yt_ctr',               label: 'CTR',                unit: '%'       },
  { slug: 'brand_safety',         label: 'Brand-safety flags', unit: 'count'   },
  { slug: 'content_readiness',    label: 'Content readiness',  unit: 'score'   },
] as const;

const SKILLS = [
  { name: 'youtube_trend_scout',       purpose: 'Weekly · scan YouTube trends + score angles for Namkhan'          },
  { name: 'mkt_video_gap_report',      purpose: 'Compare our channel vs blacklist compset — content gap map'        },
  { name: 'youtube_script_edl_draft',  purpose: 'Draft script + Shotstack EDL from an approved angle'               },
  { name: 'guardrail_scan_yt',         purpose: 'HoD-only · scan script + EDL for vocabulary / brand-safety issues' },
  { name: 'youtube_render_shotstack',  purpose: 'Ship EDL to Shotstack, land MP4 in media assets'                   },
  { name: 'youtube_write_metadata',    purpose: 'Draft title/description/tags/thumbnail from rendered clip'         },
  { name: 'youtube_publish_scheduled', purpose: 'PBS-approval required · schedule publish to YouTube'                },
  { name: 'youtube_analytics_pull',    purpose: 'Daily · pull views/subs/watch-time from YouTube Analytics API'      },
];

const TABLE_TH: React.CSSProperties = { textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', color: INK_S, padding: '10px 8px', borderBottom: `1px solid ${HAIR}` };
const TABLE_TD: React.CSSProperties = { padding: '10px 8px', borderBottom: `1px solid ${HAIR}`, fontSize: 13, color: INK, verticalAlign: 'top' };
const CARD: React.CSSProperties     = { background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, padding: 20 };
const SECTION_H: React.CSSProperties= { fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', color: INK_M, marginBottom: 12, fontWeight: 500 };

function statusPill(s: string) {
  const base: React.CSSProperties = { display: 'inline-block', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', padding: '2px 6px', borderRadius: 2, fontWeight: 600 };
  const map: Record<string, { bg: string; fg: string }> = {
    queued:    { bg: CREAM,    fg: INK_S  },
    rendering: { bg: '#FBF3E0',fg: AMBER  },
    ready:     { bg: '#E8F0EC',fg: FOREST },
    published: { bg: '#E8F0EC',fg: FOREST },
    failed:    { bg: '#FBE7E4',fg: RED    },
    scheduled: { bg: '#FBF3E0',fg: AMBER  },
    draft:     { bg: CREAM,    fg: INK_S  },
  };
  const c = map[s.toLowerCase()] ?? { bg: CREAM, fg: INK_S };
  return <span style={{ ...base, background: c.bg, color: c.fg }}>{s}</span>;
}

function money(x: number | null | undefined, ccy: string) {
  if (x == null) return '—';
  return `${ccy === 'USD' ? '$' : ccy === 'EUR' ? '€' : ''}${Number(x).toFixed(0)}`;
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  try { return new Date(d).toISOString().slice(0, 10); } catch { return String(d); }
}

export default async function MarketingYouTubePage() {
  const { pubs, jobs, briefs, rates, vocab, black } = await loadNamkhan();

  const pubCount = pubs.length;
  const readyReview = jobs.filter((j) => j.status === 'ready').length;
  const inFlight = jobs.filter((j) => ['queued','rendering'].includes(j.status)).length;
  const failedJobs = jobs.filter((j) => j.status === 'failed').length;

  const tabs = MARKETING_SUBPAGES.map((s) => ({ label: s.label, href: s.href }));

  return (
    <DashboardPage
      title="YouTube"
      subtitle="Autonomous YouTube channel · Namkhan · agent-native (Lumen · Probe · Reel · Lumen · Quill · Tribe)"
      tabs={tabs}
      currentTab="/marketing/digital"
    >
      <div style={{ display: 'grid', gap: 16 }}>
        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <KpiStub label="Publications"      value={String(pubCount)}     hint="all-time on file" />
          <KpiStub label="Ready to review"   value={String(readyReview)}  hint="Shotstack renders awaiting metadata" />
          <KpiStub label="In-flight renders" value={String(inFlight)}     hint="queued + rendering" />
          <KpiStub label="Failed renders"    value={String(failedJobs)}   hint="need Reel triage" />
        </div>

        {/* M0 status banner */}
        <div style={{ ...CARD, background: CREAM }}>
          <div style={{ ...SECTION_H, marginBottom: 8 }}>Module status · M0 phase A landed</div>
          <div style={{ fontSize: 13, color: INK, lineHeight: 1.55 }}>
            8 tables · 7 KPIs · 8 skills · 16 agent grants · 10 rate-card rows · vocabulary matrix (32 rules) · competitor blacklist (13 comps).<br />
            <strong>Phase B (next):</strong> ship 8 TS handlers under <code>/api/cockpit/skills/*</code> so agents can execute. Shotstack + YouTube OAuth secrets live in vault as of 2026-07-11.
          </div>
        </div>

        {/* KPI catalog reference */}
        <div style={CARD}>
          <div style={SECTION_H}>KPI catalog · M0 seed</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={TABLE_TH}>Slug</th>
                <th style={TABLE_TH}>Label</th>
                <th style={TABLE_TH}>Unit</th>
              </tr>
            </thead>
            <tbody>
              {KPI_SPEC.map((k) => (
                <tr key={k.slug}>
                  <td style={{ ...TABLE_TD, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 }}>{k.slug}</td>
                  <td style={TABLE_TD}>{k.label}</td>
                  <td style={{ ...TABLE_TD, color: INK_M }}>{k.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Skills */}
        <div style={CARD}>
          <div style={SECTION_H}>Skills · 8 granted to Lumen family</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={TABLE_TH}>Skill</th><th style={TABLE_TH}>Purpose</th></tr></thead>
            <tbody>
              {SKILLS.map((s) => (
                <tr key={s.name}>
                  <td style={{ ...TABLE_TD, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 }}>{s.name}</td>
                  <td style={TABLE_TD}>{s.purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Trend briefs */}
        <div style={CARD}>
          <div style={SECTION_H}>Trend briefs · Probe (weekly)</div>
          {briefs.length === 0 ? (
            <div style={{ fontSize: 13, color: INK_M }}>No briefs yet. First scan runs after M0 phase B handlers ship.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={TABLE_TH}>Brief</th><th style={TABLE_TH}>Score</th><th style={TABLE_TH}>Seeds</th><th style={TABLE_TH}>Generated</th></tr></thead>
              <tbody>
                {briefs.map((b) => (
                  <tr key={b.brief_id}>
                    <td style={{ ...TABLE_TD, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11 }}>{b.brief_id.slice(0, 8)}…</td>
                    <td style={TABLE_TD}>{b.activation_score ?? '—'}</td>
                    <td style={{ ...TABLE_TD, color: INK_M }}>{(b.keyword_seeds ?? []).slice(0, 3).join(', ') || '—'}</td>
                    <td style={{ ...TABLE_TD, color: INK_M }}>{fmtDate(b.generated_at_utc)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Render jobs */}
        <div style={CARD}>
          <div style={SECTION_H}>Render jobs · Reel + Shotstack</div>
          {jobs.length === 0 ? (
            <div style={{ fontSize: 13, color: INK_M }}>No render jobs yet.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={TABLE_TH}>Job</th><th style={TABLE_TH}>Status</th>
                <th style={TABLE_TH}>Cost (USD)</th><th style={TABLE_TH}>Submitted</th>
                <th style={TABLE_TH}>Finished</th><th style={TABLE_TH}>Error</th>
              </tr></thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.render_job_id}>
                    <td style={{ ...TABLE_TD, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11 }}>{j.render_job_id.slice(0, 8)}…</td>
                    <td style={TABLE_TD}>{statusPill(j.status)}</td>
                    <td style={TABLE_TD}>{money(j.cost_usd, 'USD')}</td>
                    <td style={{ ...TABLE_TD, color: INK_M }}>{fmtDate(j.submitted_at_utc)}</td>
                    <td style={{ ...TABLE_TD, color: INK_M }}>{fmtDate(j.finished_at_utc)}</td>
                    <td style={{ ...TABLE_TD, color: RED, maxWidth: 240 }}>{j.error_msg ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Publications */}
        <div style={CARD}>
          <div style={SECTION_H}>Publications · scheduled & live</div>
          {pubs.length === 0 ? (
            <div style={{ fontSize: 13, color: INK_M }}>No publications yet. First one lands after Phase B handlers.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={TABLE_TH}>Title</th><th style={TABLE_TH}>Scheduled</th>
                <th style={TABLE_TH}>Published</th><th style={TABLE_TH}>Video ID</th>
                <th style={TABLE_TH}>Approved by</th>
              </tr></thead>
              <tbody>
                {pubs.map((p) => (
                  <tr key={p.publication_id}>
                    <td style={TABLE_TD}>{p.title ?? '(untitled)'}</td>
                    <td style={{ ...TABLE_TD, color: INK_M }}>{fmtDate(p.scheduled_publish_utc)}</td>
                    <td style={{ ...TABLE_TD, color: INK_M }}>{fmtDate(p.actual_publish_utc)}</td>
                    <td style={{ ...TABLE_TD, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11 }}>{p.youtube_video_id ?? '—'}</td>
                    <td style={{ ...TABLE_TD, color: INK_M }}>{p.approved_by_email ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Rate card + vocabulary + blacklist — 3-col grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
          <div style={CARD}>
            <div style={SECTION_H}>Rate card · placeholder</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={TABLE_TH}>Type</th><th style={TABLE_TH}>Floor</th><th style={TABLE_TH}>Ceiling</th></tr></thead>
              <tbody>
                {rates.map((r) => (
                  <tr key={r.rate_type}>
                    <td style={TABLE_TD}>{r.rate_type}</td>
                    <td style={{ ...TABLE_TD, color: INK_M }}>{money(r.floor_amount, r.currency)}</td>
                    <td style={{ ...TABLE_TD, color: INK_M }}>{money(r.ceiling_amount, r.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={CARD}>
            <div style={SECTION_H}>Vocabulary matrix · guardrail (top 10)</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={TABLE_TH}>Banned</th><th style={TABLE_TH}>Prefer</th><th style={TABLE_TH}>Sev</th></tr></thead>
              <tbody>
                {vocab.slice(0, 10).map((v) => (
                  <tr key={v.banned_term_lower}>
                    <td style={{ ...TABLE_TD, color: RED }}>{v.banned_term_lower}</td>
                    <td style={{ ...TABLE_TD, color: FOREST }}>{v.luxury_alternative ?? '—'}</td>
                    <td style={{ ...TABLE_TD, color: INK_M }}>{v.severity ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={CARD}>
            <div style={SECTION_H}>Competitor blacklist · guardrail</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={TABLE_TH}>Competitor</th><th style={TABLE_TH}>Where</th></tr></thead>
              <tbody>
                {black.map((c) => (
                  <tr key={c.competitor_name}>
                    <td style={TABLE_TD}>{c.competitor_name}</td>
                    <td style={{ ...TABLE_TD, color: INK_M }}>{[c.city, c.country_iso2].filter(Boolean).join(', ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardPage>
  );
}

// Lightweight local KPI tile — avoids importing KpiTile if its typing pins to
// numeric-only. Matches paper-white token ladder.
function KpiStub({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, padding: 16 }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: INK_M, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, color: INK, fontWeight: 500, lineHeight: 1 }}>{value}</div>
      {hint ? <div style={{ marginTop: 6, fontSize: 11, color: INK_M }}>{hint}</div> : null}
    </div>
  );
}
