'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { Prospect, IcpSegment, GuestCohort } from '@/lib/sales-leads';

interface DraftRow {
  id: string; subject: string | null; body_md: string | null; status: string;
  generator: string; prospect_id: string | null; cohort_id: string | null;
  created_at: string; intent: string;
}

interface Props {
  prospects: Prospect[];
  kpis: Record<string, number>;
  icp: IcpSegment[];
  cohorts: GuestCohort[];
  recentDrafts: DraftRow[];
  currentStatus: string;
  currentQuery: string;
}

const STATUSES = ['all','new','enriched','drafted','sent','replied','bounced','suppressed','converted','dismissed'];

const chip: React.CSSProperties = {
  padding: '4px 10px', borderRadius: 5, fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-loose)', textTransform: 'uppercase',
  background: 'var(--paper)', border: '1px solid var(--paper-deep)', color: 'var(--ink)',
  cursor: 'pointer', whiteSpace: 'nowrap', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4,
};
const chipActive: React.CSSProperties = { ...chip, background: 'var(--moss)', color: 'var(--paper-warm)', borderColor: 'var(--moss)' };
const chipBrass: React.CSSProperties = { ...chip, color: 'var(--brass)', borderColor: 'var(--brass-soft)' };
const btn: React.CSSProperties = { padding: '4px 10px', borderRadius: 4, border: '1px solid var(--paper-deep)', background: 'var(--paper)', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', cursor: 'pointer' };
const btnBrass: React.CSSProperties = { ...btn, color: 'var(--brass)', borderColor: 'var(--brass-soft)' };
const ipt: React.CSSProperties = { padding: '6px 10px', borderRadius: 5, border: '1px solid var(--paper-deep)', background: 'var(--paper-warm)', fontSize: 'var(--t-sm)', color: 'var(--ink)' };
const cellTh: React.CSSProperties = { textAlign: 'left', padding: '6px 10px', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)', borderBottom: '1px solid var(--paper-deep)', whiteSpace: 'nowrap' };
const cellTd: React.CSSProperties = { padding: '6px 10px', fontSize: 'var(--t-sm)', borderBottom: '1px solid var(--line-soft)', verticalAlign: 'top' };

function statusColor(s: string): string {
  if (s === 'new')        return 'var(--ink-mute)';
  if (s === 'enriched')   return 'var(--moss-glow)';
  if (s === 'drafted')    return 'var(--brass)';
  if (s === 'sent')       return 'var(--moss)';
  if (s === 'replied')    return 'var(--moss-glow)';
  if (s === 'bounced' || s === 'suppressed' || s === 'dismissed') return 'var(--st-bad)';
  if (s === 'converted')  return 'var(--brass)';
  return 'var(--ink)';
}

export default function LeadsClient({ prospects, kpis, icp, cohorts, recentDrafts, currentStatus, currentQuery }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState(currentQuery);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [composeFor, setComposeFor] = useState<{ kind: 'cohort' | 'prospect'; id: string; label: string } | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);

  function setStatus(s: string) {
    const params = new URLSearchParams(sp?.toString() ?? '');
    if (s === 'all') params.delete('status'); else params.set('status', s);
    startTransition(() => router.push(`/sales/leads?${params.toString()}#prospects`));
  }
  function applySearch() {
    const params = new URLSearchParams(sp?.toString() ?? '');
    if (search) params.set('q', search); else params.delete('q');
    startTransition(() => router.push(`/sales/leads?${params.toString()}#prospects`));
  }

  async function draftOutreach(prospect: Prospect) {
    if (!prospect.email && !prospect.linkedin_url) {
      setErr('prospect has no email or LinkedIn — add one first');
      return;
    }
    setBusy(true); setErr(null);
    try {
      const brief = `Cold-outreach draft for the prospect described in the recipient context. Aim: open conversation about a possible partnership / referral / collaboration with The Namkhan. Lead with a specific hook tied to their company or role; no generic openers. End with a soft single-question CTA.`;
      const res = await fetch('/api/sales/email-draft', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: 'ai', intent: 'outreach', brief, tone: 'warm', prospect_id: prospect.id }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'draft failed');
      router.refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  async function patchProspect(id: string, patch: Record<string, unknown>) {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/sales/prospects?id=${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'patch failed');
      router.refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  async function deleteProspect(id: string) {
    if (!confirm('Delete this prospect?')) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/sales/prospects?id=${id}`, { method: 'DELETE' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'delete failed');
      router.refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* HONEST BANNER */}
      <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.04)', border: '1px solid var(--paper-deep)', borderRadius: 6, fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
        <strong style={{ color: 'var(--brass)' }}>Send disabled.</strong> Drafts land in the Email Cockpit — operator copies into Gmail until SendGrid is wired. Cold mail from your transactional Gmail risks spam-flagging the whole domain. Use a dedicated sending domain when you turn this on.
      </div>

      {err && <div style={{ padding: 10, background: 'rgba(220,40,40,0.08)', border: '1px solid var(--st-bad)', borderRadius: 6, color: 'var(--st-bad)', fontSize: 'var(--t-sm)' }}>error: {err}</div>}

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
        {[
          { l: 'Total prospects', v: kpis.total ?? 0 },
          { l: 'New', v: kpis.new ?? 0 },
          { l: 'Drafted', v: kpis.drafted ?? 0, color: 'var(--brass)' },
          { l: 'Sent', v: kpis.sent ?? 0, color: 'var(--moss)' },
          { l: 'Replied', v: kpis.replied ?? 0, color: 'var(--moss-glow)' },
          { l: 'Cohorts', v: cohorts.length, color: 'var(--brass)' },
        ].map(k => (
          <div key={k.l} style={{ padding: '10px 12px', background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 6 }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)' }}>{k.l}</div>
            <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'var(--t-2xl)', fontWeight: 500, color: k.color ?? 'var(--ink)', lineHeight: 1.1, marginTop: 2 }}>{k.v.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* COHORTS — warm side */}
      <section id="cohorts">
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <h3 style={{ fontFamily: 'var(--serif)', fontSize: 'var(--t-xl)', fontWeight: 500, margin: 0 }}>
              Guest <em style={{ color: 'var(--brass)' }}>cohorts</em>
              <span style={{ marginLeft: 10, fontSize: 'var(--t-sm)', color: 'var(--ink-mute)' }}>{cohorts.length}</span>
            </h3>
            <div style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-mute)', marginTop: 2 }}>Pick a cohort, AI drafts a campaign, you approve & send.</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 10 }}>
          {cohorts.map(c => (
            <article key={c.id} style={{ padding: 12, background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)' }}>{c.key}</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: c.member_count && c.member_count > 0 ? 'var(--moss-glow)' : 'var(--ink-mute)' }}>
                  {c.member_count ?? 0} members · {c.member_emails ?? 0} w/ email
                </span>
              </div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 'var(--t-md)', fontWeight: 500, marginTop: 4 }}>{c.name}</div>
              {c.description && <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', marginTop: 4, lineHeight: 1.4 }}>{c.description}</div>}
              {c.sample_names && c.sample_names.length > 0 && (
                <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', marginTop: 6, fontStyle: 'italic' }}>
                  e.g. {c.sample_names.slice(0, 4).join(', ')}{(c.member_count ?? 0) > 4 ? ' …' : ''}
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                <button type="button" onClick={() => setComposeFor({ kind: 'cohort', id: c.id, label: c.name })} disabled={busy || !c.member_emails}
                        style={c.member_emails ? chipBrass : { ...chip, opacity: 0.4, cursor: 'not-allowed' }}>
                  ✦ Compose campaign
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* PROSPECTS — cold side */}
      <section id="prospects">
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10, gap: 14, flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--serif)', fontSize: 'var(--t-xl)', fontWeight: 500, margin: 0 }}>
              Cold <em style={{ color: 'var(--brass)' }}>prospects</em>
              <span style={{ marginLeft: 10, fontSize: 'var(--t-sm)', color: 'var(--ink-mute)' }}>{prospects.length} shown · {kpis.total ?? 0} total</span>
            </h3>
            <div style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-mute)', marginTop: 2 }}>B2B partners, DMCs, retreat organisers, journalists. Add manually or upload CSV.</div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setShowAdd(true)} style={chipBrass}>+ Add prospect</button>
            <button type="button" onClick={() => setShowImport(true)} style={chipBrass}>↑ Import CSV</button>
          </div>
        </div>

        {/* Filter row */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)', minWidth: 60 }}>Status</span>
          {STATUSES.map(s => (
            <button key={s} type="button" onClick={() => setStatus(s)} style={currentStatus === s ? chipActive : chip}>
              {s}{s !== 'all' && kpis[s] ? <span style={{ marginLeft: 4, opacity: 0.7 }}>{kpis[s]}</span> : null}
            </button>
          ))}
          <form onSubmit={(e) => { e.preventDefault(); applySearch(); }} style={{ display: 'flex', gap: 6, marginLeft: 'auto', minWidth: 220 }}>
            <input type="search" placeholder="Search name / company / email…" value={search} onChange={e => setSearch(e.target.value)}
                   style={{ ...ipt, flex: 1, padding: '4px 10px' }} />
            <button type="submit" style={chipBrass}>Search</button>
          </form>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto', background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 6 }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr>
                <th style={cellTh}>STATUS</th>
                <th style={cellTh}>NAME · COMPANY · ROLE</th>
                <th style={cellTh}>COUNTRY</th>
                <th style={cellTh}>EMAIL</th>
                <th style={cellTh}>SOURCE</th>
                <th style={cellTh}>CONTEXT</th>
                <th style={cellTh}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {prospects.length === 0 && (
                <tr><td colSpan={7} style={{ ...cellTd, color: 'var(--ink-mute)', textAlign: 'center', padding: 24 }}>
                  No prospects. Click <strong>Import CSV</strong> or <strong>Add prospect</strong> to start.
                </td></tr>
              )}
              {prospects.map(p => (
                <tr key={p.id}>
                  <td style={cellTd}>
                    <select defaultValue={p.status} onChange={e => patchProspect(p.id, { status: e.target.value })} disabled={busy}
                            style={{ ...ipt, padding: '2px 6px', color: statusColor(p.status), fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>
                      {STATUSES.filter(s => s !== 'all').map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td style={cellTd}>
                    <div style={{ fontWeight: 600 }}>{p.name ?? '—'}</div>
                    <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>{[p.company, p.role].filter(Boolean).join(' · ') || '—'}</div>
                  </td>
                  <td style={{ ...cellTd, fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>{p.country ?? '—'}</td>
                  <td style={{ ...cellTd, fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>
                    {p.email ?? <span style={{ color: 'var(--st-bad)' }}>—</span>}
                    {p.linkedin_url && <div><a href={p.linkedin_url} target="_blank" rel="noreferrer" style={{ color: 'var(--brass)', fontSize: 10 }}>LinkedIn ↗</a></div>}
                  </td>
                  <td style={{ ...cellTd, fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>{p.source}</td>
                  <td style={{ ...cellTd, fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', maxWidth: 240 }}>{p.context_summary ?? '—'}</td>
                  <td style={cellTd}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => draftOutreach(p)} disabled={busy} style={btnBrass}>✦ AI draft</button>
                      {p.last_outreach_draft_id && (
                        <Link href={`/sales/inquiries?cat=all&status=drafted`} style={btn}>open draft →</Link>
                      )}
                      <button type="button" onClick={() => deleteProspect(p.id)} disabled={busy} style={{ ...btn, color: 'var(--st-bad)' }}>×</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* RECENT OUTREACH DRAFTS */}
      <section id="drafts">
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 'var(--t-xl)', fontWeight: 500, margin: '0 0 8px' }}>
          Recent <em style={{ color: 'var(--brass)' }}>outreach drafts</em>
          <span style={{ marginLeft: 10, fontSize: 'var(--t-sm)', color: 'var(--ink-mute)' }}>{recentDrafts.length}</span>
        </h3>
        {recentDrafts.length === 0 ? (
          <div style={{ padding: 18, color: 'var(--ink-mute)', fontSize: 'var(--t-sm)', background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 6 }}>
            No outreach drafts yet. Click "✦ AI draft" on a prospect or "✦ Compose campaign" on a cohort.
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 6 }}>
            {recentDrafts.map(d => (
              <li key={d.id} style={{ borderBottom: '1px solid var(--line-soft)', padding: '8px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 'var(--t-sm)' }}>{d.subject ?? '(no subject)'}</div>
                    <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {(d.body_md ?? '').slice(0, 140)}
                    </div>
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: statusColor(d.status), textTransform: 'uppercase', letterSpacing: 'var(--ls-loose)' }}>
                    {d.status} · {d.cohort_id ? 'cohort' : d.prospect_id ? 'prospect' : 'manual'}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* MODALS */}
      {composeFor && <ComposeForCohortModal kind={composeFor.kind} id={composeFor.id} label={composeFor.label} onClose={() => setComposeFor(null)} onSaved={() => { setComposeFor(null); router.refresh(); }} />}
      {showAdd && <AddProspectModal icp={icp} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); router.refresh(); }} />}
      {showImport && <ImportCsvModal icp={icp} onClose={() => setShowImport(false)} onSaved={() => { setShowImport(false); router.refresh(); }} />}
    </div>
  );
}

// ── Compose for cohort modal (also handles per-prospect compose by setting kind='prospect') ──
function ComposeForCohortModal({ kind, id, label, onClose, onSaved }: { kind: 'cohort' | 'prospect'; id: string; label: string; onClose: () => void; onSaved: () => void }) {
  const [brief, setBrief] = useState('');
  const [tone, setTone] = useState('warm');
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<{ subject: string; body_md: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function aiDraft() {
    setBusy(true); setErr(null);
    try {
      const res = await fetch('/api/sales/email-draft', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: 'ai', intent: 'outreach', brief, tone, [kind === 'cohort' ? 'cohort_id' : 'prospect_id']: id }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'draft failed');
      setDraft({ subject: j.draft.subject, body_md: j.draft.body_md });
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  return (
    <div style={modalBackdrop}>
      <div style={modalBody}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 'var(--t-xl)', fontWeight: 500 }}>
            Compose · <em style={{ color: 'var(--brass)' }}>{kind}</em>: {label}
          </h3>
          <button type="button" onClick={onClose} style={chip}>Close</button>
        </div>
        {!draft ? (
          <>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)', marginBottom: 6 }}>Brief</div>
            <textarea value={brief} onChange={e => setBrief(e.target.value)} placeholder={kind === 'cohort' ? 'e.g. winback nudge — 6-night retreat, 15% returning-guest discount, valid Sept-Nov' : 'e.g. opening to retreat organiser, propose Q4 hosted scout visit'}
                      rows={4} style={{ ...ipt, width: '100%', marginBottom: 8, fontFamily: 'var(--serif)' }} />
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--brass)' }}>tone</span>
              {['warm','neutral','formal','playful'].map(t => (
                <button key={t} type="button" onClick={() => setTone(t)} style={tone === t ? chipActive : chip}>{t}</button>
              ))}
              <button type="button" onClick={aiDraft} disabled={busy || !brief} style={{ ...chipBrass, marginLeft: 'auto' }}>
                {busy ? '… drafting' : '✦ AI draft'}
              </button>
            </div>
          </>
        ) : (
          <>
            <input value={draft.subject} onChange={e => setDraft({ ...draft, subject: e.target.value })} style={{ ...ipt, width: '100%', marginBottom: 8 }} />
            <textarea value={draft.body_md} onChange={e => setDraft({ ...draft, body_md: e.target.value })} rows={14} style={{ ...ipt, width: '100%', fontFamily: 'var(--serif)', lineHeight: 1.55 }} />
            <div style={{ display: 'flex', gap: 6, marginTop: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => navigator.clipboard?.writeText(`${draft.subject}\n\n${draft.body_md}`)} style={chip}>Copy to clipboard</button>
              <button type="button" onClick={onSaved} style={chipBrass}>Done — open in cockpit</button>
            </div>
          </>
        )}
        {err && <div style={{ color: 'var(--st-bad)', fontSize: 'var(--t-xs)', marginTop: 8 }}>{err}</div>}
      </div>
    </div>
  );
}

function AddProspectModal({ icp, onClose, onSaved }: { icp: IcpSegment[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', company: '', role: '', country: '', email: '', linkedin_url: '', context_summary: '', icp_segment_id: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true); setErr(null);
    try {
      const res = await fetch('/api/sales/prospects', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...form, icp_segment_id: form.icp_segment_id || null }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'create failed');
      onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm(s => ({ ...s, [k]: e.target.value }));

  return (
    <div style={modalBackdrop}>
      <div style={modalBody}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 'var(--t-xl)', fontWeight: 500 }}>Add <em style={{ color: 'var(--brass)' }}>prospect</em></h3>
          <button type="button" onClick={onClose} style={chip}>Close</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <input placeholder="Name" value={form.name} onChange={f('name')} style={ipt} />
          <input placeholder="Company" value={form.company} onChange={f('company')} style={ipt} />
          <input placeholder="Role" value={form.role} onChange={f('role')} style={ipt} />
          <input placeholder="Country (ISO 2-letter, e.g. DE)" value={form.country} onChange={f('country')} style={ipt} />
          <input placeholder="Email" value={form.email} onChange={f('email')} style={ipt} />
          <input placeholder="LinkedIn URL" value={form.linkedin_url} onChange={f('linkedin_url')} style={ipt} />
          <select value={form.icp_segment_id} onChange={f('icp_segment_id')} style={ipt}>
            <option value="">No ICP segment</option>
            {icp.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </div>
        <textarea placeholder="Context — why this prospect, what hook to use" value={form.context_summary} onChange={f('context_summary')} rows={3}
                  style={{ ...ipt, width: '100%', marginTop: 8 }} />
        {err && <div style={{ color: 'var(--st-bad)', fontSize: 'var(--t-xs)', marginTop: 8 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 6, marginTop: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={save} disabled={busy || !form.name} style={chipBrass}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

function ImportCsvModal({ icp, onClose, onSaved }: { icp: IcpSegment[]; onClose: () => void; onSaved: () => void }) {
  const [csv, setCsv] = useState('');
  const [icpId, setIcpId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ inserted: number; skipped_duplicates: number; parsed: number } | null>(null);

  async function importNow() {
    setBusy(true); setErr(null); setResult(null);
    try {
      const res = await fetch('/api/sales/prospects/import', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ csv, default_source: 'csv', icp_segment_id: icpId || null }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'import failed');
      setResult({ inserted: j.inserted ?? 0, skipped_duplicates: j.skipped_duplicates ?? 0, parsed: j.parsed ?? 0 });
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result ?? ''));
    reader.readAsText(file);
  }

  return (
    <div style={modalBackdrop}>
      <div style={{ ...modalBody, maxWidth: 760 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 'var(--t-xl)', fontWeight: 500 }}>Import <em style={{ color: 'var(--brass)' }}>CSV</em></h3>
          <button type="button" onClick={onClose} style={chip}>Close</button>
        </div>
        <div style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-mute)', marginBottom: 8 }}>
          Required header row. Recognised columns (case-insensitive, snake-case): <code style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>name, company, role, email, country, linkedin_url, website, context_summary</code>. Email-based dedupe is automatic. Hundreds at a time is fine.
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <input type="file" accept=".csv,text/csv" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          <span style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-mute)' }}>or paste CSV below</span>
          <select value={icpId} onChange={e => setIcpId(e.target.value)} style={{ ...ipt, marginLeft: 'auto' }}>
            <option value="">Tag to ICP segment…</option>
            {icp.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </div>
        <textarea value={csv} onChange={e => setCsv(e.target.value)} rows={10}
                  placeholder="name,company,role,email,country,linkedin_url&#10;Anna Müller,Yoga Berlin,Founder,anna@yogaberlin.de,DE,https://linkedin.com/in/annam"
                  style={{ ...ipt, width: '100%', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }} />
        {err && <div style={{ color: 'var(--st-bad)', fontSize: 'var(--t-xs)', marginTop: 8 }}>{err}</div>}
        {result && (
          <div style={{ marginTop: 8, padding: 8, background: 'rgba(0,180,80,0.1)', border: '1px solid var(--moss)', borderRadius: 4, fontSize: 'var(--t-sm)' }}>
            ✓ Parsed {result.parsed} · inserted <strong>{result.inserted}</strong> · skipped {result.skipped_duplicates} duplicates.
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, marginTop: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={importNow} disabled={busy || !csv} style={chipBrass}>{busy ? 'Importing…' : 'Import'}</button>
          {result && <button type="button" onClick={onSaved} style={chip}>Close</button>}
        </div>
      </div>
    </div>
  );
}

const modalBackdrop: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 100, padding: 24,
};
const modalBody: React.CSSProperties = {
  background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)',
  borderRadius: 10, width: '100%', maxWidth: 640, maxHeight: '90vh',
  overflowY: 'auto', padding: 18,
};
