// app/api/sales/proposals/[id]/email/preview/route.ts
// PBS 2026-07-16 — Renders the newsletter-quality proposal email as HTML.
// Query params:
//   format=json  → { subject, html }
//   default      → raw HTML with Content-Type: text/html
// Used by:
//   - Composer preview iframe.
//   - POST /send passes this HTML through to Make webhook for outbound delivery.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getProposalWithBlocks, getInquiry } from '@/lib/sales';
import { FX_LAK_PER_USD } from '@/lib/format';
import { renderProposalEmailHtml, type ProposalEmailContext, type ProposalBlockInput } from '@/lib/proposalEmailTemplate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx { params: { id: string } }

function nightCount(from: string | null | undefined, to: string | null | undefined): number {
  if (!from || !to) return 1;
  const d1 = new Date(from), d2 = new Date(to);
  return Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000));
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

export async function GET(req: Request, { params }: Ctx) {
  const url = new URL(req.url);
  const format = (url.searchParams.get('format') ?? 'html').toLowerCase();

  const { proposal, blocks, email } = await getProposalWithBlocks(params.id);
  if (!proposal) return NextResponse.json({ error: 'proposal_not_found' }, { status: 404 });

  const inq = proposal.inquiry_id ? await getInquiry(proposal.inquiry_id) : null;
  const dateIn = (proposal.date_in_snapshot ?? inq?.date_in ?? '') as string;
  const dateOut = (proposal.date_out_snapshot ?? inq?.date_out ?? '') as string;
  const nights = nightCount(dateIn, dateOut);
  const totalLak = blocks.reduce((s, b) => s + Number(b.total_lak ?? 0), 0);

  const propSnap = await loadPropertySnapshot(Number(proposal.property_id));
  const proto = process.env.VERCEL_URL ? 'https' : 'http';
  const host = process.env.VERCEL_URL ?? url.host;
  const base = `${proto}://${host}`;

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
    blocks: blocks.map((b): ProposalBlockInput => ({
      id: b.id, block_type: b.block_type, label: b.label,
      note: b.note, qty: b.qty, nights: b.nights,
      unit_price_lak: Number(b.unit_price_lak ?? 0),
      total_lak: Number(b.total_lak ?? 0),
      hero_asset_id: b.hero_asset_id ?? null,
      sort_order: b.sort_order ?? 100,
    })).sort((a, b) => a.sort_order - b.sort_order),
    total_lak: totalLak,
    fx_lak_per_usd: FX_LAK_PER_USD ?? 21800,
    property: propSnap,
    base_url: base,
  };

  const html = renderProposalEmailHtml(ctx);
  if (format === 'json') return NextResponse.json({ subject: ctx.subject, html, base_url: base });
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}
