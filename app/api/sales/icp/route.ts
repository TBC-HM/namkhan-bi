// app/api/sales/icp/route.ts — ICP CRUD + AI propose
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { callAnthropic, isLlmOk, getVaultSecret, ANTHROPIC_MODEL } from '@/lib/youtube/skills-common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NAMKHAN = 260955;

// GET — list all ICPs with 89-day metrics
export async function GET() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from('v_icp_89day_performance').select('*').order('sort_order');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, icps: data });
}

// POST — create new ICP OR action=propose
export async function POST(req: NextRequest) {
  const sb = getSupabaseAdmin();
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;

  // AI Propose action
  if (body.action === 'propose') {
    // 1. Fetch unmatched booking clusters
    const { data: unmatched } = await sb.rpc('fn_icp_unmatched_clusters', { p_days: 89, p_property_id: NAMKHAN }).catch(() => ({ data: null }));

    // 2. Fetch current ICPs
    const { data: currentIcps } = await sb.from('v_icp_89day_performance').select('key,name,bookings_89d,revenue_89d,avg_adr_89d').order('sort_order');

    // 3. Fetch reality profile for brand context
    const { data: reality } = await sb.from('v_reality_profile').select('vibe,brand_voice,positioning').eq('property_id', NAMKHAN).maybeSingle();

    const systemPrompt = `You are an ICP research strategist for The Namkhan — a 5-star boutique hotel in Luang Prabang, Laos.
Property: 24 rooms · SLH Considerate Collection · Nam Khan/Mekong confluence · Yoga Pavilion · Jungle Spa · ROOTS organic restaurant · cultural depth.
Brand voice: ${reality?.brand_voice ?? 'Refined, understated, authentic Laos luxury.'}
Positioning: ${reality?.positioning ?? '5-star boutique, SLH member, nature-immersed, culturally authentic.'}`;

    const unmatchedSummary = unmatched ? JSON.stringify(unmatched).slice(0, 2000) : '[data unavailable — use general knowledge]';
    const currentSummary = (currentIcps ?? []).map((i: Record<string,unknown>) => `${i.key}: ${i.bookings_89d} bookings $${i.revenue_89d} (ADR $${i.avg_adr_89d})`).join('\n');

    const userPrompt = `CURRENT ICPs (89-day performance):
${currentSummary}

UNMATCHED BOOKING CLUSTERS (last 89 days — not yet an ICP):
${unmatchedSummary}

For each cluster worth targeting, provide:
1. Research reason: WHY this cluster fits The Namkhan (e.g., India yoga market context, growth trends, alignment with property capabilities)
2. ICP proposal: name, description, criteria (ADR range, LOS, countries, channels), property_use_case
3. Revenue potential: estimated bookings × stay value if actively targeted
4. How to reach them: discovery channels, outreach approach

Only propose ICPs where the fit with The Namkhan is GENUINE. Reject clusters that are price-sensitive, short-stay, or don't match the 5-star SLH positioning.

Return JSON array:
[{"key":"slug","name":"Name","research_reason":"Why this fits The Namkhan...","description":"Full persona...","icp_type":"b2b|b2c","priority":1-3,"color":"#hex","target_adr_min":X,"target_adr_max":Y,"target_los_min":A,"target_los_max":B,"source_countries":["XX"],"booking_channels":["Direct"],"yt_content_tags":["tag"],"property_use_case":"...","revenue_potential":"$X-Y per booking × N/year","outreach":"how to find them"}]`;

    const llm = await callAnthropic({ systemPrompt, userPrompt, maxTokens: 2000 });
    if (!isLlmOk(llm)) return NextResponse.json({ error: llm.error }, { status: 502 });

    const match = llm.text.match(/\[[\s\S]*\]/);
    const proposals = match ? JSON.parse(match[0]) : [];
    return NextResponse.json({ ok: true, proposals });
  }

  // Create new ICP
  const { data: newId, error } = await sb.rpc('fn_icp_upsert', {
    p_key: String(body.key ?? ''),
    p_name: String(body.name ?? ''),
    p_description: String(body.description ?? ''),
    p_icp_type: String(body.icp_type ?? 'b2c'),
    p_priority: Number(body.priority ?? 3),
    p_sort_order: Number(body.sort_order ?? 99),
    p_color: String(body.color ?? '#084838'),
    p_target_los_min: Number(body.target_los_min ?? 1),
    p_target_los_max: Number(body.target_los_max ?? 30),
    p_target_adr_min: Number(body.target_adr_min ?? 0),
    p_target_adr_max: Number(body.target_adr_max ?? 9999),
    p_source_countries: Array.isArray(body.source_countries) ? body.source_countries : [],
    p_booking_channels: Array.isArray(body.booking_channels) ? body.booking_channels : [],
    p_typical_pax_min: Number(body.typical_pax_min ?? 1),
    p_typical_pax_max: Number(body.typical_pax_max ?? 10),
    p_yt_content_tags: Array.isArray(body.yt_content_tags) ? body.yt_content_tags : [],
    p_newsletter_segment: body.newsletter_segment ? String(body.newsletter_segment) : null,
    p_property_use_case: body.property_use_case ? String(body.property_use_case) : null,
    p_daily_quota: Number(body.daily_quota ?? 0),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: newId });
}

// DELETE — deactivate by key
export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { key?: string };
  if (!body.key) return NextResponse.json({ error: 'missing key' }, { status: 400 });
  const sb = getSupabaseAdmin();
  const { error } = await sb.rpc('fn_icp_deactivate', { p_key: body.key });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
