// app/marketing/youtube/page.tsx
// PBS 2026-07-11 pm — YT cockpit. Section A (channel state) now delegates to
// <ChannelDashboard/> which pulls live from YouTube Data API v3. Everything else
// (flow diagram, request form, research, approval queue, schedule, guardrails) untouched.

import Link from 'next/link';
import { DashboardPage } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import RequestVideoForm from './_client/RequestVideoForm';
import ChannelDashboard from './_server/ChannelDashboard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NAMKHAN = 260955;

const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const INK_S  = '#3A3A3A';
const FOREST = '#084838';
const RED    = '#B03826';
const CREAM  = '#F5F0E1';
const AMBER  = '#C28F2C';

interface ConnRow  { id: string; channel_id: string | null; channel_title: string | null; channel_handle: string | null; subscriber_count: number | null; connected_at: string | null; token_expires_at: string | null }
interface PubRow   { publication_id: string; title: string | null; scheduled_publish_utc: string | null; actual_publish_utc: string | null; youtube_video_id: string | null }
interface JobRow   { render_job_id: string; status: string; brief_id: string | null; output_url: string | null; submitted_at_utc: string | null; finished_at_utc: string | null; guardrail_passed_at_utc: string | null; error_msg: string | null }
interface BriefRow { brief_id: string; generated_at_utc: string | null; activation_score: number | null; keyword_seeds: string[] | null }
interface ReqRow   { id: string; status: string; angle: string | null; style: string | null; created_at: string | null }
interface RateRow  { rate_type: string; currency: string; floor_amount: number; ceiling_amount: number; disclaimer_verbatim: string | null }
interface VocabRow { banned_term_lower: string; luxury_alternative: string | null; severity: string | null }
interface BlackRow { competitor_name: string; city: string | null; country_iso2: string | null; reason: string | null }
interface PersonRow{ id: number; full_name: string; role_hint: string | null; active: boolean }

interface LoadResult {
  connection:     ConnRow | null;
  pubsScheduled:  PubRow[];
  pubsRecent:     PubRow[];
  jobs:           JobRow[];
  briefs:         BriefRow[];
  requests:       ReqRow[];
  rates:          RateRow[];
  vocab:          VocabRow[];
  black:          BlackRow[];
  people:         PersonRow[];
}

async function load(): Promise<LoadResult> {
  const sb = getSupabaseAdmin();
  const [conn, pubsAll, jobs, briefs, requests, rates, vocab, black, people] = await Promise.all([
    sb.from('v_yt_channel_connections')
      .select('id,channel_id,channel_title,channel_handle,subscriber_count,connected_at,token_expires_at')
      .eq('property_id', NAMKHAN).eq('active', true).maybeSingle(),
    sb.from('v_yt_publications')
      .select('publication_id,title,scheduled_publish_utc,actual_publish_utc,youtube_video_id')
      .eq('property_id', NAMKHAN).order('created_at', { ascending: false }).limit(40),
    sb.from('v_yt_render_jobs')
      .select('render_job_id,status,brief_id,output_url,submitted_at_utc,finished_at_utc,guardrail_passed_at_utc,error_msg')
      .eq('property_id', NAMKHAN).order('submitted_at_utc', { ascending: false }).limit(30),
    sb.from('v_yt_trend_briefs')
      .select('brief_id,generated_at_utc,activation_score,keyword_seeds')
      .eq('property_id', NAMKHAN).order('generated_at_utc', { ascending: false }).limit(10),
    sb.from('v_yt_video_requests')
      .select('id,status,angle,style,created_at')
      .eq('property_id', NAMKHAN).order('created_at', { ascending: false }).limit(20),
    sb.from('v_yt_rate_card')
      .select('rate_type,currency,floor_amount,ceiling_amount,disclaimer_verbatim')
      .eq('property_id', NAMKHAN).order('rate_type'),
    sb.from('v_yt_vocabulary_matrix')
      .select('banned_term_lower,luxury_alternative,severity')
      .order('severity', { ascending: true }).limit(50),
    sb.from('v_yt_competitors_blacklist')
      .select('competitor_name,city,country_iso2,reason')
      .eq('property_id', NAMKHAN).eq('active', true).order('competitor_name'),
    sb.from('v_yt_approved_people')
      .select('id,full_name,role_hint,active')
      .eq('property_id', NAMKHAN).eq('active', true).order('full_name'),
  ]);

  const pubsData = (pubsAll.data ?? []) as PubRow[];
  const now = Date.now();
  const scheduled = pubsData
    .filter((p) => p.scheduled_publish_utc && !p.actual_publish_utc && new Date(p.scheduled_publish_utc).getTime() >= now)
    .sort((a, b) => new Date(a.scheduled_publish_utc!).getTime() - new Date(b.scheduled_publish_utc!).getTime());
  const recent = pubsData
    .filter((p) => p.actual_publish_utc)
    .sort((a, b) => new Date(b.actual_publish_utc!).getTime() - new Date(a.actual_publish_utc!).getTime())
    .slice(0, 10);

  return {
    connection:     (conn.data ?? null) as ConnRow | null,
    pubsScheduled:  scheduled,
    pubsRecent:     recent,
    jobs:           (jobs.data ?? []) as JobRow[],
    briefs:         (briefs.data ?? []) as BriefRow[],
    requests:       (requests.data ?? []) as ReqRow[],
    rates:          (rates.data ?? []) as RateRow[],
    vocab:          (vocab.data ?? []) as VocabRow[],
    black:          (black.data ?? []) as BlackRow[],
    people:         (people.data ?? []) as PersonRow[],
  };
}

const CARD: React.CSSProperties = {
  background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, padding: 20,
};
const SECTION_H: React.CSSProperties = {
  fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', color: INK_M,
  marginBottom: 12, fontWeight: 500,
};
const TABLE_TH: React.CSSProperties = {
  textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em',
  color: INK_S, padding: '10px 8px', borderBottom: `1px solid ${HAIR}`,
};
const TABLE_TD: React.CSSProperties = {
  padding: '10px 8px', borderBottom: `1px solid ${HAIR}`, fontSize: 13, color: INK, verticalAlign: 'top',
};

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  try { return new Date(d).toISOString().slice(0, 10); } catch { return String(d); }
}
function fmtDateTime(d: string | null | undefined) {
  if (!d) return '—';
  try { return new Date(d).toISOString().slice(0, 16).replace('T', ' '); } catch { return String(d); }
}
function money(x: number | null | undefined, ccy: string) {
  if (x == null) return '—';
  return `${ccy === 'USD' ? '$' : ccy === 'EUR' ? '€' : ''}${Number(x).toFixed(0)}`;
}

function statusPill(s: string) {
  const base: React.CSSProperties = { display: 'inline-block', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', padding: '2px 6px', borderRadius: 2, fontWeight: 600 };
  const map: Record<string, { bg: string; fg: string }> = {
    queued:     { bg: CREAM,     fg: INK_S  },
    scripting:  { bg: CREAM,     fg: INK_S  },
    rendering:  { bg: '#FBF3E0', fg: AMBER  },
    ready:      { bg: '#E8F0EC', fg: FOREST },
    review:     { bg: '#FBF3E0', fg: AMBER  },
    scheduled:  { bg: '#FBF3E0', fg: AMBER  },
    published:  { bg: '#E8F0EC', fg: FOREST },
    failed:     { bg: '#FBE7E4', fg: RED    },
    rejected:   { bg: '#FBE7E4', fg: RED    },
    draft:      { bg: CREAM,     fg: INK_S  },
  };
  const c = map[s.toLowerCase()] ?? { bg: CREAM, fg: INK_S };
  return <span style={{ ...base, background: c.bg, color: c.fg }}>{s}</span>;
}

interface PageProps {
  searchParams?: { connected?: string; err?: string; requested?: string; scanned?: string; ticket?: string; brief?: string };
}

export default async function MarketingYouTubePage({ searchParams }: PageProps) {
  const sp = searchParams ?? {};
  const {
    connection, pubsScheduled, pubsRecent, jobs, briefs, requests, rates, vocab, black, people,
  } = await load();

  const stage_research  = briefs.length;
  const stage_request   = requests.filter((r) => r.status === 'queued').length;
  const stage_script    = requests.filter((r) => r.status === 'scripting').length + jobs.filter((j) => j.status === 'draft').length;
  const stage_guardrail = jobs.filter((j) => j.status === 'ready' && !j.guardrail_passed_at_utc).length;
  const stage_render    = jobs.filter((j) => ['queued','rendering'].includes(j.status)).length;
  const stage_approve   = jobs.filter((j) => j.status === 'ready').length;
  const stage_publish   = pubsScheduled.length;

  const readyForReview = jobs.filter((j) => j.status === 'ready');
  const scheduledCount = pubsScheduled.length;
  const publishedCount = pubsRecent.length;

  const tabs = MARKETING_SUBPAGES.map((s) => ({ key: s.href, label: s.label, href: s.href }));

  const connected = sp.connected === '1';
  const oauthErr  = sp.connected === '0' ? (sp.err ?? 'unknown') : null;

  return (
    <DashboardPage title="YouTube · autonomous channel" tabs={tabs}>
      <div style={{ display: 'grid', gap: 16 }}>

        {connected && (
          <div style={{ ...CARD, background: '#E8F0EC', borderColor: FOREST, gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 13, color: FOREST, fontWeight: 500 }}>
              Channel connected. Tokens stored in vault; Lumen can now publish on approval.
            </div>
          </div>
        )}
        {oauthErr && (
          <div style={{ ...CARD, background: '#FBE7E4', borderColor: RED, gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 13, color: RED, fontWeight: 500 }}>
              OAuth failed: {oauthErr}
            </div>
          </div>
        )}
        {sp.requested === '1' && (
          <div style={{ ...CARD, background: '#E8F0EC', borderColor: FOREST, gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 13, color: FOREST }}>
              Request queued for Lumen{sp.ticket ? ` · ticket #${sp.ticket}` : ''}.
            </div>
          </div>
        )}
        {sp.scanned === '1' && (
          <div style={{ ...CARD, background: '#E8F0EC', borderColor: FOREST, gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 13, color: FOREST }}>
              Trend-scan brief created{sp.ticket ? ` · ticket #${sp.ticket}` : ''}. Full trend-scout handler ships in phase B.
            </div>
          </div>
        )}

        {/* ===== A · Channel dashboard (live from Data API v3) OR connect button ===== */}
        {connection ? (
          <ChannelDashboard propertyId={NAMKHAN} />
        ) : (
          <div style={{ ...CARD, gridColumn: '1 / -1' }}>
            <div style={SECTION_H}>Channel state</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
              <div>
                <div style={{ fontSize: 15, color: INK, marginBottom: 8 }}>
                  YouTube channel not connected.
                </div>
                <div style={{ fontSize: 13, color: INK_M, marginBottom: 14, lineHeight: 1.5 }}>
                  Grants Lumen read + upload + publish scope so approved videos ship straight to the channel.
                  Tokens land in Supabase vault, never touch the browser.
                </div>
                <Link href={`/api/marketing/youtube/oauth-start?property_id=${NAMKHAN}`}
                  style={{
                    display: 'inline-block', padding: '10px 18px', border: `1px solid ${FOREST}`,
                    borderRadius: 3, background: FOREST, color: WHITE, fontSize: 13,
                    letterSpacing: '.04em', textTransform: 'uppercase', textDecoration: 'none', fontWeight: 500,
                  }}>
                  Connect YouTube channel
                </Link>
              </div>
              <div style={{ display: 'grid', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: INK_S, marginBottom: 4 }}>
                    House voice
                  </div>
                  <div style={{ fontSize: 13, color: INK_M }}>
                    Namkhan house voice: not cloned yet. Phase B wires ElevenLabs voice-clone for narration.
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: INK_S, marginBottom: 4 }}>
                    Talking-head roster
                  </div>
                  <div style={{ fontSize: 13, color: INK }}>
                    {people.length} approved {people.length === 1 ? 'person' : 'people'} on file
                    {people.length > 0 ? `: ${people.map((p) => p.full_name).join(', ')}` : ''}.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== B · Flow diagram =========================================== */}
        <div style={{ ...CARD, gridColumn: '1 / -1' }}>
          <div style={SECTION_H}>Pipeline · stage → agent → in flight</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
            <FlowChevron n={1} title="Research"    agent="Probe" count={stage_research}  phaseB={false} />
            <FlowChevron n={2} title="Request"     agent="PBS/Lumen" count={stage_request} phaseB={false} />
            <FlowChevron n={3} title="Script + EDL" agent="Reel" count={stage_script}   phaseB={true}  />
            <FlowChevron n={4} title="Guardrail"   agent="Lumen HoD" count={stage_guardrail} phaseB={true}  />
            <FlowChevron n={5} title="Render"      agent="Reel + Shotstack" count={stage_render} phaseB={true}  />
            <FlowChevron n={6} title="Approve"     agent="PBS" count={stage_approve}    phaseB={false} />
            <FlowChevron n={7} title="Publish"     agent="Quill + Tribe" count={stage_publish}  phaseB={true}  />
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: INK_M }}>
            Amber label = phase B (skill handler not built yet — the skill is granted but no code executes it).
            Green = wired and functional now.
          </div>
        </div>

        {/* ===== C · Request a video ======================================= */}
        <div style={{ ...CARD, gridColumn: '1 / -1' }}>
          <div style={SECTION_H}>Request a video · goes to Lumen (marketing HoD)</div>
          <RequestVideoForm
            propertyId={NAMKHAN}
            briefs={briefs.map((b) => ({ brief_id: b.brief_id, generated_at_utc: b.generated_at_utc }))}
            approvedPeople={people.map((p) => ({ id: p.id, full_name: p.full_name }))}
          />
          {requests.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ ...SECTION_H, fontSize: 11 }}>Recent requests (20)</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <th style={TABLE_TH}>When</th>
                  <th style={TABLE_TH}>Style</th>
                  <th style={TABLE_TH}>Angle</th>
                  <th style={TABLE_TH}>Status</th>
                </tr></thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id}>
                      <td style={{ ...TABLE_TD, color: INK_M, whiteSpace: 'nowrap' }}>{fmtDate(r.created_at)}</td>
                      <td style={{ ...TABLE_TD, color: INK_M, whiteSpace: 'nowrap' }}>{r.style ?? '—'}</td>
                      <td style={TABLE_TD}>{r.angle ?? '—'}</td>
                      <td style={TABLE_TD}>{statusPill(r.status ?? 'queued')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ===== D · Research =============================================== */}
        <div style={{ ...CARD, gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <div style={{ ...SECTION_H, marginBottom: 0 }}>Research · Probe (weekly trend scout)</div>
            <form action="/api/marketing/youtube/scan-trends" method="post" style={{ margin: 0 }}>
              <input type="hidden" name="property_id" value={NAMKHAN} />
              <button type="submit" style={{
                padding: '6px 12px', border: `1px solid ${HAIR}`, borderRadius: 3,
                background: WHITE, color: INK, fontSize: 12, cursor: 'pointer',
              }}>
                Run scan (phase A stub)
              </button>
            </form>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
            <div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: INK_S, marginBottom: 8 }}>
                Recent briefs
              </div>
              {briefs.length === 0 ? (
                <div style={{ fontSize: 13, color: INK_M }}>
                  No briefs yet. Click &ldquo;Run scan&rdquo; to create a placeholder (phase A). Real trend scout comes in phase B.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    <th style={TABLE_TH}>Generated</th>
                    <th style={TABLE_TH}>Score</th>
                    <th style={TABLE_TH}>Seeds</th>
                  </tr></thead>
                  <tbody>
                    {briefs.map((b) => (
                      <tr key={b.brief_id}>
                        <td style={{ ...TABLE_TD, color: INK_M, whiteSpace: 'nowrap' }}>{fmtDate(b.generated_at_utc)}</td>
                        <td style={TABLE_TD}>{b.activation_score ?? '—'}</td>
                        <td style={{ ...TABLE_TD, color: INK_M }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {(b.keyword_seeds ?? []).slice(0, 6).map((s) => (
                              <span key={s} style={{ background: CREAM, padding: '2px 6px', borderRadius: 2, fontSize: 11 }}>{s}</span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: INK_S, marginBottom: 8 }}>
                  Keyword seeds (config)
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {['retreat','wellness','luang prabang','laos boat','riverside dining','art suite'].map((k) => (
                    <span key={k} style={{ background: CREAM, padding: '4px 10px', borderRadius: 2, fontSize: 12, color: INK }}>{k}</span>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: INK_S, marginBottom: 8 }}>
                  Competitor blacklist ({black.length})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {black.length === 0 ? (
                    <span style={{ fontSize: 12, color: INK_M }}>None active for this property.</span>
                  ) : (
                    black.map((c) => (
                      <span key={c.competitor_name} title={c.reason ?? undefined}
                        style={{ background: '#FBE7E4', color: RED, padding: '4px 10px', borderRadius: 2, fontSize: 12 }}>
                        {c.competitor_name}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== E · Approval queue ======================================== */}
        <div style={{ ...CARD, gridColumn: '1 / -1' }}>
          <div style={SECTION_H}>Approval queue · renders waiting on you</div>
          {readyForReview.length === 0 ? (
            <div style={{ fontSize: 13, color: INK_M }}>
              Nothing awaiting review. When Reel finishes a render, it lands here with a preview + edit / approve / reject buttons (phase B).
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={TABLE_TH}>Preview</th>
                <th style={TABLE_TH}>Job</th>
                <th style={TABLE_TH}>Guardrail</th>
                <th style={TABLE_TH}>Finished</th>
                <th style={TABLE_TH}>Actions</th>
              </tr></thead>
              <tbody>
                {readyForReview.map((j) => (
                  <tr key={j.render_job_id}>
                    <td style={TABLE_TD}>
                      {j.output_url ? (
                        <a href={j.output_url} target="_blank" rel="noreferrer" style={{ color: FOREST, fontSize: 12 }}>Open MP4</a>
                      ) : '—'}
                    </td>
                    <td style={{ ...TABLE_TD, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11 }}>
                      {j.render_job_id.slice(0, 8)}&hellip;
                    </td>
                    <td style={TABLE_TD}>
                      {j.guardrail_passed_at_utc
                        ? <span style={{ color: FOREST, fontSize: 12 }}>passed {fmtDate(j.guardrail_passed_at_utc)}</span>
                        : <span style={{ color: AMBER, fontSize: 12 }}>pending</span>}
                    </td>
                    <td style={{ ...TABLE_TD, color: INK_M }}>{fmtDate(j.finished_at_utc)}</td>
                    <td style={TABLE_TD}>
                      <span style={{ fontSize: 11, color: INK_M }}>Approve / Edit / Reject &mdash; phase B</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ===== F · Schedule + Published =================================== */}
        <div style={{ ...CARD, gridColumn: '1 / -1' }}>
          <div style={SECTION_H}>Schedule + published</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
            <div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: INK_S, marginBottom: 8 }}>
                Upcoming ({scheduledCount})
              </div>
              {pubsScheduled.length === 0 ? (
                <div style={{ fontSize: 13, color: INK_M }}>Nothing scheduled.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    <th style={TABLE_TH}>When</th>
                    <th style={TABLE_TH}>Title</th>
                  </tr></thead>
                  <tbody>
                    {pubsScheduled.map((p) => (
                      <tr key={p.publication_id}>
                        <td style={{ ...TABLE_TD, color: INK_M, whiteSpace: 'nowrap' }}>{fmtDateTime(p.scheduled_publish_utc)}</td>
                        <td style={TABLE_TD}>{p.title ?? '(untitled)'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: INK_S, marginBottom: 8 }}>
                Recent published ({publishedCount})
              </div>
              {pubsRecent.length === 0 ? (
                <div style={{ fontSize: 13, color: INK_M }}>Nothing published yet.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    <th style={TABLE_TH}>When</th>
                    <th style={TABLE_TH}>Title</th>
                    <th style={TABLE_TH}>Link</th>
                  </tr></thead>
                  <tbody>
                    {pubsRecent.map((p) => (
                      <tr key={p.publication_id}>
                        <td style={{ ...TABLE_TD, color: INK_M, whiteSpace: 'nowrap' }}>{fmtDate(p.actual_publish_utc)}</td>
                        <td style={TABLE_TD}>{p.title ?? '(untitled)'}</td>
                        <td style={TABLE_TD}>
                          {p.youtube_video_id
                            ? <a href={`https://youtu.be/${p.youtube_video_id}`} target="_blank" rel="noreferrer" style={{ color: FOREST, fontSize: 12 }}>Watch</a>
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* ===== G · Guardrails (accordion) ================================ */}
        <details style={{ ...CARD, gridColumn: '1 / -1' }}>
          <summary style={{ cursor: 'pointer', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', color: INK_M, fontWeight: 500 }}>
            Guardrails · rate card, vocabulary, blacklist, approved people
          </summary>
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            <div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: INK_S, marginBottom: 8 }}>
                Rate card ({rates.length})
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <th style={TABLE_TH}>Type</th>
                  <th style={TABLE_TH}>Floor</th>
                  <th style={TABLE_TH}>Ceiling</th>
                </tr></thead>
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

            <div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: INK_S, marginBottom: 8 }}>
                Vocabulary matrix ({vocab.length})
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <th style={TABLE_TH}>Banned</th>
                  <th style={TABLE_TH}>Prefer</th>
                  <th style={TABLE_TH}>Sev</th>
                </tr></thead>
                <tbody>
                  {vocab.map((v) => (
                    <tr key={v.banned_term_lower}>
                      <td style={{ ...TABLE_TD, color: RED }}>{v.banned_term_lower}</td>
                      <td style={{ ...TABLE_TD, color: FOREST }}>{v.luxury_alternative ?? '—'}</td>
                      <td style={{ ...TABLE_TD, color: INK_M }}>{v.severity ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: INK_S, marginBottom: 8 }}>
                Competitor blacklist ({black.length})
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <th style={TABLE_TH}>Competitor</th>
                  <th style={TABLE_TH}>Where</th>
                  <th style={TABLE_TH}>Why</th>
                </tr></thead>
                <tbody>
                  {black.map((c) => (
                    <tr key={c.competitor_name}>
                      <td style={TABLE_TD}>{c.competitor_name}</td>
                      <td style={{ ...TABLE_TD, color: INK_M }}>{[c.city, c.country_iso2].filter(Boolean).join(', ') || '—'}</td>
                      <td style={{ ...TABLE_TD, color: INK_M, fontSize: 12 }}>{c.reason ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: INK_S, marginBottom: 8 }}>
                Approved people ({people.length})
              </div>
              {people.length === 0 ? (
                <div style={{ fontSize: 13, color: INK_M }}>
                  No approved people on file. Add a row to <code>marketing.yt_approved_people</code> with a signed model-release doc id.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    <th style={TABLE_TH}>Name</th>
                    <th style={TABLE_TH}>Role</th>
                  </tr></thead>
                  <tbody>
                    {people.map((p) => (
                      <tr key={p.id}>
                        <td style={TABLE_TD}>{p.full_name}</td>
                        <td style={{ ...TABLE_TD, color: INK_M }}>{p.role_hint ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </details>
      </div>
    </DashboardPage>
  );
}

function FlowChevron({ n, title, agent, count, phaseB }: { n: number; title: string; agent: string; count: number; phaseB: boolean }) {
  const accent = phaseB ? AMBER : FOREST;
  return (
    <div style={{
      background: WHITE, border: `1px solid ${HAIR}`, borderLeft: `3px solid ${accent}`,
      borderRadius: 3, padding: '10px 10px', display: 'grid', gap: 4,
    }}>
      <div style={{ fontSize: 10, color: INK_M, letterSpacing: '.06em' }}>
        Step {n} · <span style={{ color: accent }}>{phaseB ? 'phase B' : 'live'}</span>
      </div>
      <div style={{ fontSize: 13, color: INK, fontWeight: 500 }}>{title}</div>
      <div style={{ fontSize: 11, color: INK_M }}>{agent}</div>
      <div style={{ fontSize: 20, color: INK, fontWeight: 500, lineHeight: 1, marginTop: 2 }}>
        {count}
      </div>
      <div style={{ fontSize: 10, color: INK_M }}>in flight</div>
    </div>
  );
}
