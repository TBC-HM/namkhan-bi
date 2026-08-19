// app/holding/it2/modules/specs/page.tsx
// Module Docs hub — lists module specs + build briefs.
// Uses public.v_documents_latest + public.v_build_briefs (bridge views over documentation schema).
// v2 2026-07-25: pipeline lifecycle strip per module (Audit → Spec → Repair → Check → Frozen)
// v3 2026-08-04 (modules-specs-redesign-v1, PBS): department subtabs + audience
// toggle + compact expandable rows via SpecsExplorer (client). This server file
// assembles one serializable row per module and owns the two server actions.
// v3.2 merges dec823b (badge classifies by thread state only) after push race.

import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import SpecsExplorer, { type ModuleRow, type WorkOrder } from './SpecsExplorer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const BRIEF_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  ready:       { label: 'ready for agent', bg: '#E3F2FD', color: '#1565C0' },
  research:    { label: 'research running', bg: '#FFF3E0', color: '#E65100' },
  in_progress: { label: 'repair running',  bg: '#FFF8E1', color: '#F57F17' },
  verifying:   { label: 'checking',        bg: '#EDE7F6', color: '#4527A0' },
  needs_input: { label: '⚠ needs PBS',     bg: '#FFEBEE', color: '#B71C1C' },
  shipped:     { label: 'shipped ✓',       bg: '#E8F5E9', color: '#2E7D32' },
  draft:       { label: 'draft',           bg: '#F4EFE2', color: '#5A5A5A' },
  archived:    { label: 'archived',        bg: '#F4EFE2', color: '#8A8A8A' },
};

// PBS 2026-07-27: TESTING bracket between Check and Frozen.
// ADR-218: 'completed' alone never renders FROZEN — the truth gate decides.
function pipelineState(q: any, briefStatus: string | null, frozen?: boolean): { done: number; active: string; alert: boolean } {
  if (!q || q.status === 'skipped') return { done: -1, active: 'not queued', alert: false };
  if (q.status === 'pending')   return { done: -1, active: 'queued for audit', alert: false };
  if (q.status === 'auditing')  return { done: 0,  active: 'audit running', alert: false };
  if (q.status === 'completed') {
    if (frozen) return { done: 5, active: 'FROZEN · finished', alert: false };
    return { done: 4, active: 'completed claim — UNPROVEN', alert: true };
  }
  const testing = `testing · ${q?.testing_ok ?? 0} of ${q?.testing_target ?? 50} good runs`;
  switch (briefStatus) {
    case 'research':    return { done: 1, active: 'research running', alert: false };
    case 'ready':       return { done: 1, active: 'repair queued', alert: false };
    case 'in_progress': return { done: 2, active: 'repair running', alert: false };
    case 'verifying':   return { done: 3, active: 'checking', alert: false };
    case 'needs_input': return { done: 1, active: 'needs your input', alert: true };
    case 'shipped':     return { done: 4, active: testing, alert: false };
    default:
      if ((q?.testing_ok ?? 0) > 0) return { done: 4, active: testing, alert: false };
      return { done: 1, active: 'spec created', alert: false };
  }
}

async function fetchData() {
  const [{ data: moduleDocs }, { data: briefs }, { data: statuses }, { data: queue }, { data: truth }, { data: findingRows }, { data: threadRows }, { data: reauditSignals }] = await Promise.all([
    getSupabaseAdmin()
      .from('v_documents_latest')
      .select('id, doc_type, title, status, version, last_updated_at')
      .like('doc_type', '%_module')
      .order('doc_type'),
    (getSupabaseAdmin() as any)
      .from('v_build_briefs')
      .select('id, slug, title, status, tags, created_at, last_updated_at, shipped_at')
      .order('created_at', { ascending: false })
      .limit(30),
    (getSupabaseAdmin() as any)
      .from('v_module_status')
      .select('doc_type, completion_pct, is_live, signed_off_at')
      .like('doc_type', '%_module'),
    (getSupabaseAdmin() as any)
      .from('v_module_completion_queue')
      .select('module_doc_type, display_name, status, completion_estimate, brief_slug, priority, updated_at, entry_url, testing_target, testing_ok, gap_list, department, audience'),
    (getSupabaseAdmin() as any)
      .from('v_module_truth')
      .select('module_doc_type, status, spec_pct, tested_pct, testing_ok, testing_target, open_blocking_findings, owner_test_waiver, owner_signoff_at, department, audience'),
    (getSupabaseAdmin() as any)
      .from('v_module_findings')
      .select('id, module_doc_type, status'),
    // PBS 2026-08-04 #2: badge must show WHOSE move — thread state per finding
    (getSupabaseAdmin() as any)
      .from('v_finding_threads')
      .select('finding_id, is_restatement, confirms_understanding'),
    // Scope 3 (modules-specs-redesign-v1): last re-audit request per module —
    // payload carries prev_spec/prev_gaps captured at press time, so the card
    // can show the post-audit delta ("was 45% → now 60%, gaps closed 2").
    (getSupabaseAdmin() as any)
      .from('v_module_reaudit_last')
      .select('module_doc_type, created_at, payload'),
  ]);
  // module-surface-slice-work-orders-strip: ONE query for all modules'
  // attached briefs (v_module_work_orders joins completion_queue.brief_slug
  // plus the 'module:<doc_type>' tag form) — grouped in memory, no N+1.
  const { data: workOrderRows } = await (getSupabaseAdmin() as any)
    .from('v_module_work_orders')
    .select('module_doc_type, slug, title, status, version, needs_answer, shipped_at, last_updated_at')
    .order('last_updated_at', { ascending: false });
  // goal-editor-v1 A2c: pending goal_refined signals — card shows
  // "rewrite queued" until the next builder consumes the signal and
  // rewrites the brief against the refined goal (law 737).
  const { data: goalSignals } = await (getSupabaseAdmin() as any)
    .from('v_owner_signals_pending')
    .select('brief_slug, kind')
    .eq('kind', 'goal_refined');
  const goalRefinedSlugs = new Set<string>((goalSignals ?? []).map((s: any) => String(s.brief_slug)).filter((s: string) => s && s !== 'null'));
  const statusMap: Record<string, any> = {};
  for (const s of (statuses ?? [])) statusMap[s.doc_type] = s;
  const queueMap: Record<string, any> = {};
  for (const qr of (queue ?? [])) queueMap[qr.module_doc_type] = qr;
  const truthMap: Record<string, any> = {};
  for (const t of (truth ?? [])) truthMap[t.module_doc_type] = t;
  const signalMap: Record<string, any> = {};
  for (const s of (reauditSignals ?? [])) signalMap[s.module_doc_type] = s;
  // PBS 2026-08-04 #2 (bf42dff + dec823b, merged after push race): THREE
  // states — red = restated, waiting for PBS confirm (HIS move); blue =
  // filed, with agents, restatement pending; amber = confirmed, in build.
  const redFindings: Record<string, number> = {};
  const blueFindings: Record<string, number> = {};
  const amberFindings: Record<string, number> = {};
  const restated = new Set<number>();
  const confirmed = new Set<number>();
  for (const t of (threadRows ?? [])) {
    if (t.is_restatement) restated.add(t.finding_id);
    if (t.confirms_understanding) confirmed.add(t.finding_id);
  }
  // v3 (PBS 2026-08-04): classify by THREAD state only — the status column
  // flips to 'acknowledged' on restatement, which is NOT the same as PBS
  // having confirmed. confirmed→amber, restated-unconfirmed→red, else blue.
  for (const f of (findingRows ?? [])) {
    if (f.status === 'open' || f.status === 'acknowledged') {
      if (confirmed.has(f.id)) {
        amberFindings[f.module_doc_type] = (amberFindings[f.module_doc_type] ?? 0) + 1;
      } else if (restated.has(f.id)) {
        redFindings[f.module_doc_type] = (redFindings[f.module_doc_type] ?? 0) + 1;
      } else {
        blueFindings[f.module_doc_type] = (blueFindings[f.module_doc_type] ?? 0) + 1;
      }
    }
  }
  const briefStatusBySlug: Record<string, string> = {};
  for (const b of (briefs ?? [])) briefStatusBySlug[b.slug] = b.status;
  // Work-orders strip: resolve chip colours (BRIEF_STATUS — same map as the
  // briefs list below) and the ONE state-matched CTA on the server so the
  // client stays a dumb renderer. CTAs navigate only — no mutation from here.
  const workOrdersMap: Record<string, WorkOrder[]> = {};
  for (const w of (workOrderRows ?? [])) {
    const chip = BRIEF_STATUS[w.status] ?? { label: w.status ?? 'draft', bg: '#F4EFE2', color: '#5A5A5A' };
    const briefHref = `/holding/it2/modules/briefs/${encodeURIComponent(w.slug)}`;
    const cta: { label: string; href: string } =
      w.status === 'needs_input' ? { label: 'Answer', href: `${briefHref}#question` } :
      w.status === 'ready'       ? { label: 'Fire',   href: briefHref } :
      w.status === 'in_progress' ? { label: 'Watch',  href: `/holding/it2/system/live?brief=${encodeURIComponent(w.slug)}` } :
      w.status === 'verifying'   ? { label: 'Verify', href: briefHref } :
                                   { label: 'Read',   href: briefHref };
    (workOrdersMap[w.module_doc_type] ??= []).push({
      slug: w.slug,
      title: w.title ?? w.slug,
      status: w.status ?? 'draft',
      statusLabel: chip.label,
      statusBg: chip.bg,
      statusColor: chip.color,
      version: w.version ?? 0,
      needsAnswer: !!w.needs_answer,
      live: !['shipped', 'archived'].includes(w.status),
      lastUpdated: w.last_updated_at ? shortDate(w.last_updated_at) : null,
      shippedAt: w.shipped_at ? shortDate(w.shipped_at) : null,
      ctaLabel: cta.label,
      ctaHref: cta.href,
    });
  }
  // PBS 2026-07-27: new modules get a box the moment they are drafted.
  const docs = [...(moduleDocs ?? [])];
  const haveDoc = new Set(docs.map((d: any) => d.doc_type));
  for (const qr of (queue ?? [])) {
    // Finding #55 (2026-08-06): only canonical '%_module' keys may spawn a
    // synthetic "drafted module" card — a stray queue key (e.g. 'central_chat'
    // alongside 'central_chat_module') rendered as a phantom duplicate spec card.
    if (!String(qr.module_doc_type ?? '').endsWith('_module')) continue;
    if (!haveDoc.has(qr.module_doc_type)) {
      docs.push({
        id: qr.module_doc_type, doc_type: qr.module_doc_type,
        title: `${qr.display_name ?? qr.module_doc_type.replace(/_module$/, '').replace(/_/g, ' ')} — spec doc pending (drafted module)`,
        status: 'draft', version: 0, last_updated_at: qr.updated_at ?? null,
      });
    }
  }
  docs.sort((a: any, b: any) => String(a.doc_type).localeCompare(String(b.doc_type)));
  return { moduleDocs: docs, briefs: briefs ?? [], statusMap, queueMap, briefStatusBySlug, truthMap, redFindings, blueFindings, amberFindings, signalMap, goalRefinedSlugs, workOrdersMap };
}

// ADR-218 freeze gate — derived from v_module_truth, never from completion_estimate.
function isFrozen(t: any): boolean {
  return !!t && t.status === 'completed'
    && (t.tested_pct === 100 || t.owner_test_waiver === true)
    && (t.open_blocking_findings ?? 0) === 0;
}

// Rule 712: ISO slice, identical on every environment.
function shortDate(iso: string): string {
  return String(iso).slice(0, 10);
}

// ONE next action per card, derived from real pipeline state.
function nextAction(q: any, briefStatus: string | null, signedOff: boolean, frozen: boolean, moduleDocType: string):
  { label: string; href?: string; rpc?: 'sign_off' | 'reaudit'; tone: 'red' | 'green' | 'gold' | 'grey' } {
  if (frozen) return { label: '🧊 Frozen', tone: 'grey' };
  if (signedOff || q?.status === 'completed')
    return { label: '⚠ Unproven', href: `/holding/it2/modules/findings/${encodeURIComponent(moduleDocType)}`, tone: 'red' };
  if (briefStatus === 'needs_input' && q?.brief_slug)
    return { label: '❓ Answer', href: `/holding/it2/modules/briefs/${q.brief_slug}`, tone: 'red' };
  if (briefStatus === 'ready' && q?.brief_slug)
    return { label: '⏳ Queued', href: `/holding/it2/modules/briefs/${q.brief_slug}`, tone: 'gold' };
  if (briefStatus === 'shipped') {
    const ok = q?.testing_ok ?? 0; const target = q?.testing_target ?? 50;
    if (ok < target) return { label: `🧪 ${ok}/${target} runs`, tone: 'gold' };
    return { label: '🧊 Freeze', rpc: 'sign_off', tone: 'green' };
  }
  if (briefStatus && ['research', 'in_progress', 'verifying'].includes(briefStatus) && q?.brief_slug)
    // Finding #31 (PBS 2026-08-04): eye icon ONLY — compact, links to live activity.
    return { label: '👁', href: `/holding/it2/system/live?brief=${encodeURIComponent(q.brief_slug)}`, tone: 'gold' };
  const auditAgeDays = q?.updated_at ? (Date.now() - new Date(q.updated_at).getTime()) / 86400000 : Infinity;
  if (q?.completion_estimate == null || auditAgeDays > 3)
    return { label: '⟳ Re-audit', rpc: 'reaudit', tone: 'gold' };
  return { label: '⏲ auto 6h', tone: 'grey' };
}

async function signOffAction(formData: FormData) {
  'use server';
  const docType = String(formData.get('doc_type') ?? '');
  if (!docType) return;
  // ADR-218 (law 730 addendum): fn_module_signoff refuses while open blocking
  // findings exist — surface the refusal verbatim as a toast, never silently.
  let errMsg: string | null = null;
  try {
    const { data, error } = await (getSupabaseAdmin() as any)
      .rpc('fn_module_signoff', { p_module: docType, p_by: 'PBS', p_revoke: false });
    if (error) errMsg = error.message;
    else if (data && data.ok === false) errMsg = String(data.error ?? 'sign-off refused');
  } catch (e: any) {
    errMsg = e?.message ?? 'sign-off failed';
  }
  revalidatePath('/holding/it2/modules/specs');
  if (errMsg) redirect(`/holding/it2/modules/specs?toast=${encodeURIComponent(`${docType}: ${errMsg}`)}`);
}

async function reauditAction(formData: FormData) {
  'use server';
  const docType = String(formData.get('doc_type') ?? '');
  // fn_module_reaudit (module_reaudit_signal_v1): flips queue to pending AND
  // writes governance.owner_action_signals kind='reaudit_requested' with
  // prev_spec/prev_gaps in payload (scope 3, modules-specs-redesign-v1).
  if (docType) await (getSupabaseAdmin() as any).rpc('fn_module_reaudit', { p_doc_type: docType, p_actor: 'PBS' });
  revalidatePath('/holding/it2/modules/specs');
}

export default async function SpecsPage({ searchParams }: { searchParams?: { toast?: string } }) {
  const { moduleDocs, briefs, statusMap, queueMap, briefStatusBySlug, truthMap, redFindings, blueFindings, amberFindings, signalMap, goalRefinedSlugs, workOrdersMap } = await fetchData();
  const toast = searchParams?.toast ?? null;

  // Assemble one serializable row per module for the client explorer.
  const modules: ModuleRow[] = moduleDocs.map((doc: any) => {
    const st = statusMap[doc.doc_type];
    const q = queueMap[doc.doc_type];
    const briefStatus = q?.brief_slug ? (briefStatusBySlug[q.brief_slug] ?? null) : null;
    const t = truthMap[doc.doc_type];
    const specPct = t?.spec_pct ?? q?.completion_estimate ?? null;
    const testedPct = t?.tested_pct ?? null;
    const frozen = isFrozen(t);
    const signedOff = !!st?.signed_off_at;
    const stage = pipelineState(q, briefStatus, frozen);
    const cta = nextAction(q, briefStatus, signedOff, frozen, doc.doc_type);
    const nRed = redFindings[doc.doc_type] ?? 0;
    const nBlue = blueFindings[doc.doc_type] ?? 0;
    const nAmber = amberFindings[doc.doc_type] ?? 0;
    // Post-audit delta: only meaningful when an audit ran AFTER the request.
    const sig = signalMap[doc.doc_type];
    const audited = q?.updated_at ?? null;
    const sigBefore = sig && audited && String(sig.created_at) < String(audited) ? sig : null;
    const prevSpec = sigBefore?.payload?.prev_spec ?? null;
    const prevGaps = sigBefore?.payload?.prev_gaps ?? null;
    const curGaps = Array.isArray(q?.gap_list) ? q.gap_list.length : 0;
    const unregistered = !q;
    return {
      docType: doc.doc_type,
      title: doc.title,
      version: doc.version ?? 0,
      docStatus: doc.status ?? 'draft',
      // Unregistered spec docs (no queue row) have no owner classification —
      // agent-class decision (law 736): park them under IT/Platform, backend
      // audience, until the registration law forces a real classification.
      department: q?.department ?? 'it_platform',
      audience: (q?.audience ?? (unregistered ? 'backend' : 'owner')) as ModuleRow['audience'],
      specPct,
      testedPct,
      testOk: t?.testing_ok ?? q?.testing_ok ?? 0,
      testTarget: t?.testing_target ?? q?.testing_target ?? null,
      frozen,
      signedOff,
      live: st?.is_live ?? false,
      nRed,
      nBlue,
      nAmber,
      gapList: Array.isArray(q?.gap_list) ? q.gap_list : [],
      stageDone: stage.done,
      stageActive: stage.active,
      stageAlert: stage.alert,
      completionEstimate: q?.completion_estimate ?? null,
      briefSlug: q?.brief_slug ?? null,
      briefStatus,
      // goal-editor-v1 A2c: "goal refined — brief rewrite queued" until the
      // rewrite lands (signal consumed by the next builder).
      goalRefined: q?.brief_slug ? goalRefinedSlugs.has(String(q.brief_slug)) : false,
      entryUrl: q?.entry_url ?? null,
      lastUpdated: doc.last_updated_at ? shortDate(doc.last_updated_at) : null,
      lastUpdatedIso: (q?.updated_at ?? doc.last_updated_at) ? String(q?.updated_at ?? doc.last_updated_at) : null,
      auditDate: audited ? shortDate(audited) : null,
      prevSpec: typeof prevSpec === 'number' ? prevSpec : null,
      gapsClosed: typeof prevGaps === 'number' ? Math.max(0, prevGaps - curGaps) : null,
      ctaLabel: cta.label,
      ctaHref: cta.href,
      ctaRpc: cta.rpc,
      ctaTone: cta.tone,
      workOrders: workOrdersMap[doc.doc_type] ?? [],
      // "needs you" = whose move is it: unconfirmed findings, a parked
      // question, or an unproven completed claim.
      needsYou: nRed > 0 || briefStatus === 'needs_input' || (stage.alert && !frozen),
      unregistered,
    };
  });

  return (
    <div style={{ maxWidth: 1080, padding: '28px 24px' }}>
      {/* A8: truth-gate refusals surface here, verbatim — never a silent failure */}
      {toast && (
        <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 6, background: '#B71C1C',
          color: '#FFFFFF', fontSize: 12, fontWeight: 600, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span>{toast}</span>
          <Link href="/holding/it2/modules/specs" style={{ color: '#FFFFFF', fontWeight: 700, textDecoration: 'none' }}>✕</Link>
        </div>
      )}
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1B1B1B', margin: 0 }}>Module Documentation</h1>
          <p style={{ fontSize: 12, color: '#5A5A5A', margin: '4px 0 0' }}>
            Spec docs for all modules · auditor every 24h · builder + checker hourly · pick a department, expand a row for detail
          </p>
          <p style={{ fontSize: 11, color: '#1B1B1B', margin: '6px 0 0', fontWeight: 600 }}>
            SPEC % = the agent&apos;s conformance estimate — NOT proof it works. TESTED % = evidence-counted good runs.
            FROZEN needs: completed + tested 100% (or your waiver) + zero open blocking findings.
          </p>
        </div>
        <Link href="/holding/it2/modules/intake" style={{
          fontSize: 12, fontWeight: 700, padding: '8px 18px', borderRadius: 4,
          background: '#1F3A2E', color: '#FFFFFF', textDecoration: 'none', letterSpacing: '0.05em',
        }}>+ New spec</Link>
      </div>

      {/* Department subtabs + audience toggle + compact rows (client) */}
      <SpecsExplorer modules={modules} signOffAction={signOffAction} reauditAction={reauditAction} />

      {/* Build briefs */}
      <section>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: '#1B1B1B', margin: '0 0 4px', letterSpacing: '0.04em' }}>
          BUILD BRIEFS ({briefs.length})
        </h2>
        <p style={{ fontSize: 11, color: '#5A5A5A', margin: '0 0 12px' }}>
          Briefs from + New spec and the module auditor · lifecycle: ready → research → in_progress → verifying → shipped · &quot;needs PBS&quot; = the loop has a question only you can answer
        </p>
        <div style={{ border: '1px solid #E6DFCC', borderRadius: 6, overflow: 'hidden' }}>
          {briefs.length === 0 ? (
            <div style={{ fontSize: 12, color: '#8A8A8A', padding: '20px 16px' }}>
              No briefs yet. Write your first spec with + New spec above.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#FAFAF7', borderBottom: '1px solid #E6DFCC' }}>
                  {['TITLE', 'STATUS', 'CREATED', 'LAST AGENT RUN', 'SHIPPED'].map(h => (
                    <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 700,
                      color: '#5A5A5A', fontSize: 11, letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {briefs.map((b: any, i: number) => {
                  const bs = BRIEF_STATUS[b.status] ?? { label: b.status ?? 'draft', bg: '#F4EFE2', color: '#5A5A5A' };
                  return (
                    <tr key={b.id} style={{ borderBottom: i < briefs.length - 1 ? '1px solid #E6DFCC' : 'none' }}>
                      <td style={{ padding: '10px 14px', color: '#1B1B1B', fontWeight: 500,
                        maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {/* ADR-224: brief rows were dead text — PBS could not reopen a brief
                            to remember what he had already filed. */}
                        <Link href={`/holding/it2/modules/briefs/${encodeURIComponent(b.slug)}`}
                          style={{ color: '#1B1B1B', textDecoration: 'none' }}>
                          {b.title ?? b.slug}
                        </Link>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px',
                          borderRadius: 99, background: bs.bg, color: bs.color }}>
                          {bs.label}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#5A5A5A' }}>
                        {b.created_at ? shortDate(b.created_at) : '—'}
                      </td>
                      {/* ADR-224: this column rendered shipped_at under a "LAST AGENT RUN"
                          header, so every row read "—" while agents were actively working.
                          Last agent run is last_updated_at; shipped gets its own column. */}
                      <td style={{ padding: '10px 14px', color: b.last_updated_at ? '#1B1B1B' : '#8A8A8A' }}>
                        {b.last_updated_at ? shortDate(b.last_updated_at) : '—'}
                      </td>
                      <td style={{ padding: '10px 14px', color: b.shipped_at ? '#2E7D32' : '#8A8A8A' }}>
                        {b.shipped_at ? shortDate(b.shipped_at) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
