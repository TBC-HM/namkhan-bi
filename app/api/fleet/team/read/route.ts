// app/api/fleet/team/read/route.ts
// Brief agent-team-slice-write-ctas: server-side reads backing the CTA UI.
// All reads go through public.* bridges only (claude_md §0.5):
//   v_cap_skills            — skill catalog for the picker (searchable, capped)
//   v_agent_skill_grants    — skills currently granted to one role
//   v_agent_prompt_current  — current versioned prompt text for the editor
//   cockpit_agent_memory    — public table; active memories with ids for archive
//
//   GET ?kind=skills&q=<search>   → { ok, skills: [...] }   (max 50 rows)
//   GET ?kind=agent&role=<role>   → { ok, prompt, grants, memories }

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const kind = searchParams.get('kind');

  if (kind === 'skills') {
    // Server-side searchable catalog — never ship the 114×160 matrix.
    const q = (searchParams.get('q') ?? '').trim();
    let query = admin
      .from('v_cap_skills')
      .select('id, name, category, description, authority_level, requires_pbs_approval, active')
      .eq('active', true)
      .order('name', { ascending: true })
      .limit(50);
    if (q) query = query.or(`name.ilike.%${q}%,category.ilike.%${q}%`);
    const { data, error } = await query;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, skills: data ?? [] });
  }

  if (kind === 'agent') {
    const role = searchParams.get('role');
    if (!role) return NextResponse.json({ ok: false, error: 'role required' }, { status: 400 });

    const [promptRes, grantsRes, memRes, auditRes] = await Promise.all([
      admin
        .from('v_agent_prompt_current')
        .select('role, version, system_prompt, change_note, created_at')
        .eq('role', role)
        .maybeSingle(),
      admin
        .from('v_agent_skill_grants')
        .select('skill_id, skill_name, category, authority_level, enabled, created_at')
        .eq('role', role)
        .eq('enabled', true)
        .order('skill_name', { ascending: true }),
      admin
        .from('cockpit_agent_memory')
        .select('id, memory_type, content, importance, topics, created_at')
        .eq('agent_handle', role)
        .not('active', 'is', false)
        .order('importance', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(60),
      // Audit trail for the panel — wrappers log via fn_agent_audit into the
      // public cockpit_audit_log table (no schema bridge needed).
      admin
        .from('cockpit_audit_log')
        .select('id, created_at, action, notes, success')
        .eq('agent', role)
        .in('action', [
          'set_prompt', 'set_status', 'grant_skill', 'revoke_skill',
          'bulk_grant_skill', 'propose_skill', 'add_memory', 'archive_memory',
        ])
        .order('created_at', { ascending: false })
        .limit(8),
    ]);

    const err = promptRes.error ?? grantsRes.error ?? memRes.error ?? auditRes.error;
    if (err) return NextResponse.json({ ok: false, error: err.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      prompt: promptRes.data ?? null,
      grants: grantsRes.data ?? [],
      memories: memRes.data ?? [],
      audit: auditRes.data ?? [],
    });
  }

  return NextResponse.json({ ok: false, error: "kind must be 'skills' or 'agent'" }, { status: 400 });
}
