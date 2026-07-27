// app/api/cockpit/skills/variance_narrative/route.ts
// FP&C Module v1 (brief module-financial-planning-control-v1) — A5.
//
// Queue-only skill (claude_md §0.6): drafts a monthly budget-variance narrative
// from public.v_budget_vs_actual_monthly (classes with |var_pct| > 10) and lands
// it as a cockpit_tickets row with status='awaits_user'. NEVER auto-published —
// PBS reviews the draft in the cockpit. property_id lives in metadata (canon:
// cockpit_tickets.project_id is a cockpit-internal FK, not a property).
//
// Narrative is deterministic (numbers straight from the view — metric truth law,
// no hand-typed figures, no LLM hallucination surface). Binding to a future
// Intel agent identity is cosmetic and out of scope (research finding R6).

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NAMKHAN_ID = 260955;
const VARIANCE_THRESHOLD_PCT = 10;

function authed(req: Request): boolean {
  if (process.env.COCKPIT_AUTH_GATE !== 'on') return true;
  return (req.headers.get('authorization') ?? '') === `Bearer ${process.env.COCKPIT_AGENT_TOKEN}`;
}

interface VarianceRow {
  property_id: number;
  year_month: string;
  gl_class: string;
  class_name: string | null;
  budget_usd: number | null;
  actual_usd: number | null;
  var_abs: number | null;
  var_pct: number | null;
}

const fmt = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

function draftNarrative(yearMonth: string, breaches: VarianceRow[]): string {
  const lines = breaches.map((r) => {
    const dir = (r.var_abs ?? 0) >= 0 ? 'above' : 'below';
    return (
      `- ${r.class_name ?? r.gl_class}: actual ${fmt(r.actual_usd ?? 0)} vs budget ${fmt(r.budget_usd ?? 0)} — ` +
      `${fmt(Math.abs(r.var_abs ?? 0))} (${Math.abs(r.var_pct ?? 0).toFixed(1)}%) ${dir} budget.`
    );
  });
  return (
    `Budget variance narrative — ${yearMonth} (draft, awaiting PBS review)\n\n` +
    `${breaches.length} class${breaches.length === 1 ? '' : 'es'} breached the ±${VARIANCE_THRESHOLD_PCT}% variance threshold ` +
    `(source: public.v_budget_vs_actual_monthly, GL layer USD / ADR-173):\n\n` +
    lines.join('\n') +
    `\n\nFigures reconcile to the QB P&L by class (finance.gl_pl_summary_monthly, ADR-159). ` +
    `This draft is queue-only and is not published anywhere until reviewed.`
  );
}

export async function POST(req: Request) {
  if (!authed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const propertyId = Number(body?.property_id ?? NAMKHAN_ID);
  let yearMonth: string | null = typeof body?.year_month === 'string' ? body.year_month : null;

  const sb = getSupabaseAdmin();

  // Default: latest month that has BOTH budget and actuals.
  if (!yearMonth) {
    const { data: latest, error: e1 } = await sb
      .from('v_budget_vs_actual_monthly')
      .select('year_month')
      .eq('property_id', propertyId)
      .not('actual_usd', 'is', null)
      .not('budget_usd', 'is', null)
      .order('year_month', { ascending: false })
      .limit(1);
    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
    yearMonth = latest?.[0]?.year_month ?? null;
    if (!yearMonth) {
      return NextResponse.json({ ok: false, reason: 'no month with both budget and actuals — load a budget first' }, { status: 200 });
    }
  }

  const { data: rows, error: e2 } = await sb
    .from('v_budget_vs_actual_monthly')
    .select('property_id, year_month, gl_class, class_name, budget_usd, actual_usd, var_abs, var_pct')
    .eq('property_id', propertyId)
    .eq('year_month', yearMonth)
    .not('var_pct', 'is', null);
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

  const breaches = ((rows ?? []) as VarianceRow[])
    .filter((r) => Math.abs(r.var_pct ?? 0) > VARIANCE_THRESHOLD_PCT)
    .sort((a, b) => Math.abs(b.var_pct ?? 0) - Math.abs(a.var_pct ?? 0));

  if (breaches.length === 0) {
    return NextResponse.json({ ok: true, year_month: yearMonth, breaches: 0, ticket_id: null, note: 'no class variance beyond threshold — no narrative drafted' });
  }

  // Dedup: one open draft per property × month.
  const { data: existing } = await sb
    .from('cockpit_tickets')
    .select('id')
    .eq('intent', 'variance_narrative')
    .eq('status', 'awaits_user')
    .contains('metadata', { property_id: propertyId, year_month: yearMonth })
    .limit(1);
  if (existing && existing.length > 0) {
    return NextResponse.json({ ok: true, year_month: yearMonth, breaches: breaches.length, ticket_id: existing[0].id, note: 'draft already awaiting review' });
  }

  const narrative = draftNarrative(yearMonth, breaches);
  const { data: ticket, error: e3 } = await sb
    .from('cockpit_tickets')
    .insert({
      source: 'skill:variance_narrative',
      arm: 'finance',
      intent: 'variance_narrative',
      status: 'awaits_user',
      email_subject: `Variance narrative draft — ${yearMonth}`,
      email_body: narrative,
      parsed_summary: `${breaches.length} class(es) >±${VARIANCE_THRESHOLD_PCT}% vs budget in ${yearMonth}`,
      metadata: {
        property_id: propertyId,
        year_month: yearMonth,
        threshold_pct: VARIANCE_THRESHOLD_PCT,
        classes: breaches.map((b) => ({ gl_class: b.gl_class, var_pct: b.var_pct })),
        source_view: 'public.v_budget_vs_actual_monthly',
      },
    })
    .select('id')
    .single();
  if (e3) return NextResponse.json({ error: e3.message }, { status: 500 });

  return NextResponse.json({ ok: true, year_month: yearMonth, breaches: breaches.length, ticket_id: ticket.id });
}
