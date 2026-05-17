// app/api/cockpit-v2/prompt/route.ts
// Versioned write to cockpit.cap_prompts. dry_run=true validates and returns
// a preview; dry_run=false inserts a new row with version = old+1 and flips
// active=false on prior rows for the same role.
//
// Server-side service role only. The endpoint never trusts a client-supplied
// version; it always reads the current max(version) from the DB.
//
// ── Guard (added #78, 2026-05-13) ───────────────────────────────────────────
// Reads the signed `workspace_session` cookie (lib/workspace-cookie.ts) and
// resolves it to a workspace_users row via getSessionScope().
// Only `role_level='holding'` (or is_owner) may publish a new active row.
// Lower tiers can still call with dry_run:true and get the preview, but a
// publish (dry_run:false) returns 403. Every accepted write is mirrored to
// public.cockpit_audit_log.

import { NextRequest, NextResponse } from 'next/server';
import { sbCockpit } from '@/app/cockpit-v2/_lib/supabase-cockpit';
import { getSessionScope } from '@/lib/session-scope';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Body = {
  role?: string;
  prompt?: string;
  notes?: string | null;
  dry_run?: boolean;
};

async function logAudit(args: {
  action: string;
  target: string;
  success: boolean;
  actor: string | null;
  metadata: Record<string, unknown>;
  reasoning: string;
}): Promise<void> {
  try {
    const admin = getSupabaseAdmin();
    await admin.from('cockpit_audit_log').insert({
      agent: 'cockpit-v2-prompt',
      action: args.action,
      target: args.target,
      success: args.success,
      metadata: { actor: args.actor, ...args.metadata },
      reasoning: args.reasoning,
    });
  } catch (e) {
    console.error('[cockpit-v2 prompt] audit insert failed', e);
  }
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const role = (body.role || '').trim();
  const prompt = (body.prompt || '').toString();
  const notes = body.notes ?? null;
  const dryRun = body.dry_run !== false;

  if (!role) return NextResponse.json({ error: 'missing role' }, { status: 400 });
  if (!prompt || prompt.length < 10)
    return NextResponse.json({ error: 'prompt body too short' }, { status: 400 });

  // ── Auth guard ──────────────────────────────────────────────────────────
  // Resolve the workspace_session cookie. getSessionScope() handles
  // signed-cookie verification + DB lookup for the role_level.
  const scope = await getSessionScope();
  const isHolding = scope.isHolding && !!scope.email; // legacy no-cookie path returns isHolding=true but email=null — that does NOT count as authorised.

  if (!dryRun && !isHolding) {
    await logAudit({
      action: 'publish_denied',
      target: role,
      success: false,
      actor: scope.email,
      metadata: {
        role_level: scope.roleLevel,
        has_email: !!scope.email,
        property_ids: scope.propertyIds,
      },
      reasoning:
        `Publish blocked: requires role_level='holding'. Caller=${scope.email ?? 'anonymous'} (${scope.roleLevel}).`,
    });
    return NextResponse.json(
      { error: 'forbidden: publish requires holding role_level' },
      { status: 403 },
    );
  }

  // Find the current active prompt + max version
  const { data: existing, error: readErr } = await sbCockpit
    .from('cap_prompts')
    .select('id, version, active, prompt')
    .eq('role', role)
    .order('version', { ascending: false })
    .limit(5);
  if (readErr) {
    console.error('[cockpit-v2 prompt] read error', readErr);
    return NextResponse.json({ error: 'read failed: ' + readErr.message }, { status: 500 });
  }
  const currentMax = existing && existing.length > 0 ? existing[0].version : 0;
  const nextVersion = (currentMax ?? 0) + 1;
  const currentText = existing && existing.length > 0 ? existing[0].prompt : '';

  if (dryRun) {
    await logAudit({
      action: 'dry_run_preview',
      target: role,
      success: true,
      actor: scope.email,
      metadata: {
        role_level: scope.roleLevel,
        prompt_length: prompt.length,
        prev_length: currentText?.length ?? 0,
        next_version: nextVersion,
      },
      reasoning: `Preview-only call by ${scope.email ?? 'anonymous'} (${scope.roleLevel}).`,
    });
    return NextResponse.json({
      ok: true,
      dry_run: true,
      role,
      next_version: nextVersion,
      previous_version: currentMax,
      can_publish: isHolding,
      message:
        `Would insert cap_prompts row v${nextVersion} for role=${role} ` +
        `(prev v${currentMax}). Old active rows: ${existing?.filter((r) => r.active).length ?? 0} ` +
        `will be flipped to active=false. Body length: ${prompt.length} chars ` +
        `(was ${currentText?.length ?? 0}). Notes: ${notes || '—'}.` +
        (isHolding ? '' : ' (Publish disabled — requires holding role.)'),
    });
  }

  // Real write. First, flip prior actives off; then insert new row.
  const { error: flipErr } = await sbCockpit
    .from('cap_prompts')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('role', role)
    .eq('active', true);
  if (flipErr) {
    console.error('[cockpit-v2 prompt] flip error', flipErr);
    await logAudit({
      action: 'publish_failed',
      target: role,
      success: false,
      actor: scope.email,
      metadata: { stage: 'flip', error: flipErr.message },
      reasoning: 'Could not deactivate prior active prompt rows.',
    });
    return NextResponse.json({ error: 'flip failed: ' + flipErr.message }, { status: 500 });
  }

  const { error: insErr } = await sbCockpit.from('cap_prompts').insert([
    {
      role,
      prompt,
      version: nextVersion,
      active: true,
      notes,
      source: 'cockpit-v2-ui',
      status: 'active',
    },
  ]);
  if (insErr) {
    console.error('[cockpit-v2 prompt] insert error', insErr);
    await logAudit({
      action: 'publish_failed',
      target: role,
      success: false,
      actor: scope.email,
      metadata: { stage: 'insert', error: insErr.message, version: nextVersion },
      reasoning: 'Insert of new active prompt row failed after flipping priors.',
    });
    return NextResponse.json({ error: 'insert failed: ' + insErr.message }, { status: 500 });
  }

  await logAudit({
    action: 'publish',
    target: role,
    success: true,
    actor: scope.email,
    metadata: {
      version: nextVersion,
      previous_version: currentMax,
      prompt_length: prompt.length,
      prev_length: currentText?.length ?? 0,
    },
    reasoning: `Published cap_prompts v${nextVersion} for role=${role} by ${scope.email}.`,
  });

  return NextResponse.json({ ok: true, role, version: nextVersion });
}
