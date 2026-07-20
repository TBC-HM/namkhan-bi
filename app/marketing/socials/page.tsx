// app/marketing/socials/page.tsx — Socials posts engine (per-channel calendar → composer → stage/push).
// Client-action pattern (buttons via /api/marketing/socials). Design-system DashboardPage + v6 tokens.
import { DashboardPage } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '@/app/marketing/_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { ActBtn, ActForm } from './_client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PID = 260955;
const PUSHABLE = ['instagram', 'facebook', 'tiktok', 'youtube', 'google_business'];
const PLAT_LABEL: Record<string, string> = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', youtube: 'YouTube', google_business: 'Google Business' };

const T: any = {
  card: { background: 'var(--paper,#fff)', border: '1px solid var(--hairline,#E6DFCC)', borderRadius: 10, padding: 16 },
  h: { fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-soft,#5A5A5A)', margin: '0 0 12px' },
  muted: { color: 'var(--ink-soft,#5A5A5A)', fontSize: 12 },
  btn: { padding: '7px 12px', background: 'var(--primary,#1F3A2E)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' },
  ghost: { padding: '7px 12px', background: 'transparent', color: 'var(--ink,#1B1B1B)', border: '1px solid var(--hairline,#E6DFCC)', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' },
  small: { padding: '3px 8px', background: 'transparent', color: 'var(--ink-soft,#5A5A5A)', border: '1px solid var(--hairline,#E6DFCC)', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' },
  input: { padding: '7px 9px', border: '1px solid var(--hairline,#E6DFCC)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', background: 'var(--paper,#fff)', color: 'var(--ink,#1B1B1B)' },
  link: { color: 'var(--primary,#1F3A2E)', textDecoration: 'none', fontSize: 13 },
  sec: { fontSize: 13, fontWeight: 600, color: 'var(--primary,#1F3A2E)', margin: '14px 0 6px', paddingBottom: 4, borderBottom: '1px solid var(--hairline,#E6DFCC)' },
};

function statusChip(s: string) {
  const map: any = {
    draft: ['#5A5A5A', 'var(--bg,#F4EFE2)', 'draft'],
    ready: ['#1F3A2E', 'rgba(31,58,46,0.10)', 'ready'],
    scheduled: ['#B8542A', 'rgba(184,84,42,0.12)', 'staged'],
    pushed: ['#2E7D32', 'rgba(46,125,50,0.12)', 'pushed'],
    failed: ['#B8542A', 'rgba(184,84,42,0.18)', 'failed'],
    cancelled: ['#9A9A9A', 'var(--bg,#F4EFE2)', 'cancelled'],
  };
  const c = map[s] || map.draft;
  return <span style={{ fontSize: 10, color: c[0], background: c[1], padding: '1px 7px', borderRadius: 99, marginLeft: 6 }}>{c[2]}</span>;
}

function SubTabs({ active }: { active: string }) {
  const tabs: [string, string][] = [['posts', 'Posts'], ['calendar', 'Calendar'], ['compose', 'New post']];
  return <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--hairline,#E6DFCC)' }}>{tabs.map(([k, l]) => { const on = active === k; return <a key={k} href={'/marketing/socials?tab=' + k} style={{ padding: '6px 12px', fontSize: 13, fontWeight: on ? 600 : 500, color: on ? 'var(--ink,#1B1B1B)' : 'var(--ink-soft,#5A5A5A)', borderBottom: on ? '2px solid var(--primary,#1F3A2E)' : '2px solid transparent', textDecoration: 'none' }}>{l}</a>; })}</div>;
}

function fmtWhen(s: string | null) {
  if (!s) return 'no date';
  try { return new Date(s).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return s; }
}
function toLocalInput(s: string | null) {
  if (!s) return '';
  try { const d = new Date(s); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; } catch { return ''; }
}

function PostCard({ p }: { p: any }) {
  return (
    <div style={{ ...T.card, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink,#1B1B1B)' }}>{PLAT_LABEL[p.platform] || p.platform}{statusChip(p.status)}{p.ai_generated ? <span style={{ ...T.muted, marginLeft: 6 }}>· AI</span> : null}</div>
        <div style={{ ...T.muted }}>{fmtWhen(p.scheduled_at)}</div>
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

export default async function Socials(props: any) {
  const searchParams = (props && props.searchParams) || {};
  const tab = (searchParams?.tab) || 'posts';
  const sb = getSupabaseAdmin();

  const { data: chRaw } = await sb.from('v_social_channels').select('*').eq('property_id', PID);
  const channels = (chRaw ?? []).filter((c: any) => PUSHABLE.includes(c.platform));
  const opsTabs = MARKETING_SUBPAGES.map((t: any, i: number) => ({ key: 'mkt' + i, label: t.label, href: t.href }));

  let view: any;

  if (tab === 'calendar') {
    const { data: cal } = await sb.from('v_social_calendar').select('*').eq('property_id', PID).gte('date_start', new Date().toISOString().slice(0, 10)).order('date_start').limit(40);
    view = (
      <div style={T.card}>
        <div style={T.h}>Upcoming calendar — AI-draft a post set per moment</div>
        <div style={{ ...T.muted, marginBottom: 10 }}>Draft creates one post per live channel from the event brief. Drafts land in the Posts tab to edit, stage and push. Takes ~15s.</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th style={{ textAlign: 'left', fontSize: 11, textTransform: 'uppercase', color: 'var(--ink-soft,#5A5A5A)', padding: '6px 8px', borderBottom: '1px solid var(--hairline,#E6DFCC)' }}>Date</th>
            <th style={{ textAlign: 'left', fontSize: 11, textTransform: 'uppercase', color: 'var(--ink-soft,#5A5A5A)', padding: '6px 8px', borderBottom: '1px solid var(--hairline,#E6DFCC)' }}>Moment</th>
            <th style={{ textAlign: 'right', fontSize: 11, textTransform: 'uppercase', color: 'var(--ink-soft,#5A5A5A)', padding: '6px 8px', borderBottom: '1px solid var(--hairline,#E6DFCC)' }}>Posts</th>
            <th style={{ borderBottom: '1px solid var(--hairline,#E6DFCC)' }}></th>
          </tr></thead>
          <tbody>
            {(cal ?? []).map((e: any) => (
              <tr key={e.event_id}>
                <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--hairline,#E6DFCC)', fontSize: 13, whiteSpace: 'nowrap' }}>{e.date_start}</td>
                <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--hairline,#E6DFCC)', fontSize: 13 }}>{e.display_name}<div style={T.muted}>{e.marketing_brief ? String(e.marketing_brief).slice(0, 90) : ''}</div></td>
                <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--hairline,#E6DFCC)', fontSize: 13, textAlign: 'right' }}>{e.post_count}</td>
                <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--hairline,#E6DFCC)', textAlign: 'right' }}><ActBtn op="compose" params={{ event_id: e.event_id }} style={T.ghost}>AI draft posts</ActBtn></td>
              </tr>
            ))}
            {(cal ?? []).length === 0 ? <tr><td colSpan={4} style={{ padding: '10px 8px' }}><span style={T.muted}>No upcoming marketing moments.</span></td></tr> : null}
          </tbody>
        </table>
      </div>
    );
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
        <div style={{ ...T.muted, marginTop: 10 }}>Live channels: {channels.map((c: any) => PLAT_LABEL[c.platform] || c.platform).join(' · ') || 'none set'}. Booking/Expedia/TripAdvisor are review channels, not post targets.</div>
      </div>
    );
  } else {
    const { data: posts } = await sb.from('v_social_posts').select('*').eq('property_id', PID).order('scheduled_at', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false });
    const list = posts ?? [];
    const byPlat: Record<string, any[]> = {};
    for (const p of list) { (byPlat[p.platform] = byPlat[p.platform] || []).push(p); }
    const plats = Object.keys(byPlat).sort((a, b) => PUSHABLE.indexOf(a) - PUSHABLE.indexOf(b));
    view = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ ...T.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div><div style={{ ...T.h, margin: 0 }}>Posts ({list.length})</div><div style={T.muted}>Grouped by channel. Edit → Stage (queued) → Mark pushed. Auto-push wires on once the agency grants Meta access.</div></div>
          <a href="/marketing/socials?tab=compose" style={T.btn as any}>+ New post</a>
        </div>
        {list.length === 0 ? <div style={T.card}><span style={T.muted}>No posts yet — use “New post”, or AI-draft a set from the Calendar tab.</span></div> : null}
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
    <DashboardPage title="Socials" tabs={opsTabs}>
      <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SubTabs active={tab} />
        {view}
      </div>
    </DashboardPage>
  );
}
