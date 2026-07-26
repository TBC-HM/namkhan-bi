// app/api/marketing/newsletter-v2/gate/route.ts
// Newsletter Writer Team v1 · Narin (editorial director) confidence gate — A7.
//
// POST { property_id, campaign_ids?, limit? } — runs the writer chain over the
// seeded lifecycle campaigns READ-ONLY (no campaign_id is ever passed to the
// engine, so the DO-NOT-TOUCH seeded rows are never rewritten) and records one
// marketing.email_proposals row per email with Narin's gate verdict:
//   green  · veda >= 80 (clean pass — rubric critique empty by contract)
//   amber  · 60-79      (usable, needs eyes)
//   red    · < 60 or stale_context / writer failure
// Phase-completion criterion: green rate >= 60% on the 7 seeded lifecycle
// emails. GET returns that rate from the recorded proposals.
//
// REUSE-FIRST: the ONE shared engine (lib/emailAgents/engine.ts) does all
// composing + scoring; this route only orchestrates and ledgers.

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { proposeOne, type ProposeBody } from '@/lib/emailAgents/engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const AGENT_HANDLE = 'narin';
const PROPOSAL_KIND = 'lifecycle_gate';

type CampaignLite = {
  campaign_id: string;
  name: string | null;
  campaign_kind: string | null;
  group_slug: string | null;
  audience_type: string | null;
  relative_kind: string | null;
  planned_date: string | null;
  status: string;
};

type GateBody = {
  property_id?: number;
  campaign_ids?: string[];
  limit?: number;
};

type GateResult = {
  campaign_id: string;
  name: string | null;
  gate_status: 'green' | 'amber' | 'red';
  veda_score: number | null;
  proposal_id: string | null;
  error: string | null;
};

function gateFromScore(score: number): 'green' | 'amber' | 'red' {
  if (score >= 80) return 'green';
  if (score >= 60) return 'amber';
  return 'red';
}

export async function POST(req: NextRequest) {
  let body: GateBody;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 }); }

  const pid = Number(body.property_id);
  if (!Number.isFinite(pid) || pid <= 0) {
    return NextResponse.json({ ok: false, error: 'property_id_required' }, { status: 400 });
  }
  const limit = Math.max(1, Math.min(10, Number(body.limit) || 7));
  const wanted = Array.isArray(body.campaign_ids)
    ? body.campaign_ids.map(String).filter(Boolean)
    : null;

  const sb = getSupabaseAdmin();
  let q = sb.schema('guest').from('campaigns')
    .select('campaign_id, name, campaign_kind, group_slug, audience_type, relative_kind, planned_date, status')
    .eq('property_id', pid)
    .eq('campaign_kind', 'lifecycle')
    .in('status', ['draft', 'scheduled'])
    .order('created_at', { ascending: true })
    .limit(50);
  if (wanted && wanted.length > 0) q = q.in('campaign_id', wanted);

  const { data, error } = await q;
  if (error) return NextResponse.json({ ok: false, error: `campaigns_load_failed: ${error.message}` }, { status: 500 });
  const campaigns = ((data as CampaignLite[] | null) ?? []).slice(0, limit);
  if (campaigns.length === 0) {
    return NextResponse.json({ ok: false, error: 'no_lifecycle_campaigns_matched' }, { status: 404 });
  }

  const results: GateResult[] = [];

  // Sequential on purpose: each run is a full Saya→Veda chain (Anthropic
  // calls) — parallel fan-out here would trip provider rate limits.
  for (const c of campaigns) {
    let gate: 'green' | 'amber' | 'red' = 'red';
    let vedaScore: number | null = null;
    let subject: string | null = null;
    let bodyMd: string | null = null;
    let rubric: unknown = null;
    let errNote: string | null = null;

    try {
      // READ-ONLY by construction: no campaign_id → the engine never persists
      // back onto the campaign row (seeded lifecycle rows are DO-NOT-TOUCH).
      const seedParts = [
        `Lifecycle email: ${c.name ?? c.campaign_id}`,
        c.relative_kind ? `Lifecycle moment: ${c.relative_kind}` : null,
      ].filter(Boolean).join('\n');

      const proposeBody: ProposeBody = {
        property_id: pid,
        kind: 'lifecycle',
        seed_text: seedParts,
        group_slug: c.group_slug,
        audience_type: c.audience_type === 'b2b' ? 'b2b' : 'b2c',
        target_date: c.planned_date ?? undefined,
        strict_context: true,
      };
      const res = await proposeOne(proposeBody);
      const j = await res.json().catch(() => null) as {
        ok?: boolean; error?: string;
        proposal?: { subject?: string; body_md?: string };
        veda?: { score?: number; issues?: string[]; critique?: string };
        stale?: string[];
      } | null;

      if (j?.ok && j.proposal && j.veda && Number.isFinite(Number(j.veda.score))) {
        vedaScore = Number(j.veda.score);
        gate = gateFromScore(vedaScore);
        subject = j.proposal.subject ?? null;
        bodyMd = j.proposal.body_md ?? null;
        rubric = j.veda;
      } else {
        errNote = j?.error ?? `http_${res.status}`;
        rubric = j?.stale ? { error: errNote, stale: j.stale } : { error: errNote };
      }
    } catch (e) {
      errNote = e instanceof Error ? e.message : 'exception';
      rubric = { error: errNote };
    }

    let proposalId: string | null = null;
    const { data: ins, error: insErr } = await sb.schema('marketing').from('email_proposals').insert({
      property_id: pid,
      agent_handle: AGENT_HANDLE,
      proposal_kind: PROPOSAL_KIND,
      campaign_id: c.campaign_id,
      subject,
      body_md: bodyMd,
      payload: {
        campaign_name: c.name,
        relative_kind: c.relative_kind,
        group_slug: c.group_slug,
        audience_type: c.audience_type,
        veda_score: vedaScore,
        error: errNote,
      },
      rubric_json: rubric,
      gate_status: gate,
      status: 'proposed',
    }).select('proposal_id').maybeSingle();
    if (!insErr && ins?.proposal_id) proposalId = String(ins.proposal_id);

    results.push({
      campaign_id: c.campaign_id,
      name: c.name,
      gate_status: gate,
      veda_score: vedaScore,
      proposal_id: proposalId,
      error: errNote ?? (insErr ? `ledger_insert_failed: ${insErr.message}` : null),
    });
  }

  const green = results.filter(r => r.gate_status === 'green').length;
  const amber = results.filter(r => r.gate_status === 'amber').length;
  const red = results.filter(r => r.gate_status === 'red').length;
  const greenRate = results.length > 0 ? green / results.length : 0;

  return NextResponse.json({
    ok: true,
    property_id: pid,
    total: results.length,
    green, amber, red,
    green_rate: Math.round(greenRate * 100) / 100,
    gate_pass: greenRate >= 0.6,
    results,
  });
}

export async function GET(req: NextRequest) {
  const pid = Number(req.nextUrl.searchParams.get('property_id'));
  if (!Number.isFinite(pid) || pid <= 0) {
    return NextResponse.json({ ok: false, error: 'property_id_required' }, { status: 400 });
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from('v_email_proposals')
    .select('proposal_id, campaign_id, director_slot_id, proposal_kind, gate_status, status, created_at, payload')
    .eq('property_id', pid)
    .eq('agent_handle', AGENT_HANDLE)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const rows = data ?? [];
  // Green rate over the LATEST verdict per campaign/slot (older runs superseded).
  const latest = new Map<string, { gate_status: string | null }>();
  for (const r of rows as Array<{ campaign_id: string | null; director_slot_id: number | null; gate_status: string | null }>) {
    const key = r.campaign_id ?? (r.director_slot_id != null ? `slot:${r.director_slot_id}` : null);
    if (key && !latest.has(key)) latest.set(key, { gate_status: r.gate_status });
  }
  const verdicts = Array.from(latest.values());
  const green = verdicts.filter(v => v.gate_status === 'green').length;
  const greenRate = verdicts.length > 0 ? green / verdicts.length : 0;

  return NextResponse.json({
    ok: true,
    property_id: pid,
    scored: verdicts.length,
    green,
    green_rate: Math.round(greenRate * 100) / 100,
    gate_pass: verdicts.length > 0 && greenRate >= 0.6,
    recent: rows,
  });
}
