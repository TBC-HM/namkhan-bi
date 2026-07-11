// app/api/sop/proposals/seed-batch/route.ts
// PBS 2026-07-08 (batched seed) + 2026-07-11 pm (dir 2) Donna prompt rewrite:
// swapped the thin 3-line Donna context for a Panama-specific brief so proposals
// stop being generic hotel-anywhere text (spain is not laos, panama is not laos).
//
// POST { property_id, batch_index (0..5), batch_size (default 25) }
//   → { ok, inserted, skipped, generated, batch, batch_index }
//
// Uses fn_sop_proposal_bulk_insert (dedupe on dept+lower(title)) so the client
// loop end-to-end is idempotent — duplicates are counted as skipped, not errors.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// PBS 2026-07-11: fetch Anthropic key via fn_get_secret RPC (SECURITY DEFINER),
// cached across warm invocations.
let CACHED_ANTHROPIC_KEY: string | null = null;
async function getAnthropicKey(): Promise<string> {
  if (CACHED_ANTHROPIC_KEY) return CACHED_ANTHROPIC_KEY;
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.rpc('fn_get_secret', { p_name: 'ANTHROPIC_API_KEY' });
    if (!error && typeof data === 'string' && data.length > 20) {
      CACHED_ANTHROPIC_KEY = data;
      return data;
    }
  } catch { /* fall through */ }
  const envKey = process.env.ANTHROPIC_API_KEY;
  if (envKey) {
    CACHED_ANTHROPIC_KEY = envKey;
    return envKey;
  }
  throw new Error('ANTHROPIC_API_KEY missing from Supabase vault AND Vercel env');
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

interface Body {
  property_id:  number;
  batch_index?: number;
  batch_size?:  number;
}

interface ProposalItem {
  dept_code: string;
  title: string;
  purpose_short: string;
  priority?: number;
  tags?: string[];
  property_scope?: 'all' | 'namkhan' | 'donna';
}

const BATCH_FOCUS_NAMKHAN: Record<number, string> = {
  0: 'Housekeeping, Laundry, Public areas',
  1: 'F&B (kitchen + service + bar), Restaurant',
  2: 'Front Office, Reception, Guest Relations, Night audit',
  3: 'Spa, Wellness, Activities (boat/tuk-tuk/cycling), Retreat Programme',
  4: 'Maintenance, Engineering, Gardens, Security, Safety, Sustainability',
  5: 'HR, Finance, Procurement, IT, Marketing, Revenue, Retail, Transport',
};

// PBS 2026-07-11 pm (dir 2) — V2 Donna focus, Panama apart-hotel appropriate.
// V1 was generic "hotel" focus which produced Namkhan-shaped SOPs.
const BATCH_FOCUS_DONNA_V2: Record<number, string> = {
  0: 'Reception, Guest calls, Front desk, Long-stay check-in',
  1: 'Housekeeping (apartments), Laundry (in-unit + guest laundry), Public areas',
  2: 'F&B (partner-restaurant coordination, in-unit deliveries), Kitchen, Service, Bar',
  3: 'Maintenance (apartment systems, HVAC, plumbing), Safety, Building compliance',
  4: 'HR (Código de Trabajo, décimo, CSS), Finance (USD accounting, Panama tax), Procurement, IT',
  5: 'Guest services (Panama City concierge), Marketing, Revenue, Retail, Sustainability',
};

const NAMKHAN_CONTEXT_BASE = `You are Namkhan's operations SOP author. Namkhan is a 24-room boutique river-lodge in Luang Prabang, Laos, sitting at the Nam Khan / Mekong confluence. It is a Small Luxury Hotels (SLH) member. Cloudbeds PMS. USD prices, LAK operating currency. Signature offerings: Art Suite, 4 Retreat Programmes, riverside dining, wellness rituals, sustainable practices. Culture: warm Laotian hospitality with sustainable practices.

Departments Namkhan actively operates: Reception / Front Office, Housekeeping, F&B (restaurant + bar), Kitchen, Spa / Wellness, Activities, Retail, Transport, Accounting / Finance, HR, IT, Marketing, Revenue, Maintenance / Engineering, Security, Guest Relations, Purchasing, Laundry, Sustainability, Safety.

RULES for proposing SOPs:
1. Every proposal must be a CONCRETE operational procedure a Laotian junior team member can execute. NOT strategy, NOT policy, NOT "guidelines".
2. Title: 4-9 words, imperative or noun-phrase (e.g. "Turndown service for double occupancy", "Daily bar mise-en-place setup").
3. purpose_short: ONE line, max 130 chars, factual. NO marketing filler ("delight", "memorable", "ensure").
4. dept_code: one of housekeeping | kitchen | front_office | spa | activities | retail | transport | maintenance | governance | procurement | hr | it | marketing | revenue | sales | finance | reception | security | wellness | sustainability | safety | laundry | purchasing | guest_relations. Lowercase snake_case only.
5. priority: 1 = safety/compliance/revenue-critical, 2 = daily standard, 3 = nice-to-have.
6. tags: 1-3 short lowercase tags (arrival, checkout, night, vip, retreat, art-suite, riverside).
7. Reference real Namkhan features where useful: Art Suite, restaurant, riverside deck, wellness suite, Retreat Programme, boat, tuk-tuk.
8. Metric units. Laotian labour context.
9. NO duplicates within your batch.`;

// PBS 2026-07-11 pm (dir 2) — Panama-specific rewrite of DONNA_CONTEXT_BASE.
// Prior version was generic "boutique apart-hotel in Panama" 3-liner and
// produced hotel-anywhere SOPs. This one enforces apart-hotel product shape
// (kitchenettes, in-unit laundry, extended stays), USD-Balboa currency,
// Panamanian labour context (Código de Trabajo, décimo, CSS, MITRADEL),
// bilingual EN/ES standard, and EXPLICITLY forbids Laos/Namkhan concepts.
const DONNA_CONTEXT_BASE = `You are proposing SOPs for a Panama apart-hotel. DO NOT reuse Laos, Namkhan, boat, tuk-tuk, retreat programme, Art Suite, or any river-lodge language. This property is on the Pacific coast of Panama, mostly urban.

Donna Portals is a boutique APART-HOTEL in Panama City, Panama (Casco Viejo / Marbella / San Francisco area — verify with property_id=1000001 metadata if the SOP needs a district anchor). Mews PMS. USD prices (Panama uses USD as legal tender via the Balboa at par); NO EUR anywhere. Small change is Balboa coins interchangeable at par with USD coins.

DISTINCT PRODUCT — this is NOT a room-only hotel:
- Guests stay in fully-equipped apartments: kitchenette + in-unit laundry + weekly (not daily) housekeeping.
- F&B model is different: in-unit cooking + concierge deliveries + partner restaurants — no on-property dining room by default.
- Extended stays are the norm — 7+ nights common, 30-90 night digital-nomad / snowbird bookings routine.
- Turndown is on-request only (apartment guests value privacy); housekeeping refreshes after 3-night stays, not nightly.

GUEST PROFILE:
- LATAM business travellers, US/Canadian snowbirds (Nov-Mar), remote-work couples, digital nomads on 30-90 day stays.
- Bilingual EN/ES service standard. Every guest-facing SOP must be executable in Spanish first, English second.

PANAMANIAN LABOUR + COMPLIANCE (Código de Trabajo):
- 8h workday, 48h workweek, 30-day paid vacation after 11 months.
- Décimo tercer mes (13th month) paid in 3 installments (April 15, August 15, December 15).
- CSS (Caja de Seguro Social) contributions on every payroll.
- MITRADEL (Ministerio de Trabajo) inspections + labour disputes.
- Use these anchors in HR/Finance/Payroll SOPs — this is what makes them Panama, not a generic hotel.

LOCAL CONTEXT:
- Panama City-specific concierge: Bio Museo, Panama Canal Miraflores locks, Casco Viejo walking tours, Perlas Islands day trips, Amador Causeway.
- Suppliers are USD cash for small vendors, card acceptance for larger ones.
- Building safety in a Pacific-coast city: humidity, sea-air corrosion on HVAC, quakes small but present, rainy season May-Nov flooding risk in some districts.

DEPARTMENTS DONNA ACTIVELY OPERATES (verified via 16 dept_codes in DB):
reception, housekeeping, laundry, public_areas, kitchen, service, bar, fb, maintenance, safety, hr, finance, procurement, it, front_desk, guest_calls.

DO NOT propose SOPs for departments Donna does not have:
- NO spa (no on-property spa unless later confirmed)
- NO activities dept (no in-house guides)
- NO retreat programme (that is Namkhan)
- NO boat / tuk-tuk / river transport
- NO wellness ritual anchor
- NO transport dept unless a shuttle is later confirmed
If your dept_code would trigger any of the above, skip the SOP and pick a different in-scope department instead.

SOP QUALITY RULES:
1. Every proposal is a CONCRETE operational procedure a Panama-based junior team member can execute in Spanish. NOT strategy, NOT policy.
2. Title: 4-9 words, imperative or noun-phrase.
3. purpose_short: ONE line, max 130 chars, factual. No marketing filler ("delight", "memorable", "ensure the best").
4. dept_code: lowercase snake_case; pick from the 16 Donna departments listed above.
5. priority: 1 = safety/compliance/revenue-critical, 2 = daily standard, 3 = nice-to-have.
6. tags: 1-3 short lowercase tags (apartment, long-stay, checkout, décimo, css, ingles, español, casco-viejo, panama-city, weekly-cleaning).
7. Reference Panama-real features where useful: apartment turndown, weekly-clean cadence, in-unit laundry, partner-restaurant handoff, concierge day-trip, décimo installment, CSS filing.
8. Metric + USD units (never EUR).
9. NO duplicates within your batch.`;

async function callAnthropicBatch(
  propertyId: number,
  batchIndex: number,
  batchSize: number
): Promise<ProposalItem[]> {
  const key = await getAnthropicKey();

  const isNamkhan = propertyId === 260955;
  const base   = isNamkhan ? NAMKHAN_CONTEXT_BASE : DONNA_CONTEXT_BASE;
  const scope  = isNamkhan ? 'namkhan' : 'donna';
  const focus  = (isNamkhan ? BATCH_FOCUS_NAMKHAN : BATCH_FOCUS_DONNA_V2)[batchIndex]
    ?? 'Any department listed above';

  const system = `${base}

BATCH FOCUS: this call must cover: ${focus}. Only propose SOPs whose dept_code fits this focus.

RETURN FORMAT: JSON only. No prose wrapper. Exactly this shape:
{ "proposals": [ { "dept_code": "...", "title": "...", "purpose_short": "...", "priority": 1|2|3, "tags": ["..."], "property_scope": "${scope}" }, ... ] }`;

  const user = `Batch ${batchIndex + 1} of 6. Propose EXACTLY ${batchSize} Standard Operating Procedures for the focus areas listed above. All ${batchSize} must be unique within this batch. Follow all rules exactly. Output JSON only.`;

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 6000,
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
  if (!m) throw new Error(`Anthropic returned no JSON block (batch ${batchIndex})`);

  let parsed: { proposals?: unknown };
  try { parsed = JSON.parse(m[0]); }
  catch (e) { throw new Error(`JSON parse failed (batch ${batchIndex}): ${(e as Error).message}`); }

  if (!Array.isArray(parsed.proposals)) {
    throw new Error(`Anthropic response missing proposals array (batch ${batchIndex})`);
  }

  const out: ProposalItem[] = [];
  for (const raw of parsed.proposals as unknown[]) {
    if (!raw || typeof raw !== 'object') continue;
    const it = raw as Record<string, unknown>;
    const dept  = String(it.dept_code ?? '').trim().toLowerCase();
    const title = String(it.title ?? '').trim();
    if (!dept || !title) continue;
    out.push({
      dept_code:      dept,
      title,
      purpose_short:  String(it.purpose_short ?? '').trim().slice(0, 240),
      priority:       Number(it.priority ?? 2) || 2,
      tags:           Array.isArray(it.tags) ? (it.tags as unknown[]).map((t) => String(t)).slice(0, 5) : [],
      property_scope: (it.property_scope as ProposalItem['property_scope']) === 'all' ? 'all' : (scope as 'namkhan' | 'donna'),
    });
  }
  return out;
}

export async function POST(req: Request) {
  try {
    const b = await req.json() as Body;
    const propertyId = Number(b.property_id);
    const batchIndex = Number.isFinite(b.batch_index) ? Number(b.batch_index) : 0;
    const batchSize  = Number.isFinite(b.batch_size)  ? Math.max(1, Math.min(80, Number(b.batch_size))) : 25;

    if (!Number.isFinite(propertyId) || propertyId <= 0) {
      return NextResponse.json({ error: 'property_id required' }, { status: 400 });
    }
    if (batchIndex < 0 || batchIndex > 20) {
      return NextResponse.json({ error: 'batch_index must be 0..20' }, { status: 400 });
    }

    const items = await callAnthropicBatch(propertyId, batchIndex, batchSize);
    if (items.length === 0) {
      return NextResponse.json({ error: `Anthropic returned zero valid proposals for batch ${batchIndex}` }, { status: 502 });
    }

    const sb = getSupabaseAdmin();
    const { data, error } = await sb.rpc('fn_sop_proposal_bulk_insert', {
      p_items: items,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const row = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({
      ok:          true,
      batch_index: batchIndex,
      batch_size:  batchSize,
      inserted:    row?.inserted ?? 0,
      skipped:     row?.skipped  ?? 0,
      batch:       row?.batch    ?? null,
      generated:   items.length,
    });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}
