'use client';

// CockpitClient — interactive shell for the Email Cockpit. All filters drive
// URL searchParams so server re-renders pull fresh data. AI draft + manual
// draft writes go through /api/sales/email-draft.

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition, useMemo, useEffect } from 'react';
import type {
  CockpitThread,
  CockpitMessage,
  CockpitDraft,
  CockpitTemplate,
  CockpitMailbox,
  CockpitKpis,
  CockpitStatus,
  CockpitDirection,
  CockpitCategory,
  CockpitSince,
  CategoryDef,
} from '@/lib/sales-cockpit';
import { fmtIsoDate, EMPTY } from '@/lib/format';

interface Props {
  scope: string;
  status: CockpitStatus;
  direction: CockpitDirection;
  category: CockpitCategory;
  since: CockpitSince;
  search: string;
  page: number;
  threads: CockpitThread[];
  hasMore: boolean;
  kpis: CockpitKpis;
  mailboxes: CockpitMailbox[];
  templates: CockpitTemplate[];
  categories: CategoryDef[];
  selectedThreadId: string | null;
  threadDetail: { messages: CockpitMessage[]; drafts: CockpitDraft[] } | null;
}

const SINCE_LABELS: Record<CockpitSince, string> = {
  '7d':  '7d',
  '30d': '30d',
  '90d': '90d',
  '365d':'1y',
  'all': 'All time',
};

function relativeTime(iso: string): string {
  const d = new Date(iso).getTime();
  const now = Date.now();
  const min = Math.round((now - d) / 60000);
  if (min < 1) return 'now';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
  return fmtIsoDate(iso);
}

function senderLabel(name: string | null, email: string | null): string {
  if (name && name.trim().length > 0) return name;
  if (email) return email;
  return 'Unknown';
}

function shortMailbox(m: string | null): string {
  if (!m) return '—';
  return m.replace('@thenamkhan.com', '@nk').replace('@thedonnaportals.com', '@dp');
}

const chipBase: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: 5,
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-loose)',
  textTransform: 'uppercase',
  textDecoration: 'none',
  background: 'var(--paper)',
  border: '1px solid var(--paper-deep)',
  color: 'var(--ink)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};
const chipActive: React.CSSProperties = {
  ...chipBase,
  background: 'var(--moss)',
  color: 'var(--paper-warm)',
  borderColor: 'var(--moss)',
};
const chipBrass: React.CSSProperties = {
  ...chipBase,
  color: 'var(--brass)',
  borderColor: 'var(--brass-soft)',
};

export default function CockpitClient(props: Props) {
  const { threads, kpis, mailboxes, templates, categories, selectedThreadId, threadDetail, hasMore, page } = props;
  const categoryLabel = useMemo(() => {
    const m: Record<string, string> = { all: 'All' };
    for (const c of categories) m[c.key] = c.label;
    return m;
  }, [categories]);
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  // Local search state (debounced on submit)
  const [search, setSearch] = useState(props.search);
  useEffect(() => setSearch(props.search), [props.search]);

  // Compose modal state
  const [composeOpen, setComposeOpen] = useState(false);

  // Draft editor state for the selected thread
  const existingDraft = threadDetail?.drafts?.[0] ?? null;
  const [draftSubject, setDraftSubject] = useState(existingDraft?.subject ?? '');
  const [draftBody, setDraftBody] = useState(existingDraft?.body_md ?? '');
  const [draftId, setDraftId] = useState<string | null>(existingDraft?.id ?? null);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  useEffect(() => {
    setDraftSubject(existingDraft?.subject ?? '');
    setDraftBody(existingDraft?.body_md ?? '');
    setDraftId(existingDraft?.id ?? null);
    setDraftError(null);
  }, [selectedThreadId, existingDraft?.id]);

  function setParams(patch: Record<string, string | undefined>) {
    const params = new URLSearchParams(sp?.toString() ?? '');
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === '' || v === 'all') params.delete(k);
      else params.set(k, v);
    }
    // Reset page to 0 unless explicitly set
    if (!('page' in patch)) params.delete('page');
    startTransition(() => {
      router.push(`/sales/inquiries?${params.toString()}#cockpit`, { scroll: false });
    });
  }

  function selectThread(threadId: string | null) {
    setParams({ thread: threadId ?? undefined });
  }

  async function aiDraftReply() {
    if (!selectedThreadId) return;
    setDraftSaving(true);
    setDraftError(null);
    try {
      const res = await fetch('/api/sales/email-draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mode: 'ai',
          intent: 'reply',
          thread_id: selectedThreadId,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'draft failed');
      setDraftId(j.draft.id);
      setDraftSubject(j.draft.subject ?? '');
      setDraftBody(j.draft.body_md ?? '');
      router.refresh();
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : String(e));
    } finally {
      setDraftSaving(false);
    }
  }

  async function loadTemplate(key: string) {
    if (!selectedThreadId) return;
    setDraftSaving(true);
    setDraftError(null);
    try {
      const res = await fetch('/api/sales/email-draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mode: 'template',
          thread_id: selectedThreadId,
          template_key: key,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'template failed');
      setDraftId(j.draft.id);
      setDraftSubject(j.draft.subject ?? '');
      setDraftBody(j.draft.body_md ?? '');
      router.refresh();
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : String(e));
    } finally {
      setDraftSaving(false);
    }
  }

  async function saveDraftEdits(newStatus?: 'draft' | 'approved' | 'discarded') {
    if (!draftId) {
      // Create a fresh manual draft
      setDraftSaving(true);
      try {
        const res = await fetch('/api/sales/email-draft', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            mode: 'manual',
            thread_id: selectedThreadId,
            subject: draftSubject,
            body_md: draftBody,
          }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error ?? 'save failed');
        setDraftId(j.draft.id);
        router.refresh();
      } catch (e) {
        setDraftError(e instanceof Error ? e.message : String(e));
      } finally {
        setDraftSaving(false);
      }
      return;
    }
    setDraftSaving(true);
    try {
      const res = await fetch('/api/sales/email-draft', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: draftId,
          subject: draftSubject,
          body_md: draftBody,
          status: newStatus,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'patch failed');
      router.refresh();
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : String(e));
    } finally {
      setDraftSaving(false);
    }
  }

  const scopeOptions = useMemo(() => {
    const base = [{ key: 'all', label: 'All', total: mailboxes.reduce((s,m)=>s+m.total,0), unanswered: mailboxes.reduce((s,m)=>s+m.unanswered,0) }];
    return [...base, ...mailboxes.slice(0, 8).map(m => ({ key: m.intended_mailbox, label: shortMailbox(m.intended_mailbox), total: m.total, unanswered: m.unanswered }))];
  }, [mailboxes]);

  return (
    <article
      id="cockpit"
      className="panel"
      style={{
        marginTop: 14,
        padding: 14,
        background: 'var(--paper-warm)',
        border: '1px solid var(--paper-deep)',
        borderRadius: 8,
      }}
    >
      {/* HEADER + COMPOSE */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 10 }}>
        <div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)' }}>
            Email Cockpit · {props.scope === 'all' ? 'all mailboxes' : props.scope}
          </div>
          <div style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-mute)', marginTop: 2 }}>
            Triage, search, reply with AI assist · drafts persisted to <code style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>sales.email_drafts</code>
          </div>
        </div>
        <button
          onClick={() => setComposeOpen(true)}
          style={{
            padding: '8px 16px',
            background: 'var(--moss)',
            color: 'var(--paper-warm)',
            border: 0,
            borderRadius: 6,
            fontFamily: 'var(--mono)',
            fontSize: 'var(--t-sm)',
            fontWeight: 600,
            letterSpacing: 'var(--ls-loose)',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          + Compose
        </button>
      </div>

      {/* HONEST BANNER */}
      <div style={{
        padding: '8px 12px',
        marginBottom: 12,
        background: 'rgba(0,0,0,0.04)',
        border: '1px solid var(--paper-deep)',
        borderRadius: 6,
        fontSize: 'var(--t-xs)',
        color: 'var(--ink-mute)',
      }}>
        <strong style={{ color: 'var(--brass)' }}>Send disabled.</strong> Until <code>gmail.send</code> scope is granted via <a href="/admin/gmail-connect" style={{ color: 'var(--brass)' }}>/admin/gmail-connect</a>, drafts can be saved + approved + copy-pasted into Gmail. No outbound is sent automatically.
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 14 }}>
        {[
          { label: 'Threads · scope', val: kpis.total_threads.toLocaleString(), sub: props.scope === 'all' ? 'across all mailboxes' : 'in scope' },
          { label: 'Unanswered', val: kpis.unanswered.toLocaleString(), sub: `${kpis.unanswered_24h} > 24h`, color: kpis.unanswered_24h > 0 ? 'var(--st-bad)' : undefined },
          { label: 'Drafts pending', val: kpis.drafts_pending.toLocaleString(), sub: 'awaiting approval', color: kpis.drafts_pending > 0 ? 'var(--brass)' : undefined },
          { label: 'Sent today', val: kpis.sent_today.toLocaleString(), sub: 'outbound · UTC', color: 'var(--moss-glow)' },
          { label: 'Oldest open', val: kpis.oldest_unanswered_hours == null ? '—' : kpis.oldest_unanswered_hours < 24 ? `${Math.round(kpis.oldest_unanswered_hours)}h` : `${Math.round(kpis.oldest_unanswered_hours/24)}d`, sub: 'time since arrival' },
        ].map(k => (
          <div key={k.label} style={{ padding: '10px 12px', background: 'var(--paper)', border: '1px solid var(--paper-deep)', borderRadius: 6 }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)' }}>
              {k.label}
            </div>
            <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'var(--t-2xl)', fontWeight: 500, color: k.color ?? 'var(--ink)', lineHeight: 1.1, marginTop: 2 }}>
              {k.val}
            </div>
            <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', marginTop: 2 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* TOOLBAR — scope + status + direction + search */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        {/* Scope (mailbox) */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)', minWidth: 60 }}>Scope</span>
          {scopeOptions.map(o => (
            <button key={o.key} type="button" onClick={() => setParams({ scope: o.key === 'all' ? undefined : o.key })}
                    style={props.scope === o.key || (o.key === 'all' && props.scope === 'all') ? chipActive : chipBase}>
              {o.label} <span style={{ opacity: 0.7, marginLeft: 4 }}>{o.total}</span>
              {o.unanswered > 0 && <span style={{ marginLeft: 4, color: props.scope === o.key ? 'var(--paper-warm)' : 'var(--st-bad)' }}>·{o.unanswered}↺</span>}
            </button>
          ))}
        </div>
        {/* Category — dynamic from sales.email_categories */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)', minWidth: 60 }}>Kind</span>
          <button type="button" onClick={() => setParams({ cat: 'all' })}
                  style={props.category === 'all' ? chipActive : chipBase}>All</button>
          {categories.map(c => (
            <button key={c.key} type="button" onClick={() => setParams({ cat: c.key })}
                    style={props.category === c.key ? chipActive : chipBase}>
              {c.label}
            </button>
          ))}
          <a href="/settings/email-categories" style={{ ...chipBase, color: 'var(--brass)', borderColor: 'var(--brass-soft)', textDecoration: 'none', marginLeft: 4 }}>
            ⚙ edit
          </a>
        </div>
        {/* Status (orthogonal to category — modifies the result set) */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)', minWidth: 60 }}>Status</span>
          {(['all','unanswered','drafted','sent_today'] as CockpitStatus[]).map(s => (
            <button key={s} type="button" onClick={() => setParams({ status: s })}
                    style={props.status === s ? chipActive : chipBase}>
              {s === 'all' ? 'All' : s === 'unanswered' ? 'Unanswered' : s === 'drafted' ? 'Drafted' : 'Sent today'}
            </button>
          ))}
          <span style={{ marginLeft: 18, fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)' }}>Since</span>
          {(['7d','30d','90d','365d','all'] as CockpitSince[]).map(s => (
            <button key={s} type="button" onClick={() => setParams({ since: s })}
                    style={props.since === s ? chipActive : chipBase}>
              {SINCE_LABELS[s]}
            </button>
          ))}
        </div>
        {/* Direction + Search */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)', minWidth: 60 }}>Dir</span>
          {(['all','in','out'] as CockpitDirection[]).map(d => (
            <button key={d} type="button" onClick={() => setParams({ dir: d })}
                    style={props.direction === d ? chipActive : chipBase}>
              {d === 'all' ? 'All' : d === 'in' ? '↘ Received' : '↗ Sent'}
            </button>
          ))}
          <form
            onSubmit={(e) => { e.preventDefault(); setParams({ q: search || undefined }); }}
            style={{ display: 'flex', gap: 6, marginLeft: 'auto', flex: '1 1 280px', minWidth: 220 }}
          >
            <input
              type="search"
              placeholder="Search subject, sender, body…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                flex: 1, padding: '6px 10px', borderRadius: 5,
                border: '1px solid var(--paper-deep)', background: 'var(--paper)',
                fontSize: 'var(--t-sm)', color: 'var(--ink)',
              }}
            />
            <button type="submit" style={chipBrass}>Search</button>
            {props.search && (
              <button type="button" onClick={() => { setSearch(''); setParams({ q: undefined }); }} style={chipBase}>Clear</button>
            )}
          </form>
        </div>
      </div>

      {/* TWO-PANE LAYOUT */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedThreadId ? '1fr 1.4fr' : '1fr', gap: 12, minHeight: 460 }}>
        {/* THREAD LIST */}
        <div style={{ background: 'var(--paper)', border: '1px solid var(--paper-deep)', borderRadius: 6, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--paper-deep)', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)' }}>
            Threads · {threads.length}{hasMore ? '+' : ''} {pending && '· loading'}
          </div>
          {threads.length === 0 ? (
            <div style={{ padding: 18, color: 'var(--ink-mute)', fontSize: 'var(--t-sm)' }}>
              No threads match. Loosen filters or check the cron at <a href="/admin/gmail-connect" style={{ color: 'var(--brass)' }}>/admin/gmail-connect</a>.
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 540, overflowY: 'auto' }}>
              {threads.map(t => {
                const isActive = t.thread_id === selectedThreadId;
                const inbound = t.last_direction === 'inbound';
                return (
                  <li key={t.thread_id} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                    <button
                      type="button"
                      onClick={() => selectThread(isActive ? null : t.thread_id)}
                      style={{
                        width: '100%', textAlign: 'left',
                        padding: '8px 12px',
                        background: isActive ? 'var(--paper-deep)' : 'transparent',
                        borderLeft: isActive ? '3px solid var(--brass)' : '3px solid transparent',
                        border: 0,
                        cursor: 'pointer',
                        display: 'block',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                        <span style={{
                          fontWeight: t.unanswered ? 700 : 500,
                          fontSize: 'var(--t-sm)',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1,
                          color: 'var(--ink)',
                        }}>
                          <span style={{ color: inbound ? 'var(--moss-glow)' : 'var(--brass)', marginRight: 6, fontFamily: 'var(--mono)' }}>{inbound ? '↘' : '↗'}</span>
                          {senderLabel(t.last_from_name, t.last_from_email)}
                        </span>
                        <span style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', fontFamily: 'var(--mono)' }}>
                          {relativeTime(t.last_received_at)}
                        </span>
                      </div>
                      <div style={{
                        fontSize: 'var(--t-sm)',
                        fontWeight: t.unanswered ? 600 : 400,
                        marginTop: 2,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        color: 'var(--ink-soft)',
                      }}>
                        {t.last_subject ?? '(no subject)'}
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center', flexWrap: 'wrap', fontSize: 'var(--t-xs)' }}>
                        {t.msg_count > 1 && (
                          <span style={{ fontFamily: 'var(--mono)', color: 'var(--ink-mute)', background: 'var(--paper-warm)', padding: '1px 6px', borderRadius: 3 }}>{t.msg_count} msgs</span>
                        )}
                        {t.unanswered && (
                          <span style={{ fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: 'var(--ls-loose)', color: 'var(--st-bad)' }}>UNANSWERED</span>
                        )}
                        {t.has_draft && (
                          <span style={{ fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: 'var(--ls-loose)', color: 'var(--brass)' }}>DRAFT · {t.draft_status}</span>
                        )}
                        {t.category !== 'people' && (
                          <span style={{ fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: 'var(--ls-loose)', color: 'var(--ink-mute)', background: 'var(--paper-warm)', padding: '1px 6px', borderRadius: 3 }}>
                            {categoryLabel[t.category] ?? t.category}
                          </span>
                        )}
                        {t.triage_kind && (
                          <span style={{ fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: 'var(--ls-loose)', color: 'var(--brass-soft)' }}>{t.triage_kind}</span>
                        )}
                        <span style={{ marginLeft: 'auto', color: 'var(--ink-mute)' }}>→ {shortMailbox(t.intended_mailbox)}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {/* Pagination */}
          <div style={{ padding: '8px 12px', borderTop: '1px solid var(--paper-deep)', display: 'flex', gap: 6, justifyContent: 'space-between', alignItems: 'center' }}>
            <button type="button" onClick={() => setParams({ page: page > 0 ? String(page - 1) : undefined })} disabled={page === 0} style={chipBase}>‹ Prev</button>
            <span style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', fontFamily: 'var(--mono)' }}>page {page + 1}</span>
            <button type="button" onClick={() => setParams({ page: String(page + 1) })} disabled={!hasMore} style={hasMore ? chipBrass : chipBase}>Next ›</button>
          </div>
        </div>

        {/* THREAD READER + COMPOSER */}
        {selectedThreadId && threadDetail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
            {/* Messages */}
            <div style={{ background: 'var(--paper)', border: '1px solid var(--paper-deep)', borderRadius: 6, padding: 12, maxHeight: 320, overflowY: 'auto' }}>
              {threadDetail.messages.length === 0 && (
                <div style={{ color: 'var(--ink-mute)', fontSize: 'var(--t-sm)' }}>Thread has no messages.</div>
              )}
              {threadDetail.messages.map((m) => (
                <div key={m.id} style={{
                  marginBottom: 10, padding: '8px 10px',
                  background: m.direction === 'outbound' ? 'var(--paper-warm)' : 'var(--paper)',
                  borderLeft: `3px solid ${m.direction === 'outbound' ? 'var(--brass)' : 'var(--moss-glow)'}`,
                  borderRadius: 4,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-loose)', textTransform: 'uppercase', color: m.direction === 'outbound' ? 'var(--brass)' : 'var(--moss-glow)', fontWeight: 700 }}>
                      {m.direction === 'outbound' ? '↗ sent' : '↘ received'}
                    </span>
                    <span style={{ fontSize: 'var(--t-sm)', fontWeight: 600 }}>
                      {senderLabel(m.from_name, m.from_email)}
                    </span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', marginLeft: 'auto' }}>
                      {new Date(m.received_at).toLocaleString('en-CA', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                  <div style={{ fontFamily: 'var(--serif)', fontSize: 'var(--t-sm)', lineHeight: 1.55, color: 'var(--ink-soft)', whiteSpace: 'pre-wrap' }}>
                    {(m.body_text ?? '').slice(0, 4000) || EMPTY}
                  </div>
                </div>
              ))}
            </div>

            {/* Composer */}
            <div style={{ background: 'var(--paper)', border: '1px solid var(--paper-deep)', borderRadius: 6, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)', marginRight: 6 }}>
                  Compose · reply
                </span>
                <button type="button" onClick={aiDraftReply} disabled={draftSaving} style={chipBrass}>
                  {draftSaving ? '… drafting' : '✦ AI draft'}
                </button>
                <select
                  onChange={(e) => { if (e.target.value) loadTemplate(e.target.value); e.target.value = ''; }}
                  defaultValue=""
                  disabled={draftSaving}
                  style={{ ...chipBase, padding: '4px 8px', cursor: 'pointer' }}
                >
                  <option value="">Load template…</option>
                  {templates.map(t => (
                    <option key={t.key} value={t.key}>{t.name}</option>
                  ))}
                </select>
                <span style={{ marginLeft: 'auto', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', fontFamily: 'var(--mono)' }}>
                  {draftId ? `draft saved · ${(existingDraft?.generator ?? 'human')}` : 'no draft yet'}
                </span>
              </div>
              <input
                type="text"
                value={draftSubject}
                onChange={(e) => setDraftSubject(e.target.value)}
                placeholder="Subject"
                style={{ padding: '6px 10px', borderRadius: 5, border: '1px solid var(--paper-deep)', background: 'var(--paper-warm)', fontSize: 'var(--t-sm)', color: 'var(--ink)' }}
              />
              <textarea
                value={draftBody}
                onChange={(e) => setDraftBody(e.target.value)}
                placeholder="Body — use {{variable}} placeholders for templates."
                rows={10}
                style={{
                  padding: '8px 10px', borderRadius: 5, border: '1px solid var(--paper-deep)', background: 'var(--paper-warm)',
                  fontSize: 'var(--t-sm)', color: 'var(--ink)', fontFamily: 'var(--serif)', lineHeight: 1.5, resize: 'vertical',
                }}
              />
              {draftError && <div style={{ color: 'var(--st-bad)', fontSize: 'var(--t-xs)' }}>error: {draftError}</div>}
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => navigator.clipboard?.writeText(`${draftSubject}\n\n${draftBody}`)} style={chipBase}>Copy to clipboard</button>
                <button type="button" onClick={() => saveDraftEdits()} disabled={draftSaving} style={chipBase}>{draftSaving ? 'Saving…' : 'Save draft'}</button>
                <button type="button" onClick={() => saveDraftEdits('approved')} disabled={draftSaving || !draftId} style={chipBrass}>Mark approved</button>
                <button type="button" disabled title="Re-OAuth with gmail.send to enable" style={{ ...chipBase, opacity: 0.4, cursor: 'not-allowed' }}>Send (disabled)</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* COMPOSE NEW MODAL */}
      {composeOpen && (
        <ComposeNewModal
          templates={templates}
          onClose={() => setComposeOpen(false)}
          onSaved={() => { setComposeOpen(false); router.refresh(); }}
        />
      )}
    </article>
  );
}

// ── Compose modal ────────────────────────────────────────────────────

function ComposeNewModal({ templates, onClose, onSaved }: {
  templates: CockpitTemplate[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyMd, setBodyMd] = useState('');
  const [brief, setBrief] = useState('');
  const [tone, setTone] = useState('warm');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function aiDraft() {
    setSaving(true); setErr(null);
    try {
      const res = await fetch('/api/sales/email-draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: 'ai', intent: 'compose', brief, tone }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'draft failed');
      setSubject(j.draft.subject ?? '');
      setBodyMd(j.draft.body_md ?? '');
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }

  async function saveManual() {
    setSaving(true); setErr(null);
    try {
      const res = await fetch('/api/sales/email-draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mode: 'manual',
          to_emails: to.split(',').map(s => s.trim()).filter(Boolean),
          cc_emails: cc.split(',').map(s => s.trim()).filter(Boolean),
          subject, body_md: bodyMd,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'save failed');
      onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }

  function loadTemplate(key: string) {
    const t = templates.find(t => t.key === key);
    if (!t) return;
    setSubject(t.subject); setBodyMd(t.body_md);
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, padding: 24,
    }}>
      <div style={{
        background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)',
        borderRadius: 10, width: '100%', maxWidth: 720, maxHeight: '90vh',
        overflowY: 'auto', padding: 18,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 'var(--t-xl)', fontWeight: 500 }}>
            Compose <em style={{ color: 'var(--brass)' }}>new</em>
          </h3>
          <button type="button" onClick={onClose} style={chipBase}>Close</button>
        </div>

        {/* AI brief + tone */}
        <div style={{ background: 'var(--paper)', border: '1px solid var(--paper-deep)', borderRadius: 6, padding: 10, marginBottom: 10 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)', marginBottom: 6 }}>
            AI brief
          </div>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="e.g. soft check-in to French agent who hasn't replied in 5 days about retreat package"
            rows={2}
            style={{ width: '100%', padding: '6px 10px', borderRadius: 5, border: '1px solid var(--paper-deep)', background: 'var(--paper-warm)', fontSize: 'var(--t-sm)', color: 'var(--ink)' }}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--brass)' }}>tone</span>
            {['warm','neutral','formal','playful'].map(t => (
              <button key={t} type="button" onClick={() => setTone(t)} style={tone === t ? chipActive : chipBase}>{t}</button>
            ))}
            <button type="button" onClick={aiDraft} disabled={!brief || saving} style={{ ...chipBrass, marginLeft: 'auto' }}>
              {saving ? '… drafting' : '✦ AI draft'}
            </button>
            <select onChange={(e) => { if (e.target.value) loadTemplate(e.target.value); e.target.value = ''; }} defaultValue=""
                    style={{ ...chipBase, padding: '4px 8px', cursor: 'pointer' }}>
              <option value="">Template…</option>
              {templates.map(t => <option key={t.key} value={t.key}>{t.name}</option>)}
            </select>
          </div>
        </div>

        <input type="text" value={to} onChange={(e) => setTo(e.target.value)} placeholder="To (comma-sep)"
               style={{ width: '100%', padding: '6px 10px', borderRadius: 5, border: '1px solid var(--paper-deep)', background: 'var(--paper)', fontSize: 'var(--t-sm)', marginBottom: 8 }} />
        <input type="text" value={cc} onChange={(e) => setCc(e.target.value)} placeholder="Cc"
               style={{ width: '100%', padding: '6px 10px', borderRadius: 5, border: '1px solid var(--paper-deep)', background: 'var(--paper)', fontSize: 'var(--t-sm)', marginBottom: 8 }} />
        <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject"
               style={{ width: '100%', padding: '6px 10px', borderRadius: 5, border: '1px solid var(--paper-deep)', background: 'var(--paper)', fontSize: 'var(--t-sm)', marginBottom: 8 }} />
        <textarea value={bodyMd} onChange={(e) => setBodyMd(e.target.value)} placeholder="Body" rows={10}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 5, border: '1px solid var(--paper-deep)', background: 'var(--paper)', fontSize: 'var(--t-sm)', fontFamily: 'var(--serif)', lineHeight: 1.5, resize: 'vertical', marginBottom: 8 }} />

        {err && <div style={{ color: 'var(--st-bad)', fontSize: 'var(--t-xs)', marginBottom: 8 }}>error: {err}</div>}

        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => navigator.clipboard?.writeText(`To: ${to}\nCc: ${cc}\nSubject: ${subject}\n\n${bodyMd}`)} style={chipBase}>Copy</button>
          <button type="button" onClick={saveManual} disabled={saving || !subject || !bodyMd} style={chipBrass}>
            {saving ? 'Saving…' : 'Save draft'}
          </button>
          <button type="button" disabled title="Re-OAuth with gmail.send to enable" style={{ ...chipBase, opacity: 0.4, cursor: 'not-allowed' }}>Send (disabled)</button>
        </div>
      </div>
    </div>
  );
}
