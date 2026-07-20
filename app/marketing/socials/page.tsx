// app/marketing/socials/page.tsx
// PBS 2026-07-20 pm · rebuild — merges legacy /marketing/social's read-side
// (KPI band, channel cards, AI production loop, ICP panel, visual calendar,
// Boost placeholder) with the new post write-side (Posts + New post).
// Numbers policy: only show values that come from live tables. Anything
// waiting on Meta/TikTok API shows a dim em-dash with a "needs API" hint.
// No demo/fake analytics anywhere.

import { DashboardPage, KpiTile, type KpiTileProps } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '@/app/marketing/_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { ActBtn, ActForm } from './_client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PID = 260955;
const PUSHABLE = ['instagram', 'facebook', 'tiktok', 'youtube', 'google_business'];
const READ_ONLY = ['booking', 'expedia', 'tripadvisor'];
const PLAT_LABEL: Record<string, string> = {
  instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok',
  youtube: 'YouTube', google_business: 'Google Business',
  booking: 'Booking.com', expedia: 'Expedia', tripadvisor: 'Tripadvisor',
};
const PLAT_ICON: Record<string, string> = {
  instagram: '📷', facebook: 'ⓕ', tiktok: '♪', youtube: '▶',
  google_business: '★', booking: '🛏', expedia: '✈', tripadvisor: '🦉',
};

const T: any = {
  card: { background: '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 10, padding: 16 },
  h:    { fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5A5A5A', margin: '0 0 12px' },
  muted:{ color: '#5A5A5A', fontSize: 12 },
  dim:  { color: '#8A8A8A', fontSize: 11 },
  btn:  { padding: '7px 12px', background: '#1F3A2E', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' },
  ghost:{ padding: '7px 12px', background: 'transparent', color: '#1B1B1B', border: '1px solid #E6DFCC', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' },
  small:{ padding: '3px 8px', background: 'transparent', color: '#5A5A5A', border: '1px solid #E6DFCC', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' },
  input:{ padding: '7px 9px', border: '1px solid #E6DFCC', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', background: '#FFFFFF', color: '#1B1B1B' },
  sec:  { fontSize: 13, fontWeight: 600, color: '#1F3A2E', margin: '14px 0 6px', paddingBottom: 4, borderBottom: '1px solid #E6DFCC' },
};

// Numbers that require live analytics (Meta/TikTok API not yet granted) render
// as a dim em-dash with a tooltip explaining WHY. Never fake.
function pending(hint: string) {
  return <span title={hint} style={{ color: '#8A8A8A' }}>—</span>;
}
function fmtNum(n: number | null | undefined): string {
  if (n == null) return '—';
  return Number(n).toLocaleString('en-GB');
}

function statusChip(s: string) {
  const map: any = {
    draft:     ['#5A5A5A', '#F4EFE2', 'draft'],
    ready:     ['#1F3A2E', 'rgba(31,58,46,0.10)', 'ready'],
    scheduled: ['#B8542A', 'rgba(184,84,42,0.12)', 'staged'],
    pushed:    ['#2E7D32', 'rgba(46,125,50,0.12)', 'pushed'],
    failed:    ['#B8542A', 'rgba(184,84,42,0.18)', 'failed'],
    cancelled: ['#9A9A9A', '#F4EFE2', 'cancelled'],
  };
  const c = map[s] || map.draft;
  return <span style={{ fontSize: 10, color: c[0], background: c[1], padding: '1px 7px', borderRadius: 99, marginLeft: 6 }}>{c[2]}</span>;
}

function SubTabs({ active }: { active: string }) {
  const tabs: [string, string][] = [
    ['overview', 'Overview'],
    ['channels', 'Channels'],
    ['calendar', 'Calendar'],
    ['posts',    'Posts'],
    ['boost',    'Boost'],
    ['compose',  '+ New'],
  ];
  return (
    <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #E6DFCC', flexWrap: 'wrap' }}>
      {tabs.map(([k, l]) => {
        const on = active === k;
        return (
          <a key={k} href={'/marketing/socials?tab=' + k} style={{
            padding: '6px 12px', fontSize: 13, fontWeight: on ? 600 : 500,
            color: on ? '#1B1B1B' : '#5A5A5A',
            borderBottom: on ? '2px solid #1F3A2E' : '2px solid transparent',
            textDecoration: 'none',
          }}>{l}</a>
        );
      })}
    </div>
  );
}

function fmtWhen(s: string | null) {
  if (!s) return 'no date';
  try { return new Date(s).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return s; }
}
function toLocalInput(s: string | null) {
  if (!s) return '';
  try { const d = new Date(s); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; } catch { return ''; }
}

// -------------------------------------------------------------- Post write card
function PostCard({ p }: { p: any }) {
  return (
    <div style={{ ...T.card, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12, fontWeight: 600 }}>{PLAT_LABEL[p.platform] || p.platform}{statusChip(p.status)}{p.ai_generated ? <span style={{ ...T.muted, marginLeft: 6 }}>· AI</span> : null}</div>
        <div style={T.muted}>{fmtWhen(p.scheduled_at)}</div>
      </div>
      <ActForm op="update" params={{ post_id: p.post_id }} style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
        <textarea name="caption" defaultValue={p.caption || ''} rows={3} placeholder="Caption" style={{ ...T.input, resize: 'vertical' }} />
        <input name="hashtags" defaultValue={(p.hashtags || []).join(' ')} placeholder="#hashtags" style={T.input} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <input name="scheduled_at" type="datetime-local" defaultValue={toLocalInput(p.scheduled_at)} style={{ ...T.input, flex: '1 1 180px' }} />
          <button type="submit" style={T.ghost}>Save</button>
        </div>
      </ActForm>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        {p.status === 'draft' || p.status === 'cancelled' ? <ActBtn op="set_status" params={{ post_id: p.post_id, status: 'scheduled' }} style={T.btn}>Stage →</ActBtn> : null}
        {p.status === 'scheduled' || p.status === 'ready' ? <ActBtn op="set_status" params={{ post_id: p.post_id, status: 'pushed' }} style={T.btn}>Mark pushed</ActBtn> : null}
        {p.status === 'scheduled' ? <ActBtn op="set_status" params={{ post_id: p.post_id, status: 'draft' }} style={T.small}>Unstage</ActBtn> : null}
        {p.status === 'pushed' ? <span style={T.muted}>posted {fmtWhen(p.pushed_at)}</span> : null}
        <ActBtn op="delete" params={{ post_id: p.post_id }} style={T.small}>Delete</ActBtn>
      </div>
    </div>
  );
}

// -------------------------------------------------------------- AI production loop (from legacy)
const LOOP: Array<{ step: number; title: string; desc: string }> = [
  { step: 1, title: 'ICP Signal',    desc: 'Detects which audience segment is under-fed this week from CRM + inquiry mix.' },
  { step: 2, title: 'Trend Watch',   desc: 'Scans platform trends against our brand palette; discards anything off-voice.' },
  { step: 3, title: 'Brief',         desc: 'Turns a signal + trend into a one-line hook + format + platform pick.' },
  { step: 4, title: 'Generate',      desc: 'AI drafts caption + hashtags + media pick per platform-native spec.' },
  { step: 5, title: 'Reality Check', desc: 'Flags anything off-brand, factually wrong, or overpromising.' },
  { step: 6, title: 'Approve',       desc: 'Human sign-off queue — one click promotes draft → ready.' },
  { step: 7, title: 'Schedule',      desc: 'Stages at platform-optimal times; respects daily/weekly caps per channel.' },
  { step: 8, title: 'Analyze',       desc: 'Pulls reach / engagement / saves per post once analytics APIs are live.' },
];

// -------------------------------------------------------------- ICP segments (from legacy · unchanged)
const ICPS: Array<{ emoji: string; name: string; note: string }> = [
  { emoji: '🕯', name: 'EU Wellness Women',    note: '35-55 · retreat-seekers · Germany/NL/UK' },
  { emoji: '🥂', name: 'Luxury Couples',       note: 'Riverfront villas · anniversaries · slow travel' },
  { emoji: '🌿', name: 'Mystique Explorers',   note: 'Solo culture · temples · Lao ritual + film' },
  { emoji: '🍃', name: 'Conscious Food',       note: 'Farm-to-table · foraging · slow food ambassadors' },
  { emoji: '🔕', name: 'Digital Detox EU',     note: 'Off-grid · phone-in-drawer · nature-first' },
];

// -------------------------------------------------------------- Views ----------
function OverviewView() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 340px)', gap: 12, alignItems: 'start' }}>
      <div style={T.card}>
        <div style={T.h}>AI production loop · 8 stages</div>
        <div style={{ ...T.muted, marginBottom: 10 }}>ICP signal → analyze. Each stage runs as a `cockpit_agent`. Stages 1-7 are wired via <code>social_ai.*</code>; stage 8 lights up when Meta/TikTok analytics land.</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
          {LOOP.map((s) => (
            <div key={s.step} style={{ padding: 10, border: '1px solid #E6DFCC', borderRadius: 8, background: '#FCFBF5' }}>
              <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#B87F26', fontWeight: 700 }}>Step {s.step}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1B1B1B', margin: '2px 0 4px' }}>{s.title}</div>
              <div style={{ fontSize: 11, color: '#5A5A5A', lineHeight: 1.4 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={T.card}>
        <div style={T.h}>ICPs being targeted · {ICPS.length}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {ICPS.map((icp) => (
            <div key={icp.name} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '4px 6px', borderBottom: '1px dashed #F0E9D6' }}>
              <span style={{ fontSize: 16 }}>{icp.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#1B1B1B' }}>{icp.name}</div>
                <div style={{ fontSize: 10, color: '#5A5A5A' }}>{icp.note}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChannelsView({ accounts }: { accounts: any[] }) {
  const byPlat = new Map<string, any>();
  for (const a of accounts) byPlat.set(a.platform, a);
  const platforms = [...PUSHABLE, ...READ_ONLY];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
      {platforms.map((pl) => {
        const a = byPlat.get(pl);
        const push = PUSHABLE.includes(pl);
        return (
          <div key={pl} style={{ ...T.card, padding: 14, opacity: a?.active === false ? 0.55 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1B1B1B' }}>
                <span style={{ marginRight: 6, opacity: 0.8 }}>{PLAT_ICON[pl] ?? '·'}</span>
                {PLAT_LABEL[pl] || pl}
              </div>
              <span style={{ fontSize: 9, color: push ? '#1F5C2C' : '#5A5A5A', background: push ? '#EBF1EE' : '#F5F0E1', padding: '2px 8px', borderRadius: 99, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700 }}>
                {push ? 'post target' : 'reviews only'}
              </span>
            </div>
            <div style={{ ...T.muted, marginTop: 4 }}>{a?.handle ?? <em style={T.dim}>no handle on file</em>}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
              <div>
                <div style={T.dim}>Followers</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: '#1B1B1B', fontVariantNumeric: 'tabular-nums' }}>
                  {a?.followers && Number(a.followers) > 0 ? fmtNum(a.followers) : pending('No follower sync yet — needs Meta/TikTok API')}
                </div>
              </div>
              <div>
                <div style={T.dim}>Growth · 30d</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{pending('Requires analytics API')}</div>
              </div>
              <div>
                <div style={T.dim}>Engagement</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{pending('Requires analytics API')}</div>
              </div>
              <div>
                <div style={T.dim}>Posts · MTD</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: '#1B1B1B' }}>—</div>
              </div>
            </div>
            {a?.last_synced_at ? (
              <div style={{ ...T.dim, marginTop: 8, borderTop: '1px dashed #E6DFCC', paddingTop: 6 }}>Last sync {fmtWhen(a.last_synced_at)}</div>
            ) : (
              <div style={{ ...T.dim, marginTop: 8, borderTop: '1px dashed #E6DFCC', paddingTop: 6 }}>No sync run yet</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function BoostView() {
  return (
    <div style={T.card}>
      <div style={T.h}>Boost strategist</div>
      <div style={{ ...T.muted, marginBottom: 8 }}>Watches published posts, picks organic winners, proposes paid budget × projected reach × cost-per-engagement (CPE). Runs weekly per platform.</div>
      <div style={{ padding: '30px 20px', background: '#FCFBF5', border: '1px dashed #E6DFCC', borderRadius: 8, textAlign: 'center' }}>
        <div style={{ fontSize: 24, marginBottom: 6 }}>💤</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1B1B1B', marginBottom: 4 }}>No organic performance data yet</div>
        <div style={{ ...T.muted, maxWidth: 480, margin: '0 auto' }}>Boost proposals depend on live per-post reach / engagement / saves. Wires up when the agency grants Meta API access (Page ID + IG Business Account or a long-lived Page token with <code>pages_manage_posts</code>, <code>instagram_content_publish</code>).</div>
      </div>
    </div>
  );
}

function CalendarView({ cal }: { cal: any[] }) {
  return (
    <div style={T.card}>
      <div style={T.h}>Upcoming calendar — AI-draft a post set per moment</div>
      <div style={{ ...T.muted, marginBottom: 10 }}>Draft creates one post per live channel from the event brief. Drafts land in Posts to edit, stage and push. ~15s per event.</div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', fontSize: 11, textTransform: 'uppercase', color: '#5A5A5A', padding: '6px 8px', borderBottom: '1px solid #E6DFCC' }}>Date</th>
            <th style={{ textAlign: 'left', fontSize: 11, textTransform: 'uppercase', color: '#5A5A5A', padding: '6px 8px', borderBottom: '1px solid #E6DFCC' }}>Moment</th>
            <th style={{ textAlign: 'right', fontSize: 11, textTransform: 'uppercase', color: '#5A5A5A', padding: '6px 8px', borderBottom: '1px solid #E6DFCC' }}>Posts</th>
            <th style={{ borderBottom: '1px solid #E6DFCC' }}></th>
          </tr>
        </thead>
        <tbody>
          {cal.map((e: any) => (
            <tr key={e.event_id}>
              <td style={{ padding: '6px 8px', borderBottom: '1px solid #E6DFCC', fontSize: 13, whiteSpace: 'nowrap' }}>{e.date_start}</td>
              <td style={{ padding: '6px 8px', borderBottom: '1px solid #E6DFCC', fontSize: 13 }}>
                {e.display_name}
                <div style={T.muted}>{e.marketing_brief ? String(e.marketing_brief).slice(0, 100) : ''}</div>
              </td>
              <td style={{ padding: '6px 8px', borderBottom: '1px solid #E6DFCC', fontSize: 13, textAlign: 'right' }}>{e.post_count}</td>
              <td style={{ padding: '6px 8px', borderBottom: '1px solid #E6DFCC', textAlign: 'right' }}>
                <ActBtn op="compose" params={{ event_id: e.event_id }} style={T.ghost}>AI draft posts</ActBtn>
              </td>
            </tr>
          ))}
          {cal.length === 0 ? <tr><td colSpan={4} style={{ padding: '10px 8px' }}><span style={T.muted}>No upcoming marketing moments.</span></td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

// -------------------------------------------------------------- MAIN --------
export default async function Socials(props: any) {
  const searchParams = (props && props.searchParams) || {};
  const tab = (searchParams?.tab) || 'overview';
  const sb = getSupabaseAdmin();

  // Live reads (parallel)
  const [chRes, accRes, postsRes, calRes] = await Promise.all([
    sb.from('v_social_channels').select('*').eq('property_id', PID),
    sb.schema('marketing').from('social_accounts').select('platform, handle, followers, active, last_synced_at').eq('property_id', PID).order('platform'),
    sb.from('v_social_posts').select('*').eq('property_id', PID).order('scheduled_at', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false }),
    sb.from('v_social_calendar').select('*').eq('property_id', PID).gte('date_start', new Date().toISOString().slice(0, 10)).order('date_start').limit(40),
  ]);

  const channels = (chRes.data ?? []).filter((c: any) => PUSHABLE.includes(c.platform));
  const accounts = accRes.data ?? [];
  const posts    = postsRes.data ?? [];
  const cal      = calRes.data ?? [];

  // KPI band (all from live tables, no fake numbers)
  const nDraft     = posts.filter((p: any) => p.status === 'draft').length;
  const nStaged    = posts.filter((p: any) => p.status === 'scheduled' || p.status === 'ready').length;
  const nPushed30d = posts.filter((p: any) => p.status === 'pushed' && p.pushed_at && (Date.now() - new Date(p.pushed_at).getTime()) < 30 * 86400_000).length;
  const nFailed    = posts.filter((p: any) => p.status === 'failed').length;
  const nUpcoming  = cal.length;
  const totalFollowers = accounts.reduce((s: number, a: any) => s + Number(a.followers ?? 0), 0);

  const tiles: KpiTileProps[] = [
    { label: 'Drafts',              value: nDraft,     size: 'sm', footnote: 'awaiting stage' },
    { label: 'Staged',              value: nStaged,    size: 'sm', footnote: 'queued to push' },
    { label: 'Pushed · 30d',        value: nPushed30d, size: 'sm' },
    { label: 'Failed',              value: nFailed,    size: 'sm', footnote: nFailed > 0 ? 'action needed' : 'clear' },
    { label: 'Upcoming moments',    value: nUpcoming,  size: 'sm', footnote: 'calendar next 40' },
    { label: 'Total followers',     value: totalFollowers > 0 ? totalFollowers.toLocaleString('en-GB') : '—', size: 'sm', footnote: totalFollowers > 0 ? 'across 8 accounts' : 'needs Meta/TikTok API' },
  ];

  const opsTabs = MARKETING_SUBPAGES.map((t: any, i: number) => ({ key: 'mkt' + i, label: t.label, href: t.href }));

  let view: any = null;
  if (tab === 'overview') {
    view = <OverviewView />;
  } else if (tab === 'channels') {
    view = <ChannelsView accounts={accounts} />;
  } else if (tab === 'calendar') {
    view = <CalendarView cal={cal} />;
  } else if (tab === 'boost') {
    view = <BoostView />;
  } else if (tab === 'compose') {
    view = (
      <div style={{ ...T.card, maxWidth: 560 }}>
        <div style={T.h}>New post</div>
        <ActForm op="create" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <select name="platform" style={T.input} defaultValue={channels[0]?.platform || 'instagram'}>
            {PUSHABLE.map((k) => <option key={k} value={k}>{PLAT_LABEL[k]}</option>)}
          </select>
          <textarea name="caption" rows={4} placeholder="Caption" style={{ ...T.input, resize: 'vertical' }} />
          <input name="hashtags" placeholder="#hashtags (space or comma separated)" style={T.input} />
          <input name="media_url" placeholder="Media URL (optional)" style={T.input} />
          <input name="scheduled_at" type="datetime-local" style={T.input} />
          <button type="submit" style={T.btn}>Create draft</button>
        </ActForm>
        <div style={{ ...T.muted, marginTop: 10 }}>
          Live channels: {channels.map((c: any) => PLAT_LABEL[c.platform] || c.platform).join(' · ') || 'none set'}. Booking/Expedia/Tripadvisor are review channels, not post targets.
        </div>
      </div>
    );
  } else {
    // posts
    const byPlat: Record<string, any[]> = {};
    for (const p of posts) { (byPlat[p.platform] = byPlat[p.platform] || []).push(p); }
    const plats = Object.keys(byPlat).sort((a, b) => PUSHABLE.indexOf(a) - PUSHABLE.indexOf(b));
    view = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ ...T.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ ...T.h, margin: 0 }}>Posts ({posts.length})</div>
            <div style={T.muted}>Grouped by channel. Edit → Stage → Mark pushed. Auto-push wires on once the agency grants Meta access.</div>
          </div>
          <a href="/marketing/socials?tab=compose" style={T.btn as any}>+ New post</a>
        </div>
        {posts.length === 0 ? <div style={T.card}><span style={T.muted}>No posts yet — use "+ New" or AI-draft a set from the Calendar tab.</span></div> : null}
        {plats.map((pl) => (
          <div key={pl}>
            <div style={T.sec}>{PLAT_LABEL[pl] || pl} <span style={{ ...T.muted, fontWeight: 400 }}>({byPlat[pl].length})</span></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
              {byPlat[pl].map((p: any) => <PostCard key={p.post_id} p={p} />)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <DashboardPage title="Socials" subtitle="AI social cockpit — overview · channels · calendar · posts · boost" tabs={opsTabs}>
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
        {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
      </div>
      <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SubTabs active={tab} />
        {view}
      </div>
    </DashboardPage>
  );
}
