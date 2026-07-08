// app/api/sop/proposals/seed-batch/route.ts
// PBS 2026-07-08: Batched seed. Client loops 6× with batch_index 0..5 asking
// for 50 proposals each (300 total). Each call is a single Anthropic request
// with a bounded target so max_tokens (was truncating the original single-shot
// 300-item generation and silently returning garbage) is comfortable.
//
// POST { property_id, batch_index (0..5), batch_size (default 50) }
//   → { ok, inserted, skipped, generated, batch, batch_index }
//
// Uses the same fn_sop_proposal_bulk_insert (dedupe on dept+lower(title)) so
// running the client loop end-to-end is idempotent — duplicates are counted as
// skipped, not errors.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;   // one 50-item call is fast (10-20s typically)

interface Body {
  property_id:  number;
  batch_index?: number;    // 0..5
  batch_size?:  number;    // default 50
}

interface ProposalItem {
  dept_code: string;
  title: string;
  purpose_short: string;
  priority?: number;
  tags?: string[];
  property_scope?: 'all' | 'namkhan' | 'donna';
}

// Dept focus per batch — a rough spread so the 6 batches cover every dept once
// without asking Claude for 300 items in one shot (that was the "nothing
// happens" root cause: model was truncating the JSON at 16k tokens and the
// response body was invalid JSON, so callAnthropicSeed threw silently).
const BATCH_FOCUS_NAMKHAN: Record<number, string> = {
  0: 'Housekeeping, Laundry, Public areas',
  1: 'F&B (kitchen + service + bar), Restaurant',
  2: 'Front Office, Reception, Guest Relations, Night audit',
  3: 'Spa, Wellness, Activities (boat/tuk-tuk/cycling), Retreat Programme',
  4: 'Maintenance, Engineering, Gardens, Security, Safety, Sustainability',
  5: 'HR, Finance, Procurement, IT, Marketing, Revenue, Retail, Transport',
};

const BATCH_FOCUS_DONNA: Record<number, string> = {
  0: 'Reception, Front desk, Guest calls',
  1: 'Housekeeping, Laundry, Public areas',
  2: 'F&B, Kitchen, Service, Bar',
  3: 'Maintenance, Engineering, Safety',
  4: 'HR, Finance, Procurement, IT',
  5: 'Marketing, Revenue, Sales, Retail',
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

const DONNA_CONTEXT_BASE = `You are Donna Portals's operations SOP author. Donna Portals is a boutique apart-hotel in Panama. Mews PMS. EUR/USD prices.
Departments: reception, housekeeping, maintenance, F&B, HR, finance, marketing, revenue, sales, IT, retail.
Same SOP quality rules apply: concrete, executable, no marketing filler, priority 1/2/3, metric units where relevant, dept_code lowercase snake_case, title 4-9 words, purpose_short single line under 130 chars, 1-3 short tags.`;

async function callAnthropicBatch(
  propertyId: number,
  batchIndex: number,
  batchSize: number
): Promise<ProposalItem[]> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY not set in Vercel env');

  const isNamkhan = propertyId === 260955;
  const base   = isNamkhan ? NAMKHAN_CONTEXT_BASE : DONNA_CONTEXT_BASE;
  const scope  = isNamkhan ? 'namkhan' : 'donna';
  const focus  = (isNamkhan ? BATCH_FOCUS_NAMKHAN : BATCH_FOCUS_DONNA)[batchIndex]
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
      max_tokens: 6000,   // 50 items × ~120 tokens each = 6000 headroom
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
    const batchSize  = Number.isFinite(b.batch_size)  ? Math.max(1, Math.min(80, Number(b.batch_size))) : 50;

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
