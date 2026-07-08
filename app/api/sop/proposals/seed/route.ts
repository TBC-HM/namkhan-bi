// app/api/sop/proposals/seed/route.ts
// PBS 2026-07-08: Bulk-seed SOP proposals via Claude Sonnet.
//
// POST { property_id } → asks Claude for ~300 SOP titles + one-line purpose,
// across every department this property operates. Inserts into
// knowledge.sop_proposals via public.fn_sop_proposal_bulk_insert.
//
// Anti-blabber: system prompt bakes in Namkhan property context and forbids
// marketing language. Returns { ok, inserted, skipped, batch }.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;   // Anthropic can take 30-60s for 300+ items

interface Body { property_id: number }

interface ProposalItem {
  dept_code: string;
  title: string;
  purpose_short: string;
  priority?: number;
  tags?: string[];
  property_scope?: 'all' | 'namkhan' | 'donna';
}

const NAMKHAN_CONTEXT = `You are Namkhan's operations SOP author. Namkhan is a 24-room boutique river-lodge in Luang Prabang, Laos, sitting at the Nam Khan / Mekong confluence. It is a Small Luxury Hotels (SLH) member. Cloudbeds PMS. USD prices, LAK operating currency. Signature offerings: Art Suite, 4 Retreat Programmes, riverside dining, wellness rituals, sustainable practices. Culture: warm Laotian hospitality with sustainable practices.

Departments Namkhan actively operates:
- Reception / Front Office (check-in, guest calls, night audit)
- Housekeeping (guest rooms, public areas, turndown, laundry liaison)
- F&B — restaurant + bar (service, mise-en-place, beverage, wine)
- Kitchen (prep, hot line, cold line, pastry, hygiene)
- Spa / Wellness (treatments, retreats, product handling)
- Activities (excursions, cycling, boat trips, retreats programme)
- Retail (boutique, inventory, sales)
- Transport (tuk-tuk, boat, van, driver safety)
- Accounting / Finance (payables, receivables, cash, month-end)
- HR (recruitment, onboarding, payroll, wellbeing)
- IT (systems, network, PMS, POS)
- Marketing (content, social, newsletter, brand)
- Revenue (rate strategy, distribution, forecasting)
- Maintenance / Engineering (building, gardens, riverfront, boats)
- Security (asset security, guest safety, incident response)
- Guest Relations (concierge, complaints, VIP)
- Purchasing (supplier, local sourcing)
- Laundry
- Sustainability (waste, water, energy, community)
- Safety (fire, first-aid, emergency response, guest safety briefings)

RULES for proposing SOPs:
1. Every proposal must be a CONCRETE operational procedure a Laotian junior team member can execute. NOT strategy, NOT policy, NOT "guidelines".
2. Title: 4-9 words, imperative or noun-phrase, e.g. "Turndown service for double occupancy", "Daily bar mise-en-place setup".
3. purpose_short: ONE line, max 130 chars, factual ("why this SOP exists"). NO marketing filler, NO "ensure memorable experience", NO "delight guests".
4. dept_code: one of housekeeping | kitchen | front_office | spa | activities | retail | transport | maintenance | governance | procurement | hr | it | marketing | revenue | sales | finance | reception | security | wellness | sustainability | safety | laundry | purchasing | guest_relations. Use lowercase snake_case only.
5. priority: 1 = safety/compliance/revenue-critical, 2 = daily standard, 3 = nice-to-have.
6. tags: 1-3 short lowercase tags (e.g. "arrival", "checkout", "night", "vip", "retreat", "art-suite", "riverside").
7. Reference real Namkhan features where useful: Art Suite, restaurant, riverside deck, wellness suite, Retreat Programme, boat, tuk-tuk.
8. Metric units. Laotian labour context.
9. NO duplicates. Cover every department broadly.
10. Aim for ~300 proposals total, spread across all listed departments (housekeeping ~40, kitchen ~35, F&B ~25, front_office ~30, spa ~20, activities ~20, maintenance ~25, safety ~15, hr ~15, others ~10-15 each).`;

const DONNA_CONTEXT = `You are Donna Portals's operations SOP author. Donna Portals is a boutique apart-hotel in Panama. Mews PMS. EUR/USD prices.
Departments: reception, housekeeping, maintenance, F&B, HR, finance, marketing, revenue.
Same SOP quality rules apply: concrete, executable, no marketing filler, priority 1/2/3, metric units where relevant.
Aim for ~200 proposals across the departments listed.`;

async function callAnthropicSeed(propertyId: number): Promise<ProposalItem[]> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY not set in Vercel env');

  const isNamkhan = propertyId === 260955;
  const context = isNamkhan ? NAMKHAN_CONTEXT : DONNA_CONTEXT;
  const scope   = isNamkhan ? 'namkhan' : 'donna';

  const system = `${context}

RETURN FORMAT: JSON only. No prose wrapper. Exactly this shape:
{ "proposals": [ { "dept_code": "...", "title": "...", "purpose_short": "...", "priority": 1|2|3, "tags": ["..."], "property_scope": "${scope}" }, ... ] }`;

  const user = `Propose the full list of Standard Operating Procedures this property needs. Aim for approximately 300 proposals. Cover every department listed. Follow all rules exactly. Output JSON only.`;

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 16000,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Anthropic HTTP ${r.status}: ${t.slice(0, 200)}`);
  }
  const j: { content?: Array<{ type: string; text?: string }> } = await r.json();
  const txt = (j.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
  const m = txt.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Anthropic returned no JSON block');

  let parsed: { proposals?: unknown };
  try { parsed = JSON.parse(m[0]); }
  catch (e) { throw new Error(`JSON parse failed: ${(e as Error).message}`); }

  if (!Array.isArray(parsed.proposals)) {
    throw new Error('Anthropic response missing proposals array');
  }

  // Sanitise each item; drop malformed.
  const out: ProposalItem[] = [];
  for (const raw of parsed.proposals as unknown[]) {
    if (!raw || typeof raw !== 'object') continue;
    const it = raw as Record<string, unknown>;
    const dept = String(it.dept_code ?? '').trim().toLowerCase();
    const title = String(it.title ?? '').trim();
    if (!dept || !title) continue;
    out.push({
      dept_code:      dept,
      title,
      purpose_short:  String(it.purpose_short ?? '').trim().slice(0, 240),
      priority:       Number(it.priority ?? 2) || 2,
      tags:           Array.isArray(it.tags) ? (it.tags as unknown[]).map((t) => String(t)).slice(0, 5) : [],
      property_scope: (it.property_scope as ProposalItem['property_scope']) === 'all' ? 'all' : scope as 'namkhan' | 'donna',
    });
  }
  return out;
}

export async function POST(req: Request) {
  try {
    const b = await req.json() as Body;
    const propertyId = Number(b.property_id);
    if (!Number.isFinite(propertyId) || propertyId <= 0) {
      return NextResponse.json({ error: 'property_id required' }, { status: 400 });
    }

    const items = await callAnthropicSeed(propertyId);
    if (items.length === 0) {
      return NextResponse.json({ error: 'Anthropic returned zero valid proposals' }, { status: 502 });
    }

    const sb = getSupabaseAdmin();
    const { data, error } = await sb.rpc('fn_sop_proposal_bulk_insert', {
      p_items: items,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // data is a single-row set: [{ inserted, skipped, batch }]
    const row = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({
      ok: true,
      inserted:  row?.inserted ?? 0,
      skipped:   row?.skipped  ?? 0,
      batch:     row?.batch    ?? null,
      generated: items.length,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
