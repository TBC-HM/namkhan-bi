// app/holding/it/cockpit/specs/page.tsx
// Module Docs hub — lists module specs + build briefs.
// Uses public.v_documents_latest + public.v_build_briefs (bridge views over documentation schema).
// v2 2026-07-25: pipeline lifecycle strip per module (Audit → Spec → Repair → Check → Frozen)
// driven by public.v_module_completion_queue + brief statuses (standing pipeline, ADR-165/166).

import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const BADGE: Record<string, { bg: string; color: string }> = {
  bug_agent_module:    { bg: '#EDE7F6', color: '#4527A0' },
  compiler_module:     { bg: '#E8EAF6', color: '#283593' },
  gbp_module:          { bg: '#FCE4EC', color: '#880E4F' },
  inventory_module:    { bg: '#E8F5E9', color: '#1B5E20' },
  media_module:        { bg: '#E3F2FD', color: '#0D47A1' },
  newsletter_module:   { bg: '#FFF3E0', color: '#E65100' },
  proposals_module:    { bg: '#F3E5F5', color: '#6A1B9A' },
  sales_module:        { bg: '#E0F7FA', color: '#006064' },
  socials_module:      { bg: '#FFEBEE', color: '#B71C1C' },
  spec_builder_module: { bg: '#E0F2F1', color: '#004D40' },
  university_module:   { bg: '#F1F8E9', color: '#33691E' },
  youtube_module:      { bg: '#FFEBEE', color: '#C62828' },
};

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

// PBS 2026-07-27: TESTING bracket between Check and Frozen — a module only
// freezes after testing_target (default 50) evidence-counted successful runs.
const STAGES = ['Audit', 'Spec', 'Repair', 'Check', 'Testing', 'Frozen'];

// Compute (doneUpTo index, active label, alert) from queue row + its brief status.
function pipelineState(q: any, briefStatus: string | null): { done: number; active: string; alert: boolean } {
  if (!q || q.status === 'skipped') return { done: -1, active: 'not queued', alert: false };
  if (q.status === 'pending')   return { done: -1, active: 'queued for audit', alert: false };
  if (q.status === 'auditing')  return { done: 0,  active: 'audit running', alert: false };
  if (q.status === 'completed') return { done: 5,  active: 'FROZEN · finished', alert: false };
  const testing = `testing · ${q?.testing_ok ?? 0} of ${q?.testing_target ?? 50} good runs`;
  // spec_created / in_pipeline → refine from the brief
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

function PipelineStrip({ q, briefStatus }: { q: any; briefStatus: string | null }) {
  const st = pipelineState(q, briefStatus);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        {STAGES.map((label, i) => {
          const isDone = i <= st.done;
          const isNext = i === st.done + 1;
          return (
            <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div style={{ width: '100%', height: 3, borderRadius: 99,
                background: isDone ? '#2E7D32' : isNext ? (st.alert ? '#B71C1C' : '#B8A878') : '#F0EBE0' }} />
              <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
                color: isDone ? '#2E7D32' : isNext ? (st.alert ? '#B71C1C' : '#8A8A8A') : '#C9C2B2' }}>{label}</span>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 9.5, fontWeight: 600, color: st.alert ? '#B71C1C' : '#5A5A5A', marginTop: 2 }}>
        {st.active}{q?.completion_estimate != null ? ` · agent-audited: ${q.completion_estimate}% complete` : ''}
      </div>
    </div>
  );
}

function TypePill({ docType }: { docType: string }) {
  const b = BADGE[docType] ?? { bg: '#F4EFE2', color: '#5A5A5A' };
  const label = docType.replace(/_module$/, '').replace(/_/g, ' ');
  return (
    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
      padding: '2px 8px', borderRadius: 99, background: b.bg, color: b.color }}>
      {label}
    </span>
  );
}

async function fetchData() {
  const [{ data: moduleDocs }, { data: briefs }, { data: statuses }, { data: queue }] = await Promise.all([
    supabase
      .from('v_documents_latest')
      .select('id, doc_type, title, status, version, last_updated_at')
      .like('doc_type', '%_module')
      .order('doc_type'),
    (supabase as any)
      .from('v_build_briefs')
      .select('id, slug, title, status, tags, created_at, shipped_at')
      .order('created_at', { ascending: false })
      .limit(30),
    (supabase as any)
      .from('v_module_status')
      .select('doc_type, completion_pct, is_live, signed_off_at')
      .like('doc_type', '%_module'),
    (supabase as any)
      .from('v_module_completion_queue')
      .select('module_doc_type, display_name, status, completion_estimate, brief_slug, priority, updated_at, entry_url, testing_target, testing_ok'),
  ]);
  const statusMap: Record<string, any> = {};
  for (const s of (statuses ?? [])) statusMap[s.doc_type] = s;
  const queueMap: Record<string, any> = {};
  for (const qr of (queue ?? [])) queueMap[qr.module_doc_type] = qr;
  const briefStatusBySlug: Record<string, string> = {};
  for (const b of (briefs ?? [])) briefStatusBySlug[b.slug] = b.status;
  // PBS 2026-07-27: new modules must get a box the moment they are drafted.
  // Any queue entry without a spec doc yet renders as a synthesized card.
  const docs = [...(moduleDocs ?? [])];
  const haveDoc = new Set(docs.map((d: any) => d.doc_type));
  for (const qr of (queue ?? [])) {
    if (!haveDoc.has(qr.module_doc_type)) {
      docs.push({
        id: qr.module_doc_type, doc_type: qr.module_doc_type,
        title: `${qr.display_name ?? qr.module_doc_type.replace(/_module$/, '').replace(/_/g, ' ')} — spec doc pending (drafted module)`,
        status: 'draft', version: 0, last_updated_at: qr.updated_at ?? null,
      });
    }
  }
  docs.sort((a: any, b: any) => String(a.doc_type).localeCompare(String(b.doc_type)));
  return { moduleDocs: docs, briefs: briefs ?? [], statusMap, queueMap, briefStatusBySlug };
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ONE next action per card, derived from real pipeline state (PBS 2026-07-27:
// "no CTAs, which input they need, when is a module finished").
function nextAction(q: any, briefStatus: string | null, signedOff: boolean):
  { label: string; href?: string; rpc?: 'sign_off' | 'reaudit'; tone: 'red' | 'green' | 'gold' | 'grey' } {
  // PBS 2026-07-27: compact labels with symbols humans know — fit ONE row.
  if (signedOff || q?.status === 'completed') return { label: '🧊 Frozen', tone: 'grey' };
  if (briefStatus === 'needs_input' && q?.brief_slug)
    return { label: '❓ Answer', href: `/holding/it/cockpit/briefs/${q.brief_slug}`, tone: 'red' };
  if (briefStatus === 'ready' && q?.brief_slug)
    return { label: '⏳ Queued', href: `/holding/it/cockpit/briefs/${q.brief_slug}`, tone: 'gold' };
  if (briefStatus === 'shipped') {
    const ok = q?.testing_ok ?? 0; const target = q?.testing_target ?? 50;
    // TESTING bracket: freeze only after target successful runs.
    if (ok < target) return { label: `🧪 ${ok}/${target} runs`, tone: 'gold' };
    return { label: '🧊 Freeze', rpc: 'sign_off', tone: 'green' };
  }
  if (briefStatus && ['research', 'in_progress', 'verifying'].includes(briefStatus) && q?.brief_slug)
    return { label: '👁 Watch', href: `/holding/it/cockpit/briefs/${q.brief_slug}`, tone: 'gold' };
  // No estimate, or audit older than 3 days → the number on the card is not trustworthy
  const auditAgeDays = q?.updated_at ? (Date.now() - new Date(q.updated_at).getTime()) / 86400000 : Infinity;
  if (q?.completion_estimate == null || auditAgeDays > 3)
    return { label: '⟳ Re-audit', rpc: 'reaudit', tone: 'gold' };
  return { label: '⏲ auto 6h', tone: 'grey' };
}

async function signOffAction(formData: FormData) {
  'use server';
  const docType = String(formData.get('doc_type') ?? '');
  if (docType) await (supabase as any).rpc('fn_module_sign_off', { p_doc_type: docType, p_actor: 'PBS' });
  // PBS 2026-07-27: "i press and visibly nothing happens" — the action worked
  // but the page never re-rendered. Revalidate so the card flips immediately.
  revalidatePath('/holding/it/cockpit/specs');
}

async function reauditAction(formData: FormData) {
  'use server';
  const docType = String(formData.get('doc_type') ?? '');
  if (docType) await (supabase as any).rpc('fn_module_reaudit', { p_doc_type: docType, p_actor: 'PBS' });
  revalidatePath('/holding/it/cockpit/specs');
}

const CTA_TONE: Record<string, { bg: string; color: string }> = {
  red:   { bg: '#B71C1C', color: '#FFFFFF' },
  green: { bg: '#1F3A2E', color: '#FFFFFF' },
  gold:  { bg: '#B8A878', color: '#1B1B1B' },
  grey:  { bg: '#F0EBE0', color: '#5A5A5A' },
};

export default async function SpecsPage() {
  const { moduleDocs, briefs, statusMap, queueMap, briefStatusBySlug } = await fetchData();

  return (
    <div style={{ maxWidth: 960, padding: '28px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1B1B1B', margin: 0 }}>Module Documentation</h1>
          <p style={{ fontSize: 12, color: '#5A5A5A', margin: '4px 0 0' }}>
            Spec docs for all modules · auditor every 6h · builder + checker hourly · each card shows ONE next action
          </p>
          <p style={{ fontSize: 11, color: '#1B1B1B', margin: '6px 0 0', fontWeight: 600 }}>
            FINISHED = audit done → spec confirmed → all briefs shipped (commit) → re-audit clean → your sign-off = FROZEN.
            The % is the agent&apos;s last audit estimate — it only moves when a re-audit runs after repairs ship.
          </p>
        </div>
        <Link href="/holding/it/cockpit/specs/new" style={{
          fontSize: 12, fontWeight: 700, padding: '8px 18px', borderRadius: 4,
          background: '#1F3A2E', color: '#FFFFFF', textDecoration: 'none', letterSpacing: '0.05em',
        }}>+ New spec</Link>
      </div>

      {/* Module spec docs */}
      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: '#1B1B1B', margin: '0 0 12px', letterSpacing: '0.04em' }}>
          MODULE SPECS ({moduleDocs.length})
        </h2>
        {moduleDocs.length === 0 ? (
          <div style={{ fontSize: 12, color: '#8A8A8A', padding: '20px 0' }}>
            Loading module specs — if this persists, check v_documents_latest.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
            {moduleDocs.map((doc: any) => {
              const st = statusMap[doc.doc_type];
              const q = queueMap[doc.doc_type];
              const briefStatus = q?.brief_slug ? (briefStatusBySlug[q.brief_slug] ?? null) : null;
              // ONE number: the agent-audited estimate. The old module_status.completion_pct
              // was a stale manual value shown next to it — that dual display is what made
              // the page meaningless (PBS 2026-07-27). No estimate = say so, don't show 0%.
              const pct = q?.completion_estimate ?? null;
              const auditDate = q?.updated_at ? shortDate(q.updated_at) : null;
              const live = st?.is_live ?? false;
              const signedOff = !!st?.signed_off_at;
              const cta = nextAction(q, briefStatus, signedOff);
              const tone = CTA_TONE[cta.tone];
              return (
                <div key={doc.doc_type} style={{
                  background: '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 6,
                  padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <TypePill docType={doc.doc_type} />
                    <span style={{ fontSize: 10, fontWeight: 700,
                      color: signedOff ? '#2E7D32' : doc.status === 'published' ? '#2E7D32' : '#B8A878' }}>
                      v{doc.version} · {signedOff ? 'signed off' : doc.status}
                    </span>
                  </div>
                  {/* % progress bar — the agent-audited estimate with its audit date, or an honest "no audit" */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ flex: 1, height: 4, background: '#F0EBE0', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct ?? 0}%`, borderRadius: 99,
                        background: (pct ?? 0) >= 80 ? '#2E7D32' : (pct ?? 0) >= 50 ? '#F57F17' : '#D32F2F' }} />
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: pct == null ? '#B71C1C' : '#5A5A5A' }}>
                      {pct == null ? 'no audit yet' : `${pct}%`}
                    </span>
                    {live && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px',
                      borderRadius: 99, background: '#E8F5E9', color: '#2E7D32' }}>live</span>}
                  </div>
                  {auditDate && pct != null && (
                    <div style={{ fontSize: 9, color: '#8A8A8A', marginTop: -4 }}>audited {auditDate}</div>
                  )}
                  {/* Pipeline lifecycle strip */}
                  <PipelineStrip q={q} briefStatus={briefStatus} />
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1B1B1B', lineHeight: 1.4 }}>{doc.title}</div>
                  {/* ONE next action per card (CTA) + spec link */}
                  <div style={{ fontSize: 11, color: '#8A8A8A', marginTop: 'auto', display: 'flex',
                    justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                    <span>{doc.last_updated_at ? shortDate(doc.last_updated_at) : '—'}</span>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {cta.href ? (
                        <Link href={cta.href} style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px',
                          borderRadius: 3, background: tone.bg, color: tone.color, textDecoration: 'none' }}>
                          {cta.label}
                        </Link>
                      ) : cta.rpc ? (
                        <form action={cta.rpc === 'sign_off' ? signOffAction : reauditAction} style={{ margin: 0 }}>
                          <input type="hidden" name="doc_type" value={doc.doc_type} />
                          <button type="submit" style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px',
                            borderRadius: 3, background: tone.bg, color: tone.color, border: 'none', cursor: 'pointer' }}>
                            {cta.label}
                          </button>
                        </form>
                      ) : (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px',
                          borderRadius: 3, background: tone.bg, color: tone.color }}>{cta.label}</span>
                      )}
                      {/* PBS 2026-07-27: "when a module is finished put a link
                          in the module container" — the module's front door,
                          shown whenever a UI exists (governance queue entry_url). */}
                      {q?.entry_url && (
                        <Link href={q.entry_url} title="Open the module's live page" style={{ fontSize: 10, fontWeight: 700, padding: '4px 8px',
                          borderRadius: 3, background: '#1F3A2E', color: '#FFFFFF', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                          ↗ Open
                        </Link>
                      )}
                      {/* PBS 2026-07-27: refine-goal restored + compact symbol row */}
                      {q?.brief_slug && (
                        <Link href={`/holding/it/cockpit/briefs/${q.brief_slug}`} title="Refine the goal / read the brief"
                          style={{ fontSize: 10, fontWeight: 700, padding: '4px 8px', borderRadius: 3,
                            border: '1px solid #E6DFCC', color: '#1B1B1B', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                          ✎ Goal
                        </Link>
                      )}
                      <Link href={`/holding/it/module/${encodeURIComponent(doc.doc_type)}`} title="Read the spec document"
                        style={{ fontSize: 10, fontWeight: 700, padding: '4px 8px', borderRadius: 3,
                          border: '1px solid #E6DFCC', color: '#1B1B1B', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                        📄 Spec
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Build briefs */}
      <section>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: '#1B1B1B', margin: '0 0 4px', letterSpacing: '0.04em' }}>
          BUILD BRIEFS ({briefs.length})
        </h2>
        <p style={{ fontSize: 11, color: '#5A5A5A', margin: '0 0 12px' }}>
          Briefs from + New spec and the module auditor · lifecycle: ready → research → in_progress → verifying → shipped · "needs PBS" = the loop has a question only you can answer
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
                  {['TITLE', 'STATUS', 'CREATED', 'LAST AGENT RUN'].map(h => (
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
                        {b.title ?? b.slug}
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
