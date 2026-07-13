// app/marketing/youtube/production/page.tsx
// PBS 2026-07-13 — Production sub-tab: flow chevrons + request form + ready for review
// + rate card + vocabulary + blacklist + approved people.
import { DashboardPage } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import RequestVideoForm from '../_client/RequestVideoForm';
import StartProductionButton from '../_client/StartProductionButton';
import YtSubTabs from '../_shared/SubTabs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NAMKHAN = 260955;
const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const INK_S  = '#3A3A3A';
const FOREST = '#084838';
const CREAM  = '#F5F0E1';
const AMBER  = '#B48A3A';
const RED    = '#B03826';

interface JobRow { render_job_id: string; status: string; brief_id: string | null; output_url: string | null; submitted_at_utc: string | null; finished_at_utc: string | null; guardrail_passed_at_utc: string | null; error_msg: string | null }
interface ReqRow { id: string; status: string; angle: string | null; style: string | null; duration_seconds: number | null; created_at: string | null }
interface BriefRow { brief_id: string; generated_at_utc: string | null }
interface PersonRow{ id: number; full_name: string }
interface RateRow  { rate_type: string; currency: string; floor_amount: number; ceiling_amount: number; disclaimer_verbatim: string | null }
interface VocabRow { banned_term_lower: string; luxury_alternative: string | null; severity: string | null }
interface BlackRow { competitor_name: string; city: string | null; country_iso2: string | null; reason: string | null }

export default async function YouTubeProductionPage() {
  const sb = getSupabaseAdmin();
  const [jobsRes, requestsRes, briefsRes, peopleRes, ratesRes, vocabRes, blackRes] = await Promise.all([
    sb.from('v_yt_render_jobs')
      .select('render_job_id,status,brief_id,output_url,submitted_at_utc,finished_at_utc,guardrail_passed_at_utc,error_msg')
      .eq('property_id', NAMKHAN).order('submitted_at_utc', { ascending: false }).limit(30),
    sb.from('v_yt_video_requests')
      .select('id,status,angle,style,duration_seconds,created_at')
      .eq('property_id', NAMKHAN).order('created_at', { ascending: false }).limit(20),
    sb.from('v_yt_trend_briefs')
      .select('brief_id,generated_at_utc')
      .eq('property_id', NAMKHAN).order('generated_at_utc', { ascending: false }).limit(10),
    sb.from('v_yt_approved_people')
      .select('id,full_name')
      .eq('property_id', NAMKHAN).eq('active', true).order('full_name'),
    sb.from('v_yt_rate_card')
      .select('rate_type,currency,floor_amount,ceiling_amount,disclaimer_verbatim')
      .eq('property_id', NAMKHAN).order('rate_type'),
    sb.from('v_yt_vocabulary_matrix')
      .select('banned_term_lower,luxury_alternative,severity')
      .order('severity').limit(50),
    sb.from('v_yt_competitors_blacklist')
      .select('competitor_name,city,country_iso2,reason')
      .eq('property_id', NAMKHAN).eq('active', true).order('competitor_name'),
  ]);
  const jobs = (jobsRes.data ?? []) as JobRow[];
  const requests = (requestsRes.data ?? []) as ReqRow[];
  const briefs = (briefsRes.data ?? []) as BriefRow[];
  const people = (peopleRes.data ?? []) as PersonRow[];
  const rates = (ratesRes.data ?? []) as RateRow[];
  const vocab = (vocabRes.data ?? []) as VocabRow[];
  const black = (blackRes.data ?? []) as BlackRow[];

  const readyForReview = jobs.filter((j) => j.status === 'ready');
  const stage_research  = briefs.length;
  const stage_request   = requests.filter((r) => r.status === 'queued').length;
  const stage_script    = requests.filter((r) => r.status === 'scripting').length + jobs.filter((j) => j.status === 'draft').length;
  const stage_render    = jobs.filter((j) => ['queued','rendering'].includes(j.status)).length;
  const stage_approve   = jobs.filter((j) => j.status === 'ready').length;
  const totalStages = stage_research + stage_request + stage_script + stage_render + stage_approve;

  const tabs = MARKETING_SUBPAGES.map((s) => ({ key: s.href, label: s.label, href: s.href }));
  const cardStyle: React.CSSProperties = { background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, padding: 20, gridColumn: '1 / -1' };
  const sectionH: React.CSSProperties = { fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', color: INK_M, marginBottom: 12, fontWeight: 500 };

  function money(x: number | null | undefined, ccy: string) {
    if (x == null) return '—';
    return `${ccy === 'USD' ? '$' : ccy === 'EUR' ? '€' : ''}${Number(x).toFixed(0)}`;
  }

  return (
    <DashboardPage title="YouTube · channel management" tabs={tabs}>
      <div style={{ display: 'grid', gap: 16 }}>
        <YtSubTabs current="production" />

        {/* Flow chevrons — collapse if all zero */}
        {totalStages > 0 ? (
          <div style={cardStyle}>
            <div style={sectionH}>Pipeline · in flight</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, fontSize: 12 }}>
              {[
                { label: 'Research', n: stage_research },
                { label: 'Request',  n: stage_request },
                { label: 'Script',   n: stage_script },
                { label: 'Render',   n: stage_render },
                { label: 'Approve',  n: stage_approve },
              ].map((s) => (
                <div key={s.label} style={{ padding: 12, background: s.n > 0 ? '#E8F0EC' : CREAM, borderRadius: 3, textAlign: 'center', border: `1px solid ${HAIR}` }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: s.n > 0 ? FOREST : INK_M }}>{s.n}</div>
                  <div style={{ fontSize: 10, color: INK_M, textTransform: 'uppercase', letterSpacing: '.06em' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ ...cardStyle, background: CREAM }}>
            <div style={{ fontSize: 12, color: INK_S }}>
              <strong>Pipeline dormant.</strong> Request a video below to kick off Research → Script → Render → Approve.
            </div>
          </div>
        )}

        {/* Request form */}
        <div style={cardStyle}>
          <div style={sectionH}>Request a video · goes to Lumen (marketing HoD)</div>
          <RequestVideoForm
            propertyId={NAMKHAN}
            briefs={briefs.map((b) => ({ brief_id: b.brief_id, generated_at_utc: b.generated_at_utc }))}
            approvedPeople={people.map((p) => ({ id: p.id, full_name: p.full_name }))}
          />
        </div>

        {/* Queued for production — PBS 2026-07-13 */}
        {requests.filter((r) => r.status === 'queued').length > 0 && (
          <div style={cardStyle}>
            <div style={sectionH}>Queued for production ({requests.filter((r) => r.status === 'queued').length})</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr>
                <th style={{ textAlign: 'left', padding: '8px', borderBottom: `1px solid ${HAIR}`, fontSize: 10, color: INK_M, textTransform: 'uppercase' }}>Title / angle</th>
                <th style={{ textAlign: 'left', padding: '8px', borderBottom: `1px solid ${HAIR}`, fontSize: 10, color: INK_M, textTransform: 'uppercase' }}>Style</th>
                <th style={{ textAlign: 'left', padding: '8px', borderBottom: `1px solid ${HAIR}`, fontSize: 10, color: INK_M, textTransform: 'uppercase' }}>Length</th>
                <th style={{ textAlign: 'left', padding: '8px', borderBottom: `1px solid ${HAIR}`, fontSize: 10, color: INK_M, textTransform: 'uppercase' }}>Queued</th>
                <th style={{ textAlign: 'right', padding: '8px', borderBottom: `1px solid ${HAIR}`, fontSize: 10, color: INK_M, textTransform: 'uppercase' }}>Action</th>
              </tr></thead>
              <tbody>{requests.filter((r) => r.status === 'queued').map((r) => {
                const firstLine = (r.angle ?? '(untitled)').split('\n')[0];
                return (
                  <tr key={r.id}>
                    <td style={{ padding: '8px', borderBottom: `1px solid ${HAIR}`, color: INK }}>{firstLine}</td>
                    <td style={{ padding: '8px', borderBottom: `1px solid ${HAIR}`, color: INK_M }}>{r.style ?? '—'}</td>
                    <td style={{ padding: '8px', borderBottom: `1px solid ${HAIR}`, color: INK_M }}>{r.duration_seconds != null ? `${r.duration_seconds}s` : '—'}</td>
                    <td style={{ padding: '8px', borderBottom: `1px solid ${HAIR}`, color: INK_M, fontSize: 11 }}>{r.created_at ? new Date(r.created_at).toISOString().slice(0, 16).replace('T', ' ') : '—'}</td>
                    <td style={{ padding: '8px', borderBottom: `1px solid ${HAIR}`, textAlign: 'right' }}>
                      <StartProductionButton requestId={r.id} />
                    </td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}

        {/* Ready for review */}
        {readyForReview.length > 0 && (
          <div style={cardStyle}>
            <div style={sectionH}>Ready for review ({readyForReview.length})</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr>
                <th style={{ textAlign: 'left', padding: '8px', borderBottom: `1px solid ${HAIR}`, fontSize: 10, color: INK_M, textTransform: 'uppercase' }}>Job</th>
                <th style={{ textAlign: 'left', padding: '8px', borderBottom: `1px solid ${HAIR}`, fontSize: 10, color: INK_M, textTransform: 'uppercase' }}>Finished</th>
                <th style={{ textAlign: 'left', padding: '8px', borderBottom: `1px solid ${HAIR}`, fontSize: 10, color: INK_M, textTransform: 'uppercase' }}>Preview</th>
              </tr></thead>
              <tbody>{readyForReview.map((j) => (
                <tr key={j.render_job_id}>
                  <td style={{ padding: '8px', borderBottom: `1px solid ${HAIR}`, fontFamily: 'monospace', color: INK_S }}>{j.render_job_id.slice(0, 8)}</td>
                  <td style={{ padding: '8px', borderBottom: `1px solid ${HAIR}`, color: INK }}>{j.finished_at_utc ? new Date(j.finished_at_utc).toISOString().slice(0, 16).replace('T', ' ') : '—'}</td>
                  <td style={{ padding: '8px', borderBottom: `1px solid ${HAIR}` }}>{j.output_url ? <a href={j.output_url} target="_blank" rel="noreferrer noopener" style={{ color: FOREST }}>Watch ↗</a> : '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

        {/* Rate card + vocabulary + blacklist */}
        <div style={{ ...cardStyle, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          <div>
            <div style={sectionH}>Rate card ({rates.length})</div>
            {rates.length === 0 ? <div style={{ fontSize: 12, color: INK_M }}>Not seeded yet.</div> : (
              <table style={{ width: '100%', fontSize: 11 }}>
                <tbody>{rates.map((r) => (
                  <tr key={r.rate_type}>
                    <td style={{ padding: '4px 0', color: INK }}>{r.rate_type}</td>
                    <td style={{ padding: '4px 0', color: INK_M, textAlign: 'right' }}>{money(r.floor_amount, r.currency)}–{money(r.ceiling_amount, r.currency)}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
          <div>
            <div style={sectionH}>Vocabulary matrix ({vocab.length})</div>
            {vocab.length === 0 ? <div style={{ fontSize: 12, color: INK_M }}>None.</div> : (
              <div style={{ fontSize: 11, color: INK, maxHeight: 160, overflow: 'auto' }}>
                {vocab.slice(0, 15).map((v) => (
                  <div key={v.banned_term_lower} style={{ padding: '3px 0', borderBottom: `1px dashed ${HAIR}` }}>
                    <span style={{ color: RED }}>{v.banned_term_lower}</span>{v.luxury_alternative && <> → <span style={{ color: FOREST }}>{v.luxury_alternative}</span></>}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <div style={sectionH}>Blacklist ({black.length})</div>
            {black.length === 0 ? <div style={{ fontSize: 12, color: INK_M }}>None.</div> : (
              <div style={{ fontSize: 11 }}>{black.map((b) => (
                <div key={b.competitor_name} style={{ padding: '3px 0', borderBottom: `1px dashed ${HAIR}`, color: INK }}>
                  {b.competitor_name}{b.city && ` · ${b.city}`}{b.country_iso2 && ` · ${b.country_iso2}`}
                </div>
              ))}</div>
            )}
          </div>
        </div>

        {/* Approved people */}
        {people.length > 0 && (
          <div style={cardStyle}>
            <div style={sectionH}>Approved on-screen people ({people.length})</div>
            <div style={{ fontSize: 12, color: INK, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {people.map((p) => (
                <span key={p.id} style={{ padding: '4px 8px', background: CREAM, borderRadius: 2 }}>{p.full_name}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardPage>
  );
}
