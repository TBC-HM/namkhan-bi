// app/api/sales/icp/route.ts — ICP CRUD + AI market research propose
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { callAnthropic, isLlmOk } from '@/lib/youtube/skills-common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NAMKHAN = 260955;

export async function GET() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from('v_icp_89day_performance' as any).select('*').order('sort_order');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, icps: data });
}

export async function POST(req: NextRequest) {
  const sb = getSupabaseAdmin();
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;

  if (body.action === 'propose') {
    // ── Market Research Loop ──────────────────────────────────────────────
    // Looks OUTWARD at global travel trends, NOT at internal guest data.
    // Evidence sources:
    //   1. YouTube trend data (v_yt_trend_briefs) — what people search & watch
    //   2. Claude training knowledge — global luxury/wellness/retreat market
    //   3. Current ICP performance — only as validation (what already works)
    //   4. The Namkhan infrastructure — what makes it a genuine fit

    // Fetch YouTube trend data as market signal
    const { data: trendBriefs } = await sb.from('v_yt_trend_briefs')
      .select('keyword_seeds, activation_score, candidate_angles')
      .eq('property_id', NAMKHAN)
      .order('activation_score', { ascending: false })
      .limit(20);

    // Fetch current ICP performance (validation context only)
    const { data: currentIcps } = await sb.from('v_icp_89day_performance' as any)
      .select('key,name,bookings_89d,revenue_89d,avg_adr_89d,source_countries')
      .order('sort_order');

    // Fetch reality profile for brand positioning context
    const { data: reality } = await sb.from('v_reality_profile')
      .select('vibe,brand_voice,positioning')
      .eq('property_id', NAMKHAN)
      .maybeSingle();

    const trendSummary = (trendBriefs ?? []).map((t: Record<string,unknown>) => {
      const angles = Array.isArray(t.candidate_angles) ? t.candidate_angles : [];
      const topAngle = (angles[0] as Record<string,unknown> | undefined);
      return `Keyword [${(t.keyword_seeds as string[])?.join(',')}] score=${t.activation_score} — top video: "${topAngle?.title ?? ''}" (${topAngle?.views ?? 0} views)`;
    }).join('\n');

    const currentIcpSummary = (currentIcps ?? []).map((i: Record<string,unknown>) =>
      `${i.key}: ${i.bookings_89d} stays, $${i.revenue_89d} rev, $${i.avg_adr_89d} ADR`
    ).join('\n');

    const systemPrompt = `You are a luxury travel market research strategist specializing in boutique hospitality in Southeast Asia.

THE NAMKHAN — PROPERTY BRIEF:
- Location: Luang Prabang, Laos · Nam Khan / Mekong confluence
- Scale: 24 rooms (allows semi-buyout for groups of 10-20)
- Collection: Small Luxury Hotels of the World (SLH) · Considerate Collection
- Infrastructure: Yoga Pavilion · Jungle Spa (treatments, ice bath, sauna) · ROOTS organic restaurant · organic farm · river beach · cultural proximity (monks, temples, craft villages)
- Vibe: ${reality?.vibe ?? 'Refined, understated, nature-immersed, culturally authentic'}
- Brand voice: ${reality?.brand_voice ?? 'Quiet luxury. Authentic Laos. No fuss.'}
- Positioning: ${reality?.positioning ?? '5-star boutique. SLH member. Nature + culture + silence.'}

YOUR TASK:
Research and propose 2-4 new Ideal Customer Profile (ICP) opportunities for The Namkhan based on GLOBAL MARKET TRENDS — not on existing guest analysis. Look outward.

For each proposal you MUST include:
1. Market evidence: global statistics, growth rates, market size (use your training knowledge)
2. Why The Namkhan specifically is a genuine fit for this ICP (not generic boutique hotel — specifically The Namkhan)
3. How this ICP discovers and books (Instagram? Google? Retreat directories? LinkedIn? SLH? DMC?)
4. What they will pay and for how long (realistic ADR range, LOS)
5. Revenue potential per booking/group
6. What content would attract them (YouTube angles, email subject lines)

Do NOT propose ICPs that don't fit a 5-star SLH Considerate Collection property. Do NOT propose volume/price-sensitive segments.`;

    const userPrompt = `YOUTUBE TREND SIGNALS (what travelers search and watch):
${trendSummary || '[No trend data yet — run scan-trends from the YouTube Spy tab]'}

CURRENT ICPs ALREADY ACTIVE (for context — do not duplicate these):
${currentIcpSummary}

Research and propose NEW ICP opportunities The Namkhan is not yet targeting. Focus on:
- Global wellness and retreat travel market growth (yoga, meditation, somatic, breathwork)
- Corporate leadership and executive wellness offsite trends (Asia-Pacific)
- Luxury slow travel segments by source market (India, UAE, Japan, Korea, Israel, Nordic)
- Emerging travel niches that match The Namkhan's specific assets (river, organic farm, yoga pavilion, Luang Prabang cultural context)

Return a JSON array:
[{
  "key": "slug-no-spaces",
  "name": "ICP Display Name",
  "research_reason": "Market evidence: [statistics/trends] + Why The Namkhan is the right venue for this ICP",
  "description": "Full persona description — who they are, why they travel, what they seek",
  "icp_type": "b2b or b2c",
  "priority": 1,
  "color": "#hex",
  "target_adr_min": 0,
  "target_adr_max": 0,
  "target_los_min": 0,
  "target_los_max": 0,
  "source_countries": ["XX"],
  "booking_channels": ["Direct"],
  "typical_pax_min": 1,
  "typical_pax_max": 10,
  "yt_content_tags": ["tag1"],
  "newsletter_segment": "slug",
  "property_use_case": "How The Namkhan serves this ICP specifically",
  "revenue_potential": "$X,000 per booking · X bookings/year potential",
  "outreach": "How to find and reach this ICP"
}]`;

    const llm = await callAnthropic({ systemPrompt, userPrompt, maxTokens: 3000 });
    if (!isLlmOk(llm)) return NextResponse.json({ error: llm.error }, { status: 502 });
    const match = llm.text.match(/\[[\s\S]*\]/);
    const proposals = match ? JSON.parse(match[0]) as unknown[] : [];
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
    p_source_countries: Array.isArray(body.source_countries) ? body.source_countries as string[] : [],
    p_booking_channels: Array.isArray(body.booking_channels) ? body.booking_channels as string[] : [],
    p_typical_pax_min: Number(body.typical_pax_min ?? 1),
    p_typical_pax_max: Number(body.typical_pax_max ?? 10),
    p_yt_content_tags: Array.isArray(body.yt_content_tags) ? body.yt_content_tags as string[] : [],
    p_newsletter_segment: body.newsletter_segment ? String(body.newsletter_segment) : null,
    p_property_use_case: body.property_use_case ? String(body.property_use_case) : null,
    p_daily_quota: Number(body.daily_quota ?? 0),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: newId });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { key?: string };
  if (!body.key) return NextResponse.json({ error: 'missing key' }, { status: 400 });
  const sb = getSupabaseAdmin();
  const { error } = await sb.rpc('fn_icp_deactivate', { p_key: body.key });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
