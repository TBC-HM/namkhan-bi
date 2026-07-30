// lib/specs/mdIntake.ts
// MD Intake v1 (brief md-intake-v1): upload an owner MD → verbatim canon in
// dms.documents + repo docs/brief-sources/ → evaluate against platform law →
// derived build brief + module_completion_queue row. The system DERIVES; it
// never rewrites the source. Source overrides derivatives on conflict.
//
// Laws honored here:
// - VERBATIM CANON: source stored untouched (doc_subtype='brief_source',
//   external_id='brief-source-<file>'); re-upload with identical content is
//   idempotent; changed content bumps version on the SAME row (update-forward,
//   never a duplicate row — external_id guard).
// - TABLE-DRIVEN SURFACES: registration = one queue row + one brief row.
//   NO nav mutations, NO page scaffolding at intake time.
// - GATED: output status 'ready' or 'needs_input' — never intake→production.
// - OWNER QUESTION LAW (rule 594): evaluator asks only owner-class questions
//   (money, taste, risk, priority); technical gaps are decided + logged.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { callClaude, parseModelJson } from '@/lib/brain/llm';
import { AGENT_CONTEXT } from '@/lib/specs/agentContext';

// ── Types ────────────────────────────────────────────────────────────────────

export interface OwnerQuestion {
  question: string;
  options: { label: string; consequence: string }[];
  recommended: string;
}

export interface EvaluationResult {
  module_doc_type: string;
  display_name: string;
  entry_url: string | null;
  summary: string;
  distilled_brief_md: string;
  owner_questions: OwnerQuestion[];
  technical_decisions: string[];
  law_conflicts: string[];
}

export interface QueueRowLite {
  module_doc_type: string;
  display_name: string | null;
  priority: number | null;
  status: string | null;
  brief_slug: string | null;
  entry_url: string | null;
}

export interface MdIntakeResult {
  dry_run: boolean;
  source: {
    external_id: string;
    doc_id: string | null;          // null in dry-run when row doesn't exist yet
    action: 'created' | 'reused' | 'version_bumped' | 'would_create' | 'would_bump';
    version: number;
    repo_path: string;
    repo_pushed: boolean;
  };
  evaluation: EvaluationResult;
  brief: {
    slug: string;
    status: 'ready' | 'needs_input';
    priority: number;
    action: 'created' | 'exists' | 'would_create';
    matches_existing: boolean | null; // dry-run comparison vs existing brief
  };
  queue: {
    module_doc_type: string;
    action: 'created' | 'exists' | 'would_create';
    matches_existing: boolean | null;
  };
  notes: string[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function slugifyFile(name: string): string {
  return name.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
}

function toModuleSlug(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);
}

function toBriefSlug(moduleDocType: string): string {
  return `${moduleDocType.replace(/_/g, '-')}-v1`;
}

function checksum(s: string): string {
  // djb2 — cheap stable content fingerprint (not crypto; guards re-upload only)
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return `djb2:${h.toString(16)}:${s.length}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Evaluator ────────────────────────────────────────────────────────────────

const LAW_DIGEST = `
You evaluate an owner-authored module document for The Beyond Circle hospitality
platform (Next.js + Supabase, repo TBC-HM/namkhan-bi) and distill it into a
build brief. Platform laws you MUST apply:

1. TAXONOMY (ADR-185): Platform (Holding) → Tenant (property) → Module
   (department, sellable, one lead agent) → Capability (submenu unit) →
   Workflow → Agent/Loop. Never call capabilities "modules". The platform
   commerce engine is the MONETIZATION engine, never "revenue" (that is the
   hotel revenue module).
2. TENANT ISOLATION (ADR-184): any new surface embedding cross-table refs
   needs composite FK carrying property_id + embedded-reference validation
   trigger. Never WHERE-clause-only isolation.
3. POSTGREST BRIDGES (§0.5): public schema only; non-public data reaches the
   app via public.v_* views or public.fn_* SECURITY DEFINER bridges with
   service_role grants.
4. MODEL LOCK (ADR-169): Anthropic models only through Phase 2.
5. USALI 11th edition is the accounting standard. LAK = Namkhan ops currency,
   EUR = Donna, USD = group reporting.
6. TABLE-DRIVEN SURFACES: module registration = queue row + brief row only.
   No nav mutations, no page scaffolding at intake.
7. AUDIT FIRST: never plan an overwrite. If the document overlaps an existing
   module, the brief must EXTEND it (name the existing module + brief).
8. URL LAW: every page property-scoped /h/[property_id]/<dept>/<sub> or
   /holding/* for holding surfaces.
9. OWNER QUESTION LAW (rule 594): owner questions ONLY for money, taste/brand,
   risk appetite, business priority — plain hotel-owner language, 2-4 options
   each with its consequence, exactly one recommended. Technical choices
   (storage, schema shape, library, naming) you DECIDE and list under
   technical_decisions with a one-line reason. NEVER surface a technical
   question to the owner.

Respond with STRICT JSON only (no prose outside the JSON):
{
  "module_doc_type": "snake_case module key, e.g. spa_module",
  "display_name": "Human name",
  "entry_url": "/h/[property_id]/... or /holding/... or null if undecidable",
  "summary": "2-3 sentence summary of what the document asks for",
  "distilled_brief_md": "markdown body: ## PBS request (distilled) · ## Canon adaptations (laws applied, conflicts resolved) · ## v1 scope · ## Deferred · ## Flow (1-2-3) · ## Acceptance criteria (itemized, individually testable, numbered)",
  "owner_questions": [{"question":"...","options":[{"label":"...","consequence":"..."}],"recommended":"label of recommended option"}],
  "technical_decisions": ["decision — reason", "..."],
  "law_conflicts": ["conflict found in the source doc and how it was resolved", "..."]
}
owner_questions MUST be [] unless a genuine owner-class gap exists.`;

export async function evaluateSource(opts: {
  fileName: string;
  content: string;
  existingQueue: QueueRowLite[];
  existingBriefSlugs: string[];
}): Promise<EvaluationResult> {
  const queueLines = opts.existingQueue
    .map(q => `- ${q.module_doc_type} · "${q.display_name ?? ''}" · status=${q.status} · brief=${q.brief_slug ?? '—'} · entry=${q.entry_url ?? '—'}`)
    .join('\n');

  const user = `SOURCE FILE: ${opts.fileName}

EXISTING MODULES (governance.module_completion_queue — audit-first; if the doc
matches one of these, keep its module_doc_type and EXTEND, do not invent a new key):
${queueLines || '- (none)'}

EXISTING BRIEF SLUGS: ${opts.existingBriefSlugs.join(', ') || '(none)'}

OWNER DOCUMENT (verbatim canon — distill, never rewrite the source):
---
${opts.content.slice(0, 60_000)}
---`;

  const raw = await callClaude({ system: LAW_DIGEST, user, maxTokens: 4000, temperature: 0 });
  const parsed = parseModelJson<EvaluationResult>(raw);
  if (!parsed || !parsed.module_doc_type || !parsed.distilled_brief_md) {
    throw new Error('evaluator returned unparseable output');
  }
  return {
    module_doc_type: toModuleSlug(parsed.module_doc_type),
    display_name: parsed.display_name || opts.fileName,
    entry_url: parsed.entry_url ?? null,
    summary: parsed.summary ?? '',
    distilled_brief_md: parsed.distilled_brief_md,
    owner_questions: Array.isArray(parsed.owner_questions) ? parsed.owner_questions : [],
    technical_decisions: Array.isArray(parsed.technical_decisions) ? parsed.technical_decisions : [],
    law_conflicts: Array.isArray(parsed.law_conflicts) ? parsed.law_conflicts : [],
  };
}

// ── Brief assembly ───────────────────────────────────────────────────────────

export function buildBriefMd(opts: {
  evaluation: EvaluationResult;
  fileName: string;
  docId: string | null;
  sourceVersion: number;
  goalId: number;
}): string {
  const e = opts.evaluation;
  const qBlock = e.owner_questions.length
    ? `\n## OPEN OWNER QUESTIONS (rule 594 — answer in Decision Inbox before build)\n${e.owner_questions
        .map((q, i) => `${i + 1}. ${q.question}\n${q.options.map(o => `   - ${o.label} — ${o.consequence}`).join('\n')}\n   → Recommended: ${q.recommended}`)
        .join('\n')}\n`
    : '';
  const tBlock = e.technical_decisions.length
    ? `\n## Technical decisions (agent-class, decided + logged per rule 594)\n${e.technical_decisions.map(d => `- ${d}`).join('\n')}\n`
    : '';
  const cBlock = e.law_conflicts.length
    ? `\n## Law conflicts resolved\n${e.law_conflicts.map(c => `- ${c}`).join('\n')}\n`
    : '';

  return `§0 INTAKE AUDIT — auto-passed ${todayIso()} (md-intake evaluator v1): source persisted, goal linked (#${opts.goalId}), acceptance itemized in body.

# ${e.display_name} — derived from owner MD (md-intake)

## SOURCE DOCUMENTS (canon — source overrides this derivative on conflict)
- dms.documents doc_id ${opts.docId ?? '(assigned on live run)'} · external_id brief-source-${opts.fileName} · version ${opts.sourceVersion}
- repo: docs/brief-sources/${opts.fileName}
- Builders MUST read the source in full before building; this brief is the distillation, the source is the truth.

${e.distilled_brief_md}
${qBlock}${tBlock}${cBlock}
${AGENT_CONTEXT}
`;
}

// ── Pipeline ─────────────────────────────────────────────────────────────────

export async function runMdIntake(opts: {
  fileName: string;               // sanitized target name, e.g. spa_management_module.md
  content: string;                // markdown content (verbatim, or extract of docx/xlsx)
  goalId: number;
  dryRun: boolean;
  originalNote?: string | null;   // e.g. 'extracted from spa.docx (original in spec-attachments/…)'
}): Promise<MdIntakeResult> {
  const sb = getSupabaseAdmin();
  const fileName = slugifyFile(opts.fileName);
  const externalId = `brief-source-${fileName}`;
  const repoPath = `docs/brief-sources/${fileName}`;
  const notes: string[] = [];
  const sum = checksum(opts.content);

  // 1 · SOURCE — external_id guard (never a duplicate row)
  const { data: existingDoc, error: exErr } = await sb
    .schema('dms').from('documents')
    .select('doc_id, version, file_checksum, body_markdown')
    .eq('external_id', externalId)
    .maybeSingle();
  if (exErr) throw new Error(`dms lookup failed: ${exErr.message}`);

  let docId: string | null = existingDoc?.doc_id ?? null;
  let sourceVersion = existingDoc?.version ?? 1;
  let sourceAction: MdIntakeResult['source']['action'];
  let repoPushed = false;

  const contentChanged = existingDoc
    ? (existingDoc.file_checksum ?? checksum(existingDoc.body_markdown ?? '')) !== sum
    : false;

  if (!existingDoc) {
    sourceAction = opts.dryRun ? 'would_create' : 'created';
  } else if (contentChanged) {
    sourceAction = opts.dryRun ? 'would_bump' : 'version_bumped';
  } else {
    sourceAction = 'reused';
    notes.push('source unchanged — dms row reused (idempotent re-upload)');
  }

  if (!opts.dryRun) {
    if (!existingDoc) {
      const { data: ins, error: insErr } = await sb.schema('dms').from('documents').insert({
        doc_type: 'markdown',
        doc_subtype: 'brief_source',
        external_id: externalId,
        title: `${fileName} — owner source doc (md-intake upload)`,
        body_markdown: opts.content,
        status: 'draft',
        language: 'en',
        sensitivity: 'internal',
        source: `md-intake-upload-${todayIso().replace(/-/g, '')}`,
        project: 'tbc-platform',
        tags: ['brief-source', 'md-intake', 'holding-scope'],
        summary: `Verbatim owner-authored source document uploaded via Spec Builder MD intake. Repo copy: ${repoPath}${opts.originalNote ? ` · ${opts.originalNote}` : ''}`,
        file_checksum: sum,
        raw: opts.originalNote ? { original_note: opts.originalNote } : {},
      }).select('doc_id, version').single();
      if (insErr) throw new Error(`dms insert failed: ${insErr.message}`);
      docId = ins.doc_id;
      sourceVersion = ins.version ?? 1;
    } else if (contentChanged) {
      // Update-forward on the SAME row: bump version, keep external_id (canon law).
      const { data: upd, error: updErr } = await sb.schema('dms').from('documents').update({
        body_markdown: opts.content,
        version: sourceVersion + 1,
        file_checksum: sum,
        updated_at: new Date().toISOString(),
      }).eq('doc_id', existingDoc.doc_id).select('doc_id, version');
      if (updErr) throw new Error(`dms version bump failed: ${updErr.message}`);
      if (!upd || upd.length === 0) throw new Error('dms version bump no-oped (schema write guard) — source NOT updated');
      sourceVersion = sourceVersion + 1;
      notes.push(`source content changed — version bumped to v${sourceVersion} on the same row`);
    }

    // Repo copy via the sanctioned bridge (fire-and-forget; verify in v_push_ledger).
    if (sourceAction === 'created' || sourceAction === 'version_bumped') {
      const { error: pushErr } = await sb.rpc('fn_gh_push_file', {
        p_owner: 'TBC-HM', p_repo: 'namkhan-bi', p_branch: 'main',
        p_path: repoPath, p_content: opts.content,
        p_message: `docs(brief-sources): ${sourceAction === 'created' ? 'add' : 'update'} ${fileName} via md-intake (verbatim owner canon)`,
      });
      if (pushErr) notes.push(`repo push failed (${pushErr.message}) — dms row is canon; re-push manually`);
      else repoPushed = true;
    }
  }

  // 2 · EVALUATE against live module inventory + brief slugs
  const { data: queueRows } = await sb.schema('governance').from('module_completion_queue')
    .select('module_doc_type, display_name, priority, status, brief_slug, entry_url');
  const existingQueue: QueueRowLite[] = (queueRows ?? []) as QueueRowLite[];

  const { data: briefRows } = await sb.schema('documentation').from('build_briefs').select('slug');
  const existingBriefSlugs = (briefRows ?? []).map((b: { slug: string }) => b.slug);

  const evaluation = await evaluateSource({ fileName, content: opts.content, existingQueue, existingBriefSlugs });

  const moduleDocType = evaluation.module_doc_type;
  const existingQueueRow = existingQueue.find(q => q.module_doc_type === moduleDocType) ?? null;
  const briefSlug = existingQueueRow?.brief_slug ?? toBriefSlug(moduleDocType);
  const existingBrief = existingBriefSlugs.includes(briefSlug);

  // Priority: next free number below the reserved bands (50 refactor / 99 nav).
  const usedPriorities = existingQueue.map(q => q.priority ?? 0).filter(p => p > 0 && p < 50);
  const nextPriority = existingQueueRow?.priority ?? (usedPriorities.length ? Math.max(...usedPriorities) + 1 : 1);

  const briefStatus: 'ready' | 'needs_input' = evaluation.owner_questions.length ? 'needs_input' : 'ready';
  const briefMd = buildBriefMd({ evaluation, fileName, docId, sourceVersion, goalId: opts.goalId });

  // 3 · REGISTER (or report, in dry-run)
  let briefAction: MdIntakeResult['brief']['action'];
  let queueAction: MdIntakeResult['queue']['action'];

  if (opts.dryRun) {
    briefAction = existingBrief ? 'exists' : 'would_create';
    queueAction = existingQueueRow ? 'exists' : 'would_create';
    if (existingBrief) notes.push(`brief ${briefSlug} already exists — live run would NOT overwrite it (edit it in Briefs)`);
    if (existingQueueRow) notes.push(`queue row ${moduleDocType} already exists (priority ${existingQueueRow.priority}, status ${existingQueueRow.status}) — no duplicate would be created`);
  } else {
    if (existingBrief) {
      briefAction = 'exists';
      notes.push(`brief ${briefSlug} already exists — NOT overwritten (update-forward law); review it in Briefs`);
    } else {
      const { error: bErr } = await sb.schema('documentation').from('build_briefs').insert({
        slug: briefSlug,
        title: `${evaluation.display_name} — derived from owner MD (md-intake)`,
        content_md: briefMd,
        status: briefStatus,
        tags: ['spec', 'md-intake', moduleDocType],
        goal_id: opts.goalId,
        priority: nextPriority,
        open_question: evaluation.owner_questions.length ? evaluation.owner_questions : null,
        target_repo: 'TBC-HM/namkhan-bi',
        target_branch: 'main',
        last_updated_by: 'md-intake-v1',
      });
      if (bErr) throw new Error(`brief insert failed: ${bErr.message}`);
      briefAction = 'created';
    }

    if (existingQueueRow) {
      queueAction = 'exists';
    } else {
      const expected = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
      const { error: qErr } = await sb.schema('governance').from('module_completion_queue').insert({
        module_doc_type: moduleDocType,
        display_name: evaluation.display_name,
        priority: nextPriority,
        status: 'pending',
        brief_slug: briefSlug,
        entry_url: evaluation.entry_url,
        expected_delivery: expected,
        open_questions: evaluation.owner_questions.length
          ? evaluation.owner_questions.map(q => q.question).join(' · ')
          : null,
        notes: `registered by md-intake-v1 from ${repoPath} on ${todayIso()}`,
      });
      if (qErr) throw new Error(`queue insert failed: ${qErr.message}`);
      queueAction = 'created';
    }
  }

  return {
    dry_run: opts.dryRun,
    source: { external_id: externalId, doc_id: docId, action: sourceAction, version: sourceVersion, repo_path: repoPath, repo_pushed: repoPushed },
    evaluation,
    brief: {
      slug: briefSlug,
      status: briefStatus,
      priority: nextPriority,
      action: briefAction,
      matches_existing: opts.dryRun ? existingBrief : null,
    },
    queue: {
      module_doc_type: moduleDocType,
      action: queueAction,
      matches_existing: opts.dryRun ? !!existingQueueRow : null,
    },
    notes,
  };
}
