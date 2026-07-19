// app/api/sales/proposals/[id]/email/preview/route.ts
// PBS 2026-07-20 · v6 · route rewrite forces fresh serverless cold-start.
// Root cause of 3-day empty preview: supabase-js in warm serverless
// instance cached the OLD RPC signature `_proposal_id` before rename.
// After rename to `p_proposal_id`, warm instance kept sending old param
// → PostgREST returned empty → route rendered blank cards.
// Redeploy = fresh instance = fresh schema fetch = param name matches.
// Single source: public.fn_proposal_preview_state RPC returns
// {proposal, blocks, offers, email} as one jsonb payload — bypasses the
// PostgREST-sales-schema silent-empty burn (see agent memory).
// v5: when property.brand.hero_image_url is NULL, fall back to best-scoring
// exterior/villa/landscape asset from media.media_assets so the newsletter
// header carries an image instead of blank cream.
// No shape normalizers. No diagnostic headers. No debug banners. No verbose
// console.error. If it breaks, DevTools > Network shows a 4xx JSON with `detail`.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getInquiry, type ProposalBlock } from '@/lib/sales';
import { FX_LAK_PER_USD } from '@/lib/format';
import {
  renderProposalEmailHtml,
  type ProposalEmailContext,
  type ProposalBlockInput,
  type ProposalRateOfferInput,
} from '@/lib/proposalEmailTemplate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx { params: { id: string } }

function nightCount(from: string | null | undefined, to: string | null | undefined): number {
  if (!from || !to) return 1;
  const d1 = new Date(from), d2 = new Date(to);
  return Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000));
}

// Hotel-wide hero fallback when property.brand.hero_image_url is NULL.
// Pulls the best-scoring exterior/villa/landscape asset from media.media_assets
// and returns a proxied /api/marketing/media/preview URL for it.
async function loadHotelHeroFallback(
  sb: ReturnType<typeof getSupabaseAdmin>,
  baseUrl: string,
): Promise<string | null> {
  const { data } = await sb.schema('media').from('media_assets')
    .select('asset_id, quality_index, technical_score, width_px, created_at, category, sub_category, property_area')
    .in('status', ['ready', 'tagged'])
    .gte('width_px', 1200)
    .or('category.in.(Exterior,Landscape,Grounds),sub_category.ilike.%exterior%,sub_category.ilike.%landscape%,sub_category.ilike.%villa%,sub_category.ilike.%pool%,sub_category.ilike.%river%,sub_category.ilike.%pavilion%')
    .limit(20);
  const rows = (data ?? []) as Array<Record<string, any>>;
  if (rows.length === 0) return null;
  rows.sort((a, b) => {
    const qa = Number(a.quality_index ?? 0), qb = Number(b.quality_index ?? 0);
    if (qa !== qb) return qb - qa;
    const ta = Number(a.technical_score ?? 0), tb = Number(b.technical_score ?? 0);
    if (ta !== tb) return tb - ta;
    return String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''));
  });
  const pick = rows[0]?.asset_id;
  return pick ? `${baseUrl}/api/marketing/media/preview?asset_id=${pick}` : null;
}

async function loadPropertySnapshot(propertyId: number) {
  const sb = getSupabaseAdmin();
  const [{ data: brand }, { data: loc }, { data: contacts }, { data: socials }] = await Promise.all([
    sb.schema('property').from('brand').select('hero_image_url, logo_url, brand_taglines, short_description, website_url').eq('property_id', propertyId).maybeSingle(),
    sb.schema('property').from('location').select('street_line_1, village, city, province, country').eq('property_id', propertyId).maybeSingle(),
    sb.schema('property').from('contacts').select('kind, purpose, value, is_primary, is_active, is_public').eq('property_id', propertyId),
    sb.schema('property').from('social').select('platform, url, active').eq('property_id', propertyId),
  ]);
  const b = (brand ?? {}) as Record<string, any>;
  const l = (loc ?? {}) as Record<string, any>;
  const cs = ((contacts ?? []) as Array<Record<string, any>>).filter(c => c.is_active !== false && c.is_public !== false);
  const so = ((socials ?? []) as Array<Record<string, any>>).filter(s => s.active !== false).map(s => ({ platform: s.platform, url: s.url }));

  function pick(kind: string, purpose?: string) {
    const primary = cs.find(c => c.kind === kind && (!purpose || c.purpose === purpose) && c.is_primary);
    return (primary ?? cs.find(c => c.kind === kind && (!purpose || c.purpose === purpose)))?.value ?? null;
  }

  const taglineRaw = Array.isArray(b.brand_taglines) && b.brand_taglines.length > 0 ? b.brand_taglines[0] : null;
  const logoRaw = b.logo_url && !String(b.logo_url).startsWith('[') ? b.logo_url : null;
  const heroRaw = b.hero_image_url && !String(b.hero_image_url).startsWith('[') ? b.hero_image_url : null;

  return {
    name: 'The Namkhan Luang Prabang',
    tagline: taglineRaw,
    logo_url: logoRaw,
    hero_image_url: heroRaw,
    address_lines: [l.street_line_1, l.village, l.city, l.province, l.country].filter(Boolean) as string[],
    website: b.website_url ?? null,
    phone: pick('phone', 'reservations'),
    whatsapp: pick('whatsapp', 'reservations'),
    email: pick('email', 'reservations'),
    socials: so,
  };
}

async function loadFactsheet(sb: ReturnType<typeof getSupabaseAdmin>, factsheetId: string) {
  if (!factsheetId) return null;
  const { data } = await sb.from('v_marketing_factsheets').select('doc_id,title,file_name,external_url').eq('doc_id', factsheetId).maybeSingle();
  return data as { doc_id: string; title: string; file_name: string | null; external_url: string | null } | null;
}

async function autoHeroForBlocks(
  sb: ReturnType<typeof getSupabaseAdmin>,
  blocks: ProposalBlock[],
): Promise<Record<string, string>> {
  const roomIds = new Set<number>();
  const activityBigints = new Set<number>();
  const labelLookups: Array<{ blockId: string; label: string }> = [];

  for (const b of blocks) {
    if (b.hero_asset_id) continue;
    if (b.block_type === 'room' && b.ref_id) {
      const n = Number(b.ref_id);
      if (Number.isFinite(n)) roomIds.add(n);
    } else if (b.block_type === 'activity' && b.ref_id) {
      if (/^\d+$/.test(b.ref_id)) activityBigints.add(Number(b.ref_id));
      else if (b.label) labelLookups.push({ blockId: b.id, label: b.label });
    }
  }

  const APPROVED_TIERS = ['ready', 'tagged'];
  function rank(a: any, b: any): number {
    const qa = Number(a.quality_index ?? 0), qb = Number(b.quality_index ?? 0);
    if (qa !== qb) return qb - qa;
    const ta = Number(a.technical_score ?? 0), tb = Number(b.technical_score ?? 0);
    if (ta !== tb) return tb - ta;
    return String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''));
  }

  const byRoom: Record<number, string> = {};
  if (roomIds.size > 0) {
    const { data } = await sb.schema('media').from('media_assets')
      .select('asset_id, room_type_id, quality_index, technical_score, created_at')
      .in('room_type_id', Array.from(roomIds))
      .in('status', APPROVED_TIERS);
    const ranked = ((data ?? []) as any[]).slice().sort(rank);
    for (const row of ranked) if (!byRoom[row.room_type_id]) byRoom[row.room_type_id] = row.asset_id as string;
  }

  const byActivity: Record<number, string> = {};
  if (activityBigints.size > 0) {
    const { data } = await sb.schema('media').from('media_assets')
      .select('asset_id, activity_id, quality_index, technical_score, created_at')
      .in('activity_id', Array.from(activityBigints))
      .in('status', APPROVED_TIERS);
    const ranked = ((data ?? []) as any[]).slice().sort(rank);
    for (const row of ranked) if (!byActivity[row.activity_id]) byActivity[row.activity_id] = row.asset_id as string;
  }

  const byLabel: Record<string, string> = {};
  if (labelLookups.length > 0) {
    for (const { blockId, label } of labelLookups) {
      const needle = label.trim().toLowerCase();
      if (!needle) continue;
      const words = Array.from(new Set([needle, ...needle.split(/\W+/).filter((w) => w.length >= 4)]));
      const cols = ['caption', 'alt_text', 'original_filename', 'sub_category', 'category'];
      const orExpr = words.flatMap((w) => cols.map((c) => `${c}.ilike.%${w.replace(/[%,()]/g, '')}%`)).join(',');
      if (!orExpr) continue;
      const { data } = await sb.schema('media').from('media_assets')
        .select('asset_id, quality_index, technical_score, created_at')
        .in('status', APPROVED_TIERS).or(orExpr).limit(25);
      const ranked = ((data ?? []) as any[]).slice().sort(rank);
      if (ranked.length > 0) byLabel[blockId] = ranked[0].asset_id as string;
    }
  }

  const out: Record<string, string> = {};
  for (const b of blocks) {
    if (b.hero_asset_id) continue;
    if (b.block_type === 'room' && b.ref_id) {
      const pick = byRoom[Number(b.ref_id)];
      if (pick) out[b.id] = pick;
    } else if (b.block_type === 'activity' && b.ref_id) {
      if (/^\d+$/.test(b.ref_id)) {
        const pick = byActivity[Number(b.ref_id)];
        if (pick) out[b.id] = pick;
      } else {
        const pick = byLabel[b.id];
        if (pick) out[b.id] = pick;
      }
    }
  }
  return out;
}

async function loadSender(
  sb: ReturnType<typeof getSupabaseAdmin>,
  createdBy: string | null | undefined,
): Promise<{ name: string; role: string; email: string; phone: string | null } | null> {
  if (!createdBy) return null;
  try {
    const { data } = await (sb as any).auth.admin.getUserById(createdBy);
    const u = data?.user ?? null;
    if (!u) return null;
    const meta = (u.user_metadata ?? {}) as Record<string, any>;
    const name = (meta.full_name || meta.name || meta.display_name || u.email || '').toString().trim();
    const role = (meta.role || meta.title || meta.job_title || 'Guest Services').toString().trim();
    if (!name || !u.email) return null;
    return { name, role, email: String(u.email), phone: (meta.phone as string) ?? null };
  } catch {
    return null;
  }
}

export async function GET(req: Request, { params }: Ctx) {
  const url = new URL(req.url);
  const format = (url.searchParams.get('format') ?? 'html').toLowerCase();
  const withPhotos = url.searchParams.get('with_photos') !== '0';
  const factsheetId = url.searchParams.get('factsheet_id') ?? '';

  const sb = getSupabaseAdmin();

  // Single SECURITY DEFINER RPC returns {proposal, blocks, offers, email} as jsonb.
  // supabase-js unwraps a jsonb-returning RPC into `data` as the plain object.
  const { data, error } = await sb.rpc('fn_proposal_preview_state', { p_proposal_id: params.id });

  const state = (data ?? {}) as {
    proposal?: any;
    blocks?: any[];
    offers?: any[];
    email?: any;
    error?: string;
  };

  if (error || state.error === 'proposal_not_found' || !state.proposal) {
    return NextResponse.json(
      { error: state.error ?? 'proposal_not_found', detail: error?.message ?? null },
      { status: 404 },
    );
  }

  const proposal = state.proposal;
  const blocks = (state.blocks ?? []) as any[];
  const offerRows = (state.offers ?? []) as any[];
  const email = state.email ?? null;

  const inq = proposal.inquiry_id ? await getInquiry(proposal.inquiry_id) : null;
  const dateIn = (proposal.date_in_snapshot ?? inq?.date_in ?? '') as string;
  const dateOut = (proposal.date_out_snapshot ?? inq?.date_out ?? '') as string;
  const nights = nightCount(dateIn, dateOut);
  const totalLak = blocks.reduce((s, b) => {
    const disc = Number(b.additional_discount_pct ?? 0);
    const unitEff = Number(b.unit_price_lak ?? 0) * (1 - Math.max(0, Math.min(100, disc)) / 100);
    return s + Number(b.qty ?? 1) * Number(b.nights ?? 1) * unitEff;
  }, 0);

  const proto = process.env.VERCEL_URL ? 'https' : 'http';
  const host = process.env.VERCEL_URL ?? url.host;
  const base = `${proto}://${host}`;

  const propSnap = await loadPropertySnapshot(Number(proposal.property_id));
  // PBS 2026-07-19 · per-proposal header photo override
  //   proposal.header_hero_hide       true  → suppress header hero entirely
  //   proposal.header_hero_asset_id   set   → use this specific asset
  //   else + brand.hero_image_url NULL      → auto-fallback (best exterior)
  if (proposal.header_hero_hide === true) {
    propSnap.hero_image_url = null;
  } else if (proposal.header_hero_asset_id) {
    propSnap.hero_image_url = `${base}/api/marketing/media/preview?asset_id=${proposal.header_hero_asset_id}`;
  } else if (!propSnap.hero_image_url) {
    const fallbackHero = await loadHotelHeroFallback(sb, base);
    if (fallbackHero) propSnap.hero_image_url = fallbackHero;
  }
  const factsheet = await loadFactsheet(sb, factsheetId);
  const heroFallback = withPhotos ? await autoHeroForBlocks(sb, blocks as ProposalBlock[]) : {};
  const sender = await loadSender(sb, proposal.created_by ?? null);

  const rateOffers: ProposalRateOfferInput[] = offerRows.map((o: any) => ({
    id: o.id,
    rate_plan_id: o.rate_plan_id,
    position: Number(o.position ?? 1),
    label: o.label ?? null,
    payment_terms: o.payment_terms ?? null,
    cancellation_terms: o.cancellation_terms ?? null,
    unit_price_lak: o.unit_price_lak != null ? Number(o.unit_price_lak) : null,
    total_lak: o.total_lak != null ? Number(o.total_lak) : null,
  }));

  const ctx: ProposalEmailContext = {
    proposal_id: params.id,
    public_token: proposal.public_token ?? null,
    guest_name: (proposal.guest_name_snapshot ?? inq?.guest_name ?? 'guest') as string,
    date_in: dateIn,
    date_out: dateOut,
    nights,
    subject: email?.subject ?? `Your stay at ${propSnap.name}`,
    intro_md: email?.intro_md ?? '',
    outro_md: email?.outro_md ?? '',
    ps_md: email?.ps_md ?? null,
    blocks: blocks.map((b: any): ProposalBlockInput => {
      const disc = Number(b.additional_discount_pct ?? 0);
      const unitEff = Number(b.unit_price_lak ?? 0) * (1 - Math.max(0, Math.min(100, disc)) / 100);
      const totalEff = Number(b.qty ?? 1) * Number(b.nights ?? 1) * unitEff;
      return {
        id: b.id, block_type: b.block_type, label: b.label,
        note: b.note, qty: b.qty, nights: b.nights,
        unit_price_lak: unitEff,
        total_lak: totalEff,
        hero_asset_id: withPhotos ? ((b.hero_asset_id ?? heroFallback[b.id]) ?? null) : null,
        sort_order: b.sort_order ?? 100,
      };
    }).sort((a, b) => a.sort_order - b.sort_order),
    rate_offers: rateOffers,
    total_lak: totalLak,
    fx_lak_per_usd: FX_LAK_PER_USD ?? 21800,
    property: propSnap,
    base_url: base,
    factsheet: factsheet ? {
      doc_id: factsheet.doc_id,
      title: factsheet.title,
      url: factsheet.external_url ?? (base + '/documents/' + factsheet.doc_id),
    } : null,
    sender,
  };

  const html = renderProposalEmailHtml(ctx);

  if (format === 'json') {
    return NextResponse.json({ subject: ctx.subject, html, base_url: base });
  }

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0, private',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store',
      'CDN-Cache-Control': 'no-store',
      'Vercel-CDN-Cache-Control': 'no-store',
    },
  });
}
