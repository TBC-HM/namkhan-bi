// app/api/sales/leads/webhook/route.ts
//
// PBS 2026-05-16 — Phase E scaffold for Apollo / Clay / Instantly inbound.
// Receives normalized lead-event payloads and writes to sales.leads +
// sales.lead_events. Treat as the canonical ingest endpoint vendors hit.
//
// AUTH: x-webhook-secret header must match LEADS_WEBHOOK_SECRET env.
// CONTRACT: see schema at the bottom. Vendor-specific normalizers (apollo,
// clay, instantly) live in /api/sales/leads/webhook/<vendor>/route.ts later.
//
// POST /api/sales/leads/webhook
// {
//   "event_type": "lead.scraped" | "lead.enriched" | "lead.verified" |
//                 "lead.queued"  | "lead.sent"     | "lead.delivered"  |
//                 "lead.opened"  | "lead.clicked"  | "lead.replied"    |
//                 "lead.converted" | "lead.disqualified" | "lead.dead",
//   "campaign_id": 7,
//   "external_id": "apollo-xyz-001",
//   "lead": {                           // required on lead.scraped, optional otherwise
//     "company_name": "...",
//     "decision_maker_name": "...",
//     "email": "...",
//     "country": "DE",
//     "icp_score": 75,
//     "scrape_cost_eur": 0.42
//   },
//   "event_data": { ... },              // free-form vendor payload
//   "occurred_at": "2026-05-16T18:00:00Z"
// }

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STAGE_BY_EVENT: Record<string, string> = {
  'lead.scraped':      'discovered',
  'lead.enriched':     'enriched',
  'lead.verified':     'qualified',
  'lead.queued':       'queued_to_send',
  'lead.sent':         'sent',
  'lead.delivered':    'delivered',
  'lead.opened':       'opened',
  'lead.clicked':      'clicked',
  'lead.replied':      'replied_neutral',  // sentiment refines via event_data.sentiment
  'lead.converted':    'converted',
  'lead.disqualified': 'disqualified',
  'lead.dead':         'dead',
};

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-webhook-secret');
  const expected = process.env.LEADS_WEBHOOK_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }

  const eventType = String(body?.event_type ?? '');
  const campaignId = Number(body?.campaign_id);
  const externalId = String(body?.external_id ?? '');
  if (!eventType || !STAGE_BY_EVENT[eventType]) {
    return NextResponse.json({ ok: false, error: `unknown event_type: ${eventType}` }, { status: 400 });
  }
  if (!Number.isFinite(campaignId)) {
    return NextResponse.json({ ok: false, error: 'campaign_id required' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  // 1) Look up campaign to get property_id + icp_segment_id
  const { data: campaign, error: cErr } = await sb.schema('sales').from('scraping_jobs')
    .select('id, property_id, icp_segment_id, cost_per_lead_eur')
    .eq('id', campaignId).maybeSingle();
  if (cErr || !campaign) {
    return NextResponse.json({ ok: false, error: `campaign ${campaignId} not found` }, { status: 404 });
  }
  const propertyId = Number(campaign.property_id);

  const newStage = body?.event_data?.sentiment && eventType === 'lead.replied'
    ? `replied_${body.event_data.sentiment}` // 'positive' | 'negative' | 'neutral'
    : STAGE_BY_EVENT[eventType];

  // 2) Upsert the lead — match on (property_id, source='scrape', source_ref=external_id)
  const leadPayload: any = {
    property_id: propertyId,
    lead_id: externalId,
    source: 'scrape',
    source_ref: externalId,
    campaign_id: campaignId,
    icp_segment_id: campaign.icp_segment_id,
    status: newStage,
  };
  const incoming = body?.lead ?? {};
  for (const k of ['company_name','decision_maker_name','decision_maker_role','email','phone_whatsapp','country','city','language','website','instagram_url','category','subcategory','retreat_history','upcoming_retreat_signal','audience_size_proxy','price_level','icp_score','intent_score','final_priority','notes']) {
    if (incoming[k] !== undefined) leadPayload[k] = incoming[k];
  }
  for (const k of ['scrape_cost_eur','enrich_cost_eur','verify_cost_eur','send_cost_eur','converted_value_eur','reply_sentiment','next_touch_at']) {
    if (incoming[k] !== undefined) leadPayload[k] = incoming[k];
  }
  // Touch timestamps based on event_type
  const now = body?.occurred_at ? new Date(body.occurred_at).toISOString() : new Date().toISOString();
  if (eventType === 'lead.sent')      leadPayload.sent_at = now;
  if (eventType === 'lead.opened')    leadPayload.opened_at = now;
  if (eventType === 'lead.clicked')   leadPayload.clicked_at = now;
  if (eventType === 'lead.replied')   leadPayload.replied_at = now;

  // Upsert by (property_id, source_ref)
  const { data: existing } = await sb.schema('sales').from('leads')
    .select('id').eq('property_id', propertyId).eq('source_ref', externalId).maybeSingle();

  let leadPk: number;
  if (existing?.id) {
    leadPk = Number(existing.id);
    const { error: uErr } = await sb.schema('sales').from('leads').update(leadPayload).eq('id', leadPk);
    if (uErr) return NextResponse.json({ ok: false, error: `update: ${uErr.message}` }, { status: 500 });
  } else {
    const { data: inserted, error: iErr } = await sb.schema('sales').from('leads')
      .insert(leadPayload).select('id').single();
    if (iErr) return NextResponse.json({ ok: false, error: `insert: ${iErr.message}` }, { status: 500 });
    leadPk = Number(inserted.id);
  }

  // 3) Append the event to sales.lead_events
  const eventCost = Number(
    incoming.scrape_cost_eur ?? incoming.enrich_cost_eur ?? incoming.verify_cost_eur ?? incoming.send_cost_eur ?? 0
  );
  await sb.schema('sales').from('lead_events').insert({
    lead_pk: leadPk,
    property_id: propertyId,
    event_type: eventType,
    event_data: body?.event_data ?? null,
    cost_eur: Number.isFinite(eventCost) && eventCost > 0 ? eventCost : null,
    occurred_at: now,
    source_tool: body?.source_tool ?? null,
  });

  return NextResponse.json({ ok: true, lead_id: leadPk, stage: newStage });
}
