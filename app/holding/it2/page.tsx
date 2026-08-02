// app/holding/it2/page.tsx
// PBS 2026-07-30 — ACTION CENTER: the IT2 home (brief it-area-reorg-v1).
// Fix 2026-08-02: brief/bug questions now link directly to their specific page,
// not the generic /questions inbox. Module questions link to their brief when
// brief_slug is available.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { TOKENS, MONO } from '@/components/cockpit/tokens';
import { fetchCockpitOpsKpis, tileNum } from '@/lib/kpi/cockpitOps';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type NeedsYouItem = {
  kind: 'question' | 'ticket' | 'module-question';
  title: string;
  detail: string;
  href: string;
};

export default async function ActionCenterPage() {
  const sb = getSupabaseAdmin();

  const [briefsRes, bugsRes, mcqRes, ticketsRes, auditRes, ops] = await Promise.all([
    (sb as any).from('v_build_briefs_index')
      .select('slug, title, status, open_question')
      .in('status', ['needs_input', 'verifying'])
      .not('open_question', 'is', null),
    (sb as any).from('cockpit_bugs')
      .select('id, body, status, open_question')
      .not('open_question', 'is', null)
      .in('status', ['new', 'acked', 'processing']),
    (sb as any).from('v_module_completion_queue')
      .select('module_doc_type, display_name, status, completion_estimate, brief_slug, entry_url, in_production, expected_delivery, open_questions'),
    (sb as any).from('cockpit_tickets')
      .select('id, email_subject, parsed_summary, updated_at')
      .eq('status', 'awaits_user')
      .order('updated_at', { ascending: false }),
    (sb as any).from('cockpit_audit_log')
      .select('agent, action, target, success, created_at')
      .gte('created_at', new Date(Date.now() - 24 * 3600_000).toISOString())
      .order('created_at', { ascending: false })
      .limit(12),
    fetchCockpitOpsKpis().catch(() => null),
  ]);

  const briefs = briefsRes?.data ?? [];
  const bugs = bugsRes?.data ?? [];
  const mcq: any[] = mcqRes?.data ?? [];
  const tickets = ticketsRes?.data ?? [];
  const audit = auditRes?.data ?? [];

  // ---- Zone 1 · NEEDS YOU ----
  const items: NeedsYouItem[] = [];
  for (const b of briefs) {
    const q = b.open_question ?? {};
    // Skip briefs that are already answered (have answer_key) — they're waiting for verifier
    if (q.answer_key) continue;
    items.push({
      kind: 'question',
      title: b.title ?? b.slug,
      detail: typeof q.question === 'string' ? q.question : 'Open question on this brief',
      // Link directly to the specific brief so PBS can read context and answer inline
      href: `/holding/it2/modules/briefs/${b.slug}`,
    });
  }
  for (const bug of bugs) {
    const q = bug.open_question ?? {};
    items.push({
      kind: 'question',
      title: `Bug #${bug.id} · ${(bug.body ?? '').split('\n')[0].slice(0, 60)}`,
      detail: typeof q.question === 'string' ? q.question : 'Open question on this bug',
      href: `/holding/it2/fleet/bugs`,
    });
  }
  for (const m of mcq) {
    const oq = (m.open_questions ?? '').trim();
    if (!oq) continue;
    // Skip already-resolved questions
    if (oq.startsWith('RESOLVED') || oq.startsWith('ANSWERED')) continue;
    items.push({
      kind: 'module-question',
      title: m.display_name ?? m.module_doc_type,
      detail: oq,
      // If there's a brief for this module, link there for context + inline answer
      // BLOCKED = send to Decision Inbox; has brief = send to brief; else entry_url
      href: oq.startsWith('BLOCKED')
        ? '/holding/it2/questions'
        : m.brief_slug
          ? `/holding/it2/modules/briefs/${m.brief_slug}`
          : (m.entry_url || '/holding/it2/modules/status'),
    });
  }
  for (const t of tickets) {
    items.push({
      kind: 'ticket',
      title: t.email_subject || `Ticket #${t.id}`,
      detail: (t.parsed_summary ?? 'Awaiting your reply.').slice(0, 140),
      href: `/holding/it2/fleet/tasks/${t.id}`,
    });
  }

  // ---- Zone 2 · STATUS ----
  const total = mcq.length;
  const inProd = mcq.filter((m) => m.in_production === true).length;
  const inPipeline = mcq.filter((m) => ['in_pipeline', 'spec_created'].includes(m.status)).length;
  const tiles = [
    { label: 'IN PRODUCTION', value: total ? `${inProd}/${total}` : '—', foot: 'modules & workflows', href: '/holding/it2/modules/status' },
    { label: 'IN PIPELINE',   value: String(inPipeline || '—'),          foot: 'being built now',    href: '/holding/it2/modules/queue' },
    { label: 'AGENTS',        value: tileNum((ops as any)?.agents_active), foot: 'active roles',     href: '/holding/it2/fleet/team' },
    { label: 'TICKETS',       value: tileNum((ops as any)?.tickets_open),  foot: `open · ${(ops as any)?.tickets_awaits_user ?? '—'} need you`, href: '/holding/it2/fleet/tasks' },
    { label: 'DEPLOYS 24H',   value: tileNum((ops as any)?.deploys_24h),   foot: 'to production',    href: '/holding/it2/system/deploys' },
    { label: 'SLA',           value: (ops as any)?.sla_triage_pct != null ? `${Math.round((ops as any).sla_triage_pct)}%` : '—', foot: '30d · triage ≤5 min', href: '/holding/it2/system/health' },
  ];

  const KIND_TONE: Record<string, { bg: string; fg: string; tag: string }> = {
    'question':        { bg: '#FDECE4', fg: '#B04A2F', tag: 'QUESTION' },
    'module-question': { bg: '#FFF4D6', fg: '#8A6D00', tag: 'MODULE' },
    'ticket':          { bg: '#E3F2FD', fg: '#1565C0', tag: 'TICKET' },
  };

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', color: TOKENS.ink }}>
      <div style={{ margin: '4px 0 18px' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
          Action Center {items.length > 0 ? `· ${items.length} waiting on you` : ''}
        </h1>
        <p style={{ fontSize: 12, color: TOKENS.text2, margin: '4px 0 0' }}>
          Everything that needs YOU, in one place. Empty list = the machine is running on its own.
        </p>
      </div>

      {/* Zone 1 · NEEDS YOU */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
          <h2 style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: '#B04A2F', margin: 0 }}>
            ◉ NEEDS YOU ({items.length})
          </h2>
          <a href="/holding/it2/questions" style={{ fontSize: 11, fontWeight: 700, color: TOKENS.forest, textDecoration: 'none' }}>
            Open Decision Inbox (answer inline) →
          </a>
        </div>
        {items.length === 0 ? (
          <div style={{ fontSize: 13, color: TOKENS.text2, background: TOKENS.bgRaised, border: `1px solid ${TOKENS.border}`, borderRadius: 8, padding: '18px 16px' }}>
            Nothing needs you. All questions answered, no tickets waiting, no merges pending.
          </div>
        ) : items.map((it, i) => {
          const tone = KIND_TONE[it.kind];
          return (
            <a key={i} href={it.href} style={{
              display: 'flex', alignItems: 'flex-start', gap: 10, textDecoration: 'none',
              background: TOKENS.bgRaised, border: `1px solid ${TOKENS.border}`, borderRadius: 8,
              padding: '10px 14px', marginBottom: 6, color: TOKENS.ink,
            }}>
              <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: tone.bg, color: tone.fg, marginTop: 2, whiteSpace: 'nowrap' }}>
                {tone.tag}
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 600 }}>{it.title}</span>
                <span style={{ display: 'block', fontSize: 11.5, color: TOKENS.text2, marginTop: 1 }}>{it.detail}</span>
              </span>
            </a>
          );
        })}
      </div>

      {/* Zone 2 · STATUS */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: TOKENS.text2, margin: '0 0 8px' }}>
          STATUS
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          {tiles.map((t) => (
            <a key={t.label} href={t.href} style={{
              textDecoration: 'none', color: TOKENS.ink, background: TOKENS.bgRaised,
              border: `1px solid ${TOKENS.border}`, borderRadius: 8, padding: '12px 14px',
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: TOKENS.text2 }}>{t.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: MONO, margin: '2px 0' }}>{t.value}</div>
              <div style={{ fontSize: 10.5, color: TOKENS.text3 }}>{t.foot}</div>
            </a>
          ))}
        </div>
      </div>

      {/* Zone 3 · LAST 24H */}
      <div>
        <h2 style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: TOKENS.text2, margin: '0 0 8px' }}>
          LAST 24H — WHAT THE MACHINE DID
        </h2>
        <div style={{ background: TOKENS.bgRaised, border: `1px solid ${TOKENS.border}`, borderRadius: 8, overflow: 'hidden' }}>
          {audit.length === 0 ? (
            <div style={{ fontSize: 12, color: TOKENS.text3, padding: '14px 16px' }}>No agent activity logged in the last 24 hours.</div>
          ) : audit.map((a: any, i: number) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'baseline', gap: 10, padding: '7px 14px',
              borderBottom: i < audit.length - 1 ? `1px solid ${TOKENS.border}` : 'none', fontSize: 12,
            }}>
              <span style={{ fontFamily: MONO, fontSize: 10.5, color: TOKENS.text3, whiteSpace: 'nowrap' }}>
                {(a.created_at as string).slice(11, 16)}
              </span>
              <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{a.agent ?? '—'}</span>
              <span style={{ color: TOKENS.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {a.action}{a.target ? ` · ${a.target}` : ''}
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 10, color: a.success === false ? '#B04A2F' : '#2E6B45' }}>
                {a.success === false ? '✗' : '✓'}
              </span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 6, textAlign: 'right' }}>
          <a href="/holding/it2/system/activity" style={{ fontSize: 11, color: TOKENS.forest, textDecoration: 'none', fontWeight: 600 }}>
            Full activity log →
          </a>
        </div>
      </div>
    </div>
  );
}
