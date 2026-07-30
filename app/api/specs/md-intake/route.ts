// app/api/specs/md-intake/route.ts
// md-intake-v1 (brief md-intake-v1, 2026-07-30): Upload an owner MD instead of
// filling the 8-section Spec Builder form.
//
// Flow (deterministic — NO LLM call in v1):
//   1. VERBATIM CANON — the uploaded file is stored UNTOUCHED in dms.documents
//      (doc_type='markdown', doc_subtype='brief_source',
//      external_id='brief-source-<filename>', source='owner-upload') and
//      best-effort mirrored to repo docs/brief-sources/ via the sanctioned
//      fn_gh_push_file bridge (ADR-166/167). The system DERIVES; it never
//      rewrites the source. Source overrides derivatives on conflict.
//   2. EVALUATE — a stored deterministic checklist compares the MD against
//      platform law (taxonomy, tenant isolation ADR-184, PostgREST bridge §0.5,
//      model lock ADR-169, USALI, queue-priority law lowest-first, audit-first
//      COMPLETION QUEUE LAW). Technical gaps → evaluator decides and logs.
//      Owner-class gaps (direction, money, approvals, taste) → open_question.
//   3. REGISTER — row inserts only (no DDL): documentation.build_briefs
//      (status 'ready', or 'needs_input' when owner questions exist, with a
//      MANDATORY "SOURCE DOCUMENTS" section) + governance.module_completion_queue.
//      TABLE-DRIVEN SURFACES ONLY: the queue row alone surfaces the module in
//      IT2 Status / Work Queue / Briefs / Action Center. No nav mutations.
//
// dry_run=1 runs the full evaluation + dedup and writes NOTHING (acceptance
// test: re-run on an already-persisted source; derived rows must match, no
// duplicates — external_id / slug / module_doc_type guards).

import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ── types ────────────────────────────────────────────────────────────────────

type CheckResult = 'pass' | 'note' | 'question';
interface Check { id: string; law: string; result: CheckResult; detail: string }
interface OwnerQuestion { q: string; class: 'owner'; raised_by: string; at: string }

const EVALUATOR = 'md-intake-evaluator-v1';
const ACCEPTED_EXT = ['.md', '.markdown', '.txt', '.sql'];

// ── helpers ──────────────────────────────────────────────────────────────────

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.\-]+/g, '_');
}

function deriveDisplayName(md: string, fileName: string): { name: string; from: 'h1' | 'filename' } {
  const h1 = md.split('\n').map(l => l.trim()).find(l => /^#\s+\S/.test(l));
  if (h1) return { name: h1.replace(/^#\s+/, '').replace(/[#*`]/g, '').trim().slice(0, 120), from: 'h1' };
  const base = fileName.replace(/\.(md|markdown|txt|sql)$/i, '').replace(/[_\-]+/g, ' ').trim();
  return { name: base.replace(/\b\w/g, c => c.toUpperCase()), from: 'filename' };
}

function toModuleDocType(displayName: string): string {
  return displayName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);
}

function toSlug(displayName: string): string {
  return displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

function outline(md: string): string {
  const heads = md.split('\n').filter(l => /^#{1,3}\s+\S/.test(l.trim())).slice(0, 30);
  const firstPara = md.split(/\n\s*\n/).map(p => p.trim()).find(p => p && !p.startsWith('#'));
  const paraBlock = firstPara ? `\n**Opening paragraph (verbatim excerpt):**\n> ${firstPara.split('\n').join('\n> ').slice(0, 600)}\n` : '';
  return (heads.length ? heads.map(h => `- \`${h.trim().slice(0, 110)}\``).join('\n') : '- (no headings found in source)') + '\n' + paraBlock;
}

function proposeEntryUrl(md: string): string | null {
  const m = md.match(/(^|[\s`("'])(\/(?:h\/\d+|holding|marketing|operations|sales|revenue|finance|frontoffice|guest|university)\/[\w\-\/\[\]]*)/);
  return m ? m[2] : null;
}

// Audit-first fuzzy identity: "Spa Management Module" must find the existing
// spa_module queue row, "Central AI Chat Architecture" → central_chat, etc.
// Deterministic token-subset match after dropping filler words — existing
// registrations are REPORTED and kept; never overwritten, never duplicated.
const NAME_STOPWORDS = new Set(['module', 'engine', 'architecture', 'management', 'spec', 'specification', 'platform', 'system', 'model', 'extract', 'schema', 'brief', 'the', 'and', 'of', 'a', 'an', 'v1', 'v2']);
function nameTokens(s: string): Set<string> {
  return new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter(t => t && !NAME_STOPWORDS.has(t)));
}
function tokensMatch(a: Set<string>, b: Set<string>): boolean {
  if (!a.size || !b.size) return false;
  const inter = [...a].filter(t => b.has(t));
  return inter.length === a.size || inter.length === b.size; // one is a subset of the other
}

// ── deterministic evaluation checklist ───────────────────────────────────────

function runChecklist(md: string, opts: {
  fileName: string; externalId: string; sha256: string;
  displayName: string; nameFrom: string; moduleDocType: string; briefSlug: string;
  sourceExists: boolean; queueRowExists: boolean; briefExists: boolean;
  matchedQueue?: string | null;
  proposedPriority: number; entryUrl: string | null;
}): { checks: Check[]; decisions: string[]; questions: OwnerQuestion[] } {
  const checks: Check[] = [];
  const decisions: string[] = [];
  const questions: OwnerQuestion[] = [];
  const now = new Date().toISOString();
  const lower = md.toLowerCase();

  // 1 · Verbatim canon
  checks.push({
    id: 'verbatim-canon', law: 'VERBATIM CANON (md-intake law 1)', result: 'pass',
    detail: `Source stored untouched as ${opts.externalId} · sha256 ${opts.sha256.slice(0, 16)}… · derivatives never rewrite it; source overrides on conflict.`,
  });

  // 2 · Duplicate-source guard
  checks.push({
    id: 'source-dedup', law: 'external_id guard (no duplicate rows)',
    result: opts.sourceExists ? 'note' : 'pass',
    detail: opts.sourceExists
      ? `A dms.documents row with external_id ${opts.externalId} already exists — reused, NOT re-inserted.`
      : 'No existing source row — new insert.',
  });

  // 3 · Module identity / taxonomy
  checks.push({
    id: 'taxonomy', law: 'Module taxonomy (ADR-185)', result: 'note',
    detail: `Derived display_name "${opts.displayName}" from ${opts.nameFrom}; module_doc_type=${opts.moduleDocType}; brief slug=${opts.briefSlug}. Technical derivation — logged, not escalated.`,
  });
  decisions.push(`Module identity derived from ${opts.nameFrom} ("${opts.displayName}" → ${opts.moduleDocType}). Rename via queue row display_name if PBS prefers another name.`);

  // 4 · Audit-first (COMPLETION QUEUE LAW — never overwrite, only extend)
  checks.push({
    id: 'audit-first', law: 'COMPLETION QUEUE LAW (audit first, never overwrite)',
    result: opts.queueRowExists || opts.briefExists ? 'note' : 'pass',
    detail: opts.queueRowExists || opts.briefExists
      ? `Existing registration found (${[opts.queueRowExists ? `queue row ${opts.matchedQueue ?? opts.moduleDocType}` : null, opts.briefExists ? 'existing brief' : null].filter(Boolean).join(' + ')}) — existing rows are kept untouched; no duplicate insert.`
      : 'No existing queue row / brief for this module — fresh registration.',
  });

  // 5 · Tenant isolation (ADR-184)
  const mentionsTenancy = /property_id|tenant|260955|1000001|multi-propert/i.test(md);
  checks.push({
    id: 'tenant-isolation', law: 'Tenant isolation (ADR-184)',
    result: 'note',
    detail: mentionsTenancy
      ? 'Source mentions tenancy/property scoping — builder must honor it: every tenant query scoped by property_id (Namkhan=260955, Donna=1000001).'
      : 'Source does not state tenant scoping — evaluator decision: builder scopes every tenant query by property_id (Namkhan=260955, Donna=1000001); holding surfaces stay synthetic.',
  });
  if (!mentionsTenancy) decisions.push('Tenant isolation not addressed in source → default law applied (property_id scoping, ADR-184). Technical — decided, not escalated.');

  // 6 · PostgREST bridge law §0.5
  const nonPublicSchemas = ['finance.', 'pms.', 'dms.', 'governance.', 'revenue.', 'cockpit.', 'ops.', 'hr.', 'fb.', 'sales.', 'marketing.', 'documentation.', 'inv.', 'procurement.'];
  const schemaHits = nonPublicSchemas.filter(s => lower.includes(s));
  checks.push({
    id: 'postgrest-bridge', law: 'PostgREST bridge law (claude_md §0.5)',
    result: schemaHits.length ? 'note' : 'pass',
    detail: schemaHits.length
      ? `Source references non-public schemas (${schemaHits.map(s => s.slice(0, -1)).join(', ')}) — app-code reads must go through public.v_* bridge views / fn_* RPCs; symptom of violation: page renders $0 while SQL returns rows.`
      : 'No non-public schema references detected — standard public-schema reads.',
  });
  if (schemaHits.length) decisions.push(`Non-public schema reads (${schemaHits.map(s => s.slice(0, -1)).join(', ')}) must be bridged via public.v_* — builder proposes the views as SQL. Technical — decided, not escalated.`);

  // 7 · Model lock (ADR-169)
  const mentionsModels = /\b(gpt-?[0-9]|claude|gemini|llama|mistral|openai|anthropic|vertex|llm)\b/i.test(md);
  checks.push({
    id: 'model-lock', law: 'Model lock (ADR-169)',
    result: mentionsModels ? 'note' : 'pass',
    detail: mentionsModels
      ? 'Source mentions AI models — all model usage must follow the platform model lock; the builder may not introduce new model choices or spend at build time.'
      : 'No model usage stated — nothing to lock.',
  });

  // 8 · USALI
  const mentionsFinance = /\b(usali|p&l|profit|revenue|gl\b|ledger|adr\b|revpar|goppar|finance|accounting)\b/i.test(md);
  checks.push({
    id: 'usali', law: 'USALI 11th edition (accounting standard)',
    result: mentionsFinance ? 'note' : 'pass',
    detail: mentionsFinance
      ? 'Source touches financial/KPI figures — all mappings follow USALI 11th edition; LAK = Namkhan ops base, EUR = Donna ops base, USD = group reporting.'
      : 'No financial figures detected — USALI not in play.',
  });

  // 9 · Queue priority (lowest number = FRONT of queue, picked first)
  checks.push({
    id: 'queue-priority', law: 'QUEUE PRIORITY LAW (lowest number first)', result: 'note',
    detail: `Proposed priority ${opts.proposedPriority} = next free low number among active briefs. PBS reorders on the queue page (fn_set_work_priority) — the queue page is the single truth of pick order.`,
  });

  // 10 · Entry URL proposal
  checks.push({
    id: 'entry-url', law: 'Universal tenant URL shape (/h/[property_id]/* or /holding/*)',
    result: 'note',
    detail: opts.entryUrl
      ? `Entry URL proposal extracted from source: ${opts.entryUrl}`
      : 'No path found in source — entry_url left NULL; builder proposes it in the build PR. Technical — decided, not escalated.',
  });
  if (!opts.entryUrl) decisions.push('No entry URL in source → entry_url NULL on the queue row; builder proposes a law-conform path in the PR.');

  // 11 · Owner-class questions (OWNER QUESTION LAW: direction, money, approvals, taste ONLY)
  const lines = md.split('\n');
  const askMarkers = /\b(tbd|to be decided|open question|decision needed|pbs to decide|needs? (pbs|owner) (decision|approval|sign[- ]?off))\b/i;
  const moneyMarkers = /\b(budget|pricing|price|subscription|license|licence|paid plan|per month|per year|€|\$|usd|eur)\b/i;
  const credentialMarkers = /\b(api key|credential|oauth|account grant|access grant|billing account)\b/i;
  const seen = new Set<string>();
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.length < 8) continue;
    const isAsk = askMarkers.test(line);
    const isMoneyAsk = moneyMarkers.test(line) && /\b(approve|decide|choose|option|confirm|sign[- ]?off)\b/i.test(line);
    const isCredAsk = credentialMarkers.test(line) && /\b(need|require|grant|provide|create)\b/i.test(line);
    if ((isAsk || isMoneyAsk || isCredAsk) && !seen.has(line)) {
      seen.add(line);
      const cls = isMoneyAsk ? 'money' : isCredAsk ? 'credentials' : 'direction';
      questions.push({ q: `[${cls}] ${line.slice(0, 300)}`, class: 'owner', raised_by: EVALUATOR, at: now });
      if (questions.length >= 8) break;
    }
  }
  checks.push({
    id: 'owner-questions', law: 'OWNER QUESTION LAW (owner-class only; technical gaps decided + logged)',
    result: questions.length ? 'question' : 'pass',
    detail: questions.length
      ? `${questions.length} owner-class question(s) extracted from the source (money / credentials / direction markers). Written to build_briefs.open_question; brief status = needs_input.`
      : 'No owner-class gaps detected — technical gaps were decided and logged by the evaluator; brief status = ready.',
  });

  // 12 · Gate
  checks.push({
    id: 'gate', law: 'GATED (never intake→production)',
    result: 'pass',
    detail: 'Registration only creates rows. Build ships via the normal pipeline (branch → PR → PBS merge gate).',
  });

  return { checks, decisions, questions };
}

// ── distilled brief renderer ─────────────────────────────────────────────────

function renderBrief(p: {
  displayName: string; briefSlug: string; externalId: string; docId: string | null;
  sha256: string; fileName: string; repoPath: string; repoPushed: boolean;
  md: string; checks: Check[]; decisions: string[]; questions: OwnerQuestion[];
  moduleDocType: string; proposedPriority: number; entryUrl: string | null; expectedDelivery: string;
}): string {
  const today = new Date().toISOString().slice(0, 10);
  const checkRows = p.checks.map(c => `| ${c.id} | ${c.law} | ${c.result.toUpperCase()} | ${c.detail.replace(/\|/g, '/')} |`).join('\n');
  return `§0 INTAKE AUDIT — passed ${today} (${EVALUATOR}): source persisted verbatim (dms ${p.externalId}), goal linked, deterministic checklist in body; §-structure waived per source-doc-override law.

# ${p.displayName} — auto-distilled brief (md-intake v1)

## SOURCE DOCUMENTS (canonical — OVERRIDES this brief on any conflict)
- dms.documents · external_id \`${p.externalId}\`${p.docId ? ` · doc_id \`${p.docId}\`` : ''} · sha256 \`${p.sha256}\` · source owner-upload
- Repo mirror: \`${p.repoPath}\`${p.repoPushed ? ' (pushed via fn_gh_push_file bridge)' : ' (push pending/failed — the dms row is canonical)'}
- Builders MUST read the source in full before building:
  \`SELECT body_markdown FROM dms.documents WHERE external_id='${p.externalId}';\`
- The source is stored VERBATIM. This brief is a derivative; never edit the source to match it.

## Distilled outline (derived — not canon)
${outline(p.md)}

## Evaluation checklist (deterministic · ${EVALUATOR})
| check | law | result | detail |
|---|---|---|---|
${checkRows}

## Technical decisions logged by the evaluator (OWNER QUESTION LAW — decided, not escalated)
${p.decisions.length ? p.decisions.map((d, i) => `${i + 1}. ${d}`).join('\n') : '(none — source was complete on technical points)'}

## Open questions (owner-class)
${p.questions.length ? p.questions.map((q, i) => `${i + 1}. ${q.q}`).join('\n') : '(none)'}

## Registration
- module_doc_type: \`${p.moduleDocType}\` · display_name: ${p.displayName}
- Proposed priority: ${p.proposedPriority} (next free LOW number — lowest picked first; PBS reorders on the queue page)
- entry_url proposal: ${p.entryUrl ?? '(none — builder proposes in PR)'} · expected_delivery: ${p.expectedDelivery}
- Surfaces: table-driven only (queue row + this brief). No nav mutations at intake.
- Gate: normal pipeline → branch → PR → PBS merge. Never intake→production.
`;
}

// ── route ────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  let fd: FormData;
  try { fd = await req.formData(); } catch { return NextResponse.json({ ok: false, error: 'invalid_form_data' }, { status: 400 }); }

  const file = fd.get('file');
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: 'no_file' }, { status: 400 });
  if (file.size < 10) return NextResponse.json({ ok: false, error: 'empty_file' }, { status: 400 });
  if (file.size > 5_000_000) return NextResponse.json({ ok: false, error: 'file_too_large_max_5mb' }, { status: 400 });

  const rawName = file.name || 'upload.md';
  const ext = rawName.slice(rawName.lastIndexOf('.')).toLowerCase();
  if (!ACCEPTED_EXT.includes(ext)) {
    return NextResponse.json({ ok: false, error: `unsupported_extension — v1 accepts ${ACCEPTED_EXT.join(' ')} (docx/xlsx extraction is a later iteration)` }, { status: 400 });
  }

  const dryRun = String(fd.get('dry_run') ?? '') === '1';
  const goalIdRaw = fd.get('goal_id');
  const goalId = Number(goalIdRaw);
  if (!goalIdRaw || !Number.isInteger(goalId) || goalId <= 0) {
    return NextResponse.json({ ok: false, error: 'goal_id required — every brief must link a governance goal (ADR-165)' }, { status: 400 });
  }

  const md = await file.text(); // verbatim — never transformed
  const sha256 = createHash('sha256').update(md).digest('hex');
  const fileName = sanitizeFileName(rawName);
  const externalId = `brief-source-${fileName}`;
  const repoPath = `docs/brief-sources/${fileName}`;

  const sb = getSupabaseAdmin();

  try {
    // Goal must exist (ADR-165 — orphan briefs rejected at intake).
    const { data: goal, error: goalErr } = await (sb as any)
      .from('v_goals').select('goal_id, title, slug').eq('goal_id', goalId).maybeSingle();
    if (goalErr) return NextResponse.json({ ok: false, error: goalErr.message }, { status: 500 });
    if (!goal) return NextResponse.json({ ok: false, error: `goal_id ${goalId} not found in governance goals` }, { status: 400 });

    // ── Identity derivation ──────────────────────────────────────────────
    const { name: displayName, from: nameFrom } = deriveDisplayName(md, rawName);
    const moduleDocType = toModuleDocType(displayName);
    const briefSlug = `${toSlug(displayName)}-v1`;
    const entryUrl = proposeEntryUrl(md);
    const expectedDelivery = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10); // queue cadence: +7 days

    // ── Audit-first reads (existing rows are never overwritten) ──────────
    const { data: existingSource, error: srcErr } = await (sb as any)
      .schema('dms').from('documents')
      .select('doc_id, external_id, body_markdown, created_at')
      .eq('external_id', externalId).eq('doc_subtype', 'brief_source')
      .order('created_at', { ascending: true }).limit(1).maybeSingle();
    if (srcErr) return NextResponse.json({ ok: false, error: `dms read failed: ${srcErr.message}` }, { status: 500 });

    const { data: queueRows, error: qErr } = await (sb as any)
      .from('v_module_completion_queue')
      .select('module_doc_type, display_name, priority, status, brief_slug, entry_url');
    if (qErr) return NextResponse.json({ ok: false, error: `queue read failed: ${qErr.message}` }, { status: 500 });
    // Exact match first, then deterministic token-subset fuzzy match
    // ("Spa Management Module" → existing spa_module row).
    const docTokens = nameTokens(displayName);
    const existingQueueRow = (queueRows ?? []).find((r: any) => r.module_doc_type === moduleDocType || r.brief_slug === briefSlug)
      ?? (queueRows ?? []).find((r: any) =>
        tokensMatch(docTokens, nameTokens(String(r.module_doc_type ?? ''))) ||
        tokensMatch(docTokens, nameTokens(String(r.display_name ?? ''))))
      ?? null;

    // Existing brief: derived slug OR the matched queue row's brief_slug.
    const briefSlugCandidates = [briefSlug, existingQueueRow?.brief_slug].filter(Boolean) as string[];
    const { data: briefHits, error: briefErr } = await (sb as any)
      .schema('documentation').from('build_briefs')
      .select('slug, status, priority, title').in('slug', briefSlugCandidates);
    if (briefErr) return NextResponse.json({ ok: false, error: `brief read failed: ${briefErr.message}` }, { status: 500 });
    const existingBrief = (briefHits ?? []).find((b: any) => b.slug === briefSlug) ?? (briefHits ?? [])[0] ?? null;

    // Proposed priority = next free LOW number among active briefs (lowest picked first).
    const { data: activeBriefs, error: pErr } = await (sb as any)
      .schema('documentation').from('build_briefs')
      .select('priority, status').not('status', 'in', '(shipped,archived)');
    if (pErr) return NextResponse.json({ ok: false, error: `priority read failed: ${pErr.message}` }, { status: 500 });
    const used = new Set<number>((activeBriefs ?? []).map((b: any) => Number(b.priority)));
    let proposedPriority = 1;
    while (used.has(proposedPriority)) proposedPriority++;

    // ── Evaluate (deterministic checklist) ───────────────────────────────
    const { checks, decisions, questions } = runChecklist(md, {
      fileName, externalId, sha256, displayName, nameFrom, moduleDocType, briefSlug,
      sourceExists: !!existingSource, queueRowExists: !!existingQueueRow, briefExists: !!existingBrief,
      matchedQueue: existingQueueRow?.module_doc_type ?? null,
      proposedPriority, entryUrl,
    });
    const briefStatus = questions.length ? 'needs_input' : 'ready';

    // ── Persist source (verbatim) — skipped on dry-run / duplicate ───────
    let docId: string | null = existingSource?.doc_id ?? null;
    let sourceMatchesExisting: boolean | null = null;
    if (existingSource) {
      sourceMatchesExisting = existingSource.body_markdown === md;
    }
    if (!dryRun && !existingSource) {
      const { data: ins, error: insErr } = await (sb as any).schema('dms').from('documents').insert({
        doc_type: 'markdown',
        doc_subtype: 'brief_source',
        external_id: externalId,
        source: 'owner-upload',
        title: `Brief source · ${displayName}`,
        body_markdown: md,               // VERBATIM — untouched
        file_name: rawName,
        file_checksum: sha256,
        file_size_bytes: file.size,
        mime: 'text/markdown',
        status: 'active',
        sensitivity: 'internal',
        brain_sensitivity: 'management',
        extraction_status: 'extracted',
        tags: ['brief-source', 'md-intake', moduleDocType],
        raw: { uploaded_via: 'spec-builder-upload-md', evaluator: EVALUATOR, goal_id: goalId },
      }).select('doc_id').single();
      if (insErr) return NextResponse.json({ ok: false, error: `dms insert failed: ${insErr.message}` }, { status: 500 });
      docId = ins?.doc_id ?? null;
    }

    // ── Repo mirror via sanctioned gh bridge (best-effort, non-fatal) ────
    let repoPushed = false;
    let repoPushError: string | null = null;
    if (!dryRun && !existingSource) {
      const { error: ghErr } = await (sb as any).rpc('fn_gh_push_file', {
        p_owner: 'TBC-HM', p_repo: 'namkhan-bi', p_branch: 'main',
        p_path: repoPath, p_content: md,
        p_message: `md-intake: persist brief source ${fileName} (verbatim, dms ${externalId})`,
      });
      if (ghErr) repoPushError = ghErr.message; else repoPushed = true;
    }

    // ── Render distilled brief ───────────────────────────────────────────
    const contentMd = renderBrief({
      displayName, briefSlug, externalId, docId, sha256, fileName, repoPath, repoPushed,
      md, checks, decisions, questions, moduleDocType, proposedPriority, entryUrl, expectedDelivery,
    });

    // ── Register rows (row inserts only — guarded, never overwrite) ──────
    let briefInserted = false;
    if (!dryRun && !existingBrief) {
      const { error: bErr } = await (sb as any).schema('documentation').from('build_briefs').insert({
        slug: briefSlug,
        title: `${displayName} — auto-distilled from owner MD (md-intake v1)`,
        content_md: contentMd,
        status: briefStatus,
        priority: proposedPriority,
        goal_id: goalId,
        tags: ['md-intake', 'brief_source', moduleDocType],
        open_question: questions.length ? questions : null,
        target_repo: 'TBC-HM/namkhan-bi',
        target_branch: 'main',
        last_updated_by: EVALUATOR,
      });
      if (bErr) return NextResponse.json({ ok: false, error: `brief insert failed: ${bErr.message}` }, { status: 500 });
      briefInserted = true;
    }

    let queueInserted = false;
    if (!dryRun && !existingQueueRow) {
      const { error: mErr } = await (sb as any).schema('governance').from('module_completion_queue').insert({
        module_doc_type: moduleDocType,
        display_name: displayName,
        priority: proposedPriority,
        status: 'pending',
        brief_slug: briefSlug,
        entry_url: entryUrl,
        expected_delivery: expectedDelivery,
        open_questions: questions.length ? questions.map(q => q.q).join(' · ') : null,
        notes: `Registered via md-intake v1 from ${externalId} (goal ${goalId}: ${goal.slug ?? goal.title}). Source overrides derivatives.`,
      });
      if (mErr) return NextResponse.json({ ok: false, error: `queue insert failed: ${mErr.message}` }, { status: 500 });
      queueInserted = true;
    }

    // Queue position: active rows with a lower (or equal, earlier) priority + this row.
    const active = (queueRows ?? []).filter((r: any) => !['completed', 'skipped'].includes(r.status));
    const effectivePriority = existingQueueRow ? Number(existingQueueRow.priority) : proposedPriority;
    const matchedDocType = existingQueueRow?.module_doc_type ?? moduleDocType;
    const ahead = active.filter((r: any) => Number(r.priority) < effectivePriority && r.module_doc_type !== matchedDocType).length;
    const queuePosition = ahead + 1;

    return NextResponse.json({
      ok: true,
      dry_run: dryRun,
      source: {
        external_id: externalId, doc_id: docId, sha256, file_name: rawName,
        already_existed: !!existingSource,
        matches_existing: sourceMatchesExisting,
        repo_path: repoPath, repo_pushed: repoPushed, repo_push_error: repoPushError,
      },
      evaluation: { checks, decisions, questions, evaluator: EVALUATOR },
      brief: {
        slug: briefSlug, status: existingBrief ? existingBrief.status : briefStatus,
        priority: existingBrief ? existingBrief.priority : proposedPriority,
        already_existed: !!existingBrief, inserted: briefInserted,
        content_md: contentMd,
      },
      queue: {
        module_doc_type: existingQueueRow?.module_doc_type ?? moduleDocType,
        display_name: existingQueueRow?.display_name ?? displayName,
        priority: effectivePriority, position: queuePosition, active_rows: active.length + (existingQueueRow || dryRun ? 0 : 1),
        entry_url: existingQueueRow ? (existingQueueRow.entry_url ?? entryUrl) : entryUrl,
        expected_delivery: expectedDelivery,
        already_existed: !!existingQueueRow, inserted: queueInserted,
      },
    }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Unexpected error' }, { status: 500 });
  }
}
