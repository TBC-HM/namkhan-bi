// app/holding/it2/_lib/actionCenter.ts
// action-center-inbox-v1 (2026-08-04): ONE fetch used by both the server page
// (SSR first paint) and /api/it2/action-center (client refetch) — the numbers
// can never diverge between first render and live refresh.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export type InboxRow = {
  kind: 'brief-question' | 'bug-question' | 'finding-red';
  title: string;
  detail: string;
  cta: 'Answer' | 'Confirm';
  href: string;
};
export type ResponseRow = {
  kind: 'response' | 'ticket';
  id: number;
  label: string;
  summary: string;
  href: string | null;
  created_at: string;
};
export type ActionCenterPayload = {
  inbox: InboxRow[];
  strip: ResponseRow[];
  redCount: number;
  amberCount: number;
  amberModules: string[];
  needsYou: number;
  fetchedAt: string;
};

export async function fetchActionCenter(): Promise<ActionCenterPayload> {
  const sb = getSupabaseAdmin();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();

  const [briefsRes, bugsRes, findingsRes, responsesRes, ticketsRes] = await Promise.all([
    (sb as any).from('v_build_briefs_index')
      .select('slug, title, status, open_question')
      .in('status', ['needs_input', 'verifying'])
      .not('open_question', 'is', null),
    (sb as any).from('cockpit_bugs')
      .select('id, body, status, open_question')
      .not('open_question', 'is', null)
      .in('status', ['new', 'acked', 'processing']),
    (sb as any).from('v_module_findings')
      .select('id, module_doc_type, display_name, finding, status, blocking')
      .in('status', ['open', 'acknowledged']),
    (sb as any).from('v_owner_responses')
      .select('id, signal_id, response_kind, ref, summary, created_at')
      .is('dismissed_at', null)
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false })
      .limit(30),
    (sb as any).from('cockpit_tickets')
      .select('id, email_subject, parsed_summary, updated_at')
      .eq('status', 'awaits_user')
      .gte('updated_at', sevenDaysAgo)
      .order('updated_at', { ascending: false }),
  ]);

  // ---- Inbox: only rows PBS can act on (A3: no CTA-less rows) ----
  const inbox: InboxRow[] = [];
  for (const b of (briefsRes?.data ?? [])) {
    const q = b.open_question ?? {};
    if (q.answer_key) continue; // answered — the verifier's move now, not PBS's
    inbox.push({
      kind: 'brief-question',
      title: b.title ?? b.slug,
      detail: typeof q.question === 'string' ? q.question : 'Open question on this brief',
      cta: 'Answer',
      href: `/holding/it2/modules/briefs/${b.slug}`,
    });
  }
  for (const bug of (bugsRes?.data ?? [])) {
    const q = bug.open_question ?? {};
    inbox.push({
      kind: 'bug-question',
      title: `Bug #${bug.id} · ${(bug.body ?? '').split('\n')[0].slice(0, 60)}`,
      detail: typeof q.question === 'string' ? q.question : 'Open question on this bug',
      cta: 'Answer',
      href: `/holding/it2/fleet/bugs`,
    });
  }

  // ---- Finding split: red = open (needs YOU), amber = acknowledged (in build) ----
  const findings = findingsRes?.data ?? [];
  const red = findings.filter((f: any) => f.status === 'open');
  const amber = findings.filter((f: any) => f.status === 'acknowledged');
  for (const f of red) {
    inbox.push({
      kind: 'finding-red',
      title: `Finding #${f.id} · ${f.display_name ?? f.module_doc_type}`,
      detail: String(f.finding ?? '').slice(0, 140),
      cta: 'Confirm',
      href: `/holding/it2/modules/findings/${encodeURIComponent(f.module_doc_type)}`,
    });
  }

  // ---- Response strip: agent responses + awaits_user notices (7-day expiry) ----
  const strip: ResponseRow[] = [];
  for (const r of (responsesRes?.data ?? [])) {
    strip.push({
      kind: 'response',
      id: r.id,
      label: String(r.response_kind ?? 'response').replace(/_/g, ' '),
      summary: r.summary ?? r.ref ?? 'Agent responded.',
      href: r.ref && String(r.ref).startsWith('/') ? r.ref : null,
      created_at: r.created_at,
    });
  }
  for (const t of (ticketsRes?.data ?? [])) {
    strip.push({
      kind: 'ticket',
      id: t.id,
      label: 'awaiting you',
      summary: t.email_subject || t.parsed_summary || `Ticket #${t.id}`,
      href: null,
      created_at: t.updated_at,
    });
  }
  strip.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  return {
    inbox,
    strip,
    redCount: red.length,
    amberCount: amber.length,
    amberModules: Array.from(new Set(amber.map((f: any) => String(f.module_doc_type)))),
    needsYou: inbox.length,
    fetchedAt: new Date().toISOString(),
  };
}
