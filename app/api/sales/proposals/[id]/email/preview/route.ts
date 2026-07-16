// app/api/sales/proposals/[id]/email/preview/route.ts
// PBS 2026-07-16 — Renders the newsletter-quality proposal email as HTML.
// Query params:
//   format=json  → { subject, html }
//   default      → raw HTML with Content-Type: text/html
// Used by:
//   - Composer preview iframe.
//   - POST /send passes this HTML through to Make webhook for outbound delivery.
//
// PBS 2026-07-16 (item 6) — when a block has no hero_asset_id, fall back to the
// best marketing-tier asset for the linked room_type / activity so previews are
// never empty. Fallback is preview-only; the DB is not mutated.
// PBS 2026-07-16 (item 10) — sender signature resolved from proposal.created_by
// via auth.users; fallback to the Reservations desk.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getProposalWithBlocks, getInquiry, type ProposalBlock } from '@/lib/sales';
import { FX_LAK_PER_USD } from '@/lib/format';
import { renderProposalEmailHtml, type ProposalEmailContext, type ProposalBlockInput, type ProposalRateOfferInput } from '@/lib/proposalEmailTemplate';

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

async function loadFactsheet(sb: ReturnType<typeof getSupabaseAdmin>, factsheetId: string) {
  // PBS 2026-07-16 (item 5) — fetch factsheet metadata for footer chip.
  if (!factsheetId) return null;
  const { data } = await sb.from('v_marketing_factsheets').select('doc_id,title,file_name,external_url').eq('doc_id', factsheetId).maybeSingle();
  return data as { doc_id: string; title: string; file_name: string | null; external_url: string | null } | null;
}

// PBS 2026-07-16 (item 6 + follow-up) — for each block that is missing a
// hero_asset_id, resolve the best marketing-tier candidate from
// media.media_assets. Ranking within each candidate set:
//   status IN ('ready','tagged')     — the Namkhan asset_status enum has no
//                                       'approved'; 'ready' + 'tagged' are the
//                                       marketing-approved tiers.
//   quality_index DESC NULLS LAST → technical_score DESC NULLS LAST → created_at DESC
//
// Three block-type paths:
//   1) block_type='room'      → media_assets.room_type_id = Number(ref_id)
//   2) block_type='activity'  → if ref_id is a bigint (new content.activities pick),
//                               join on media_assets.activity_id = Number(ref_id).
//   3) block_type='activity'  → if ref_id is a UUID (legacy sales.activity_catalog
//                               pick), fall back to LABEL MATCH on caption /
//                               alt_text / original_filename / sub_category. This is
//                               imperfect but "any thumbnail" beats "text-only" for
//                               the preview iframe.
//
// This is preview-only — we do NOT persist the fallback back to
// sales.proposal_blocks. The composer's explicit photo picker is still the
// canonical way to set a hero.
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
      continue;
    }
    if (b.block_type === 'activity' && b.ref_id) {
      if (/^\d+$/.test(b.ref_id)) {
        activityBigints.add(Number(b.ref_id));
      } else if (b.label) {
        // Legacy sales.activity_catalog UUIDs → fall back to label match.
        labelLookups.push({ blockId: b.id, label: b.label });
      }
    }
  }

  const APPROVED_TIERS = ['ready', 'tagged'];

  // Rank helper — quality_index → technical_score → created_at.
  function rank(a: any, b: any): number {
    const qa = Number(a.quality_index ?? 0), qb = Number(b.quality_index ?? 0);
    if (qa !== qb) return qb - qa;
    const ta = Number(a.technical_score ?? 0), tb = Number(b.technical_score ?? 0);
    if (ta !== tb) return tb - ta;
    return String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''));
  }

  const byRoom: Record<number, string> = {};
  if (roomIds.size > 0) {
    const { data } = await sb
      .schema('media')
      .from('media_assets')
      .select('asset_id, room_type_id, quality_index, technical_score, created_at')
      .in('room_type_id', Array.from(roomIds))
      .in('status', APPROVED_TIERS);
    const ranked = ((data ?? []) as any[]).slice().sort(rank);
    for (const row of ranked) {
      if (!byRoom[row.room_type_id]) byRoom[row.room_type_id] = row.asset_id as string;
    }
  }

  const byActivity: Record<number, string> = {};
  if (activityBigints.size > 0) {
    const { data } = await sb
      .schema('media')
      .from('media_assets')
      .select('asset_id, activity_id, quality_index, technical_score, created_at')
      .in('activity_id', Array.from(activityBigints))
      .in('status', APPROVED_TIERS);
    const ranked = ((data ?? []) as any[]).slice().sort(rank);
    for (const row of ranked) {
      if (!byActivity[row.activity_id]) byActivity[row.activity_id] = row.asset_id as string;
    }
  }

  // Label match for legacy activity blocks. We build one OR-of-ilike query per
  // unique label so a single round-trip covers all lookups.
  const byLabel: Record<string, string> = {};
  if (labelLookups.length > 0) {
    for (const { blockId, label } of labelLookups) {
      const needle = label.trim().toLowerCase();
      if (!needle) continue;
      // First try the full label, then split into words ≥4 chars to widen the net
      // (so "MotoLao countryside ride" also matches "motorbike" via caption text).
      const words = Array.from(new Set([
        needle,
        ...needle.split(/\W+/).filter((w) => w.length >= 4),
      ]));
      // Build a supabase-js .or() filter: ilike matches on any of the guest-facing text columns.
      const cols = ['caption', 'alt_text', 'original_filename', 'sub_category', 'category'];
      const orExpr = words
        .flatMap((w) => cols.map((c) => `${c}.ilike.%${w.replace(/[%,()]/g, '')}%`))
        .join(',');
      if (!orExpr) continue;
      const { data } = await sb
        .schema('media')
        .from('media_assets')
        .select('asset_id, quality_index, technical_score, created_at')
        .in('status', APPROVED_TIERS)
        .or(orExpr)
        .limit(25);
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

// PBS 2026-07-16 (item 10) — resolve the sender from proposal.created_by.
// auth.users lives in the `auth` schema and requires service-role access.
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
  // PBS 2026-07-16 (item 4) — with_photos=0 strips hero_asset_id from every block
  // so PBS can send a text-only proposal without editing each block by hand.
  const withPhotos = url.searchParams.get('with_photos') !== '0';
  const factsheetId = url.searchParams.get('factsheet_id') ?? '';

  const { proposal, blocks, email } = await getProposalWithBlocks(params.id);
  if (!proposal) return NextResponse.json({ error: 'proposal_not_found' }, { status: 404 });

  // PBS 2026-07-17 — diagnostic: on empty blocks, cross-check via a second
  // service-role query bypassing supabase-js's helper. Surfaces the divergence
  // as both a response header and an inline banner so the composer iframe
  // reveals the real failure mode (schema not exposed / cache / RLS drift).
  let diagBlockCountFromServiceRole: number | null = null;
  let diagBlockErr: string | null = null;
  if (blocks.length === 0) {
    try {
      const sbDiag = getSupabaseAdmin();
      const probe = await sbDiag
        .schema('sales')
        .from('proposal_blocks')
        .select('id', { count: 'exact', head: true })
        .eq('proposal_id', params.id);
      diagBlockCountFromServiceRole = probe.count ?? null;
      diagBlockErr = probe.error ? `${probe.error.code ?? ''}:${probe.error.message ?? ''}` : null;
      console.error('[preview.diag] blocks empty', {
        proposal_id: params.id,
        service_role_count: diagBlockCountFromServiceRole,
        error: diagBlockErr,
      });
    } catch (e) {
      diagBlockErr = String((e as Error)?.message ?? e);
      console.error('[preview.diag] probe threw', diagBlockErr);
    }
  }

  const inq = proposal.inquiry_id ? await getInquiry(proposal.inquiry_id) : null;
  const dateIn = (proposal.date_in_snapshot ?? inq?.date_in ?? '') as string;
  const dateOut = (proposal.date_out_snapshot ?? inq?.date_out ?? '') as string;
  const nights = nightCount(dateIn, dateOut);
  // PBS 2026-07-16 (item 5) — sum with per-block additional_discount_pct applied.
  const totalLak = blocks.reduce((s, b) => {
    const disc = Number(b.additional_discount_pct ?? 0);
    const unitEff = Number(b.unit_price_lak ?? 0) * (1 - Math.max(0, Math.min(100, disc)) / 100);
    return s + Number(b.qty ?? 1) * Number(b.nights ?? 1) * unitEff;
  }, 0);

  const propSnap = await loadPropertySnapshot(Number(proposal.property_id));
  const sb = getSupabaseAdmin();
  const factsheet = await loadFactsheet(sb, factsheetId);
  // PBS 2026-07-16 item 6 — resolve fallback hero photos for blocks missing hero_asset_id.
  const heroFallback = withPhotos ? await autoHeroForBlocks(sb, blocks) : {};
  // PBS 2026-07-16 item 10 — sender signature.
  const sender = await loadSender(sb, (proposal as unknown as { created_by: string | null }).created_by);
  // PBS 2026-07-16 (Feature A) — multi-rate offers side-by-side in the email.
  // Empty or length 1 → template falls back to single-card layout automatically.
  const { data: offerRows } = await sb
    .schema('sales')
    .from('proposal_rate_offers')
    .select('id, rate_plan_id, position, label, payment_terms, cancellation_terms, unit_price_lak, total_lak')
    .eq('proposal_id', params.id)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  const rateOffers: ProposalRateOfferInput[] = ((offerRows ?? []) as ProposalRateOfferInput[]).map((o) => ({
    id: o.id,
    rate_plan_id: o.rate_plan_id,
    position: Number(o.position ?? 1),
    label: o.label ?? null,
    payment_terms: o.payment_terms ?? null,
    cancellation_terms: o.cancellation_terms ?? null,
    unit_price_lak: o.unit_price_lak != null ? Number(o.unit_price_lak) : null,
    total_lak: o.total_lak != null ? Number(o.total_lak) : null,
  }));
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
    blocks: blocks.map((b): ProposalBlockInput => {
      // PBS 2026-07-16 (item 5) — apply per-block additional_discount_pct at render time,
      // so the stored total_lak stays the base price (undiscounted).
      const disc = Number(b.additional_discount_pct ?? 0);
      const unitEff = Number(b.unit_price_lak ?? 0) * (1 - Math.max(0, Math.min(100, disc)) / 100);
      const totalEff = Number(b.qty ?? 1) * Number(b.nights ?? 1) * unitEff;
      return {
        id: b.id, block_type: b.block_type, label: b.label,
        note: b.note, qty: b.qty, nights: b.nights,
        unit_price_lak: unitEff,
        total_lak: totalEff,
        // PBS 2026-07-16 (item 4 + 6) — honour master toggle, then use auto-hero fallback.
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

  let html = renderProposalEmailHtml(ctx);
  // PBS 2026-07-17 — prepend an inline red diagnostic banner when the composer
  // iframe would otherwise render an empty stay ($0, no cards). This makes the
  // failure mode visible instead of silent.
  if (blocks.length === 0 && (diagBlockCountFromServiceRole ?? 0) > 0) {
    const banner = `<div style="padding:12px 18px;background:#8B0000;color:#fff;font-family:system-ui;font-size:12px;letter-spacing:0.02em">DIAG · sales.proposal_blocks reports ${diagBlockCountFromServiceRole} row(s) but helper returned 0. err=${(diagBlockErr ?? 'none')} · proposal=${params.id}</div>`;
    html = banner + html;
  } else if (blocks.length === 0) {
    const banner = `<div style="padding:12px 18px;background:#7a5500;color:#fff;font-family:system-ui;font-size:12px;letter-spacing:0.02em">DIAG · No blocks yet for this proposal. Add a room from the composer before previewing.</div>`;
    html = banner + html;
  }

  if (format === 'json') return NextResponse.json({
    subject: ctx.subject,
    html,
    base_url: base,
    diag: {
      block_count_helper: blocks.length,
      block_count_probe: diagBlockCountFromServiceRole,
      block_probe_err: diagBlockErr,
      email_present: !!email,
    },
  });
  // PBS 2026-07-16 — aggressive no-cache; browser + service worker were serving
  // stale preview responses even though the client bumped the ?v= param.
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type':  'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0, private',
      'Pragma':        'no-cache',
      'Expires':       '0',
      'X-Preview-Rendered-At': new Date().toISOString(),
      'X-Block-Count-Helper': String(blocks.length),
      'X-Block-Count-Probe':  String(diagBlockCountFromServiceRole ?? ''),
      'X-Block-Probe-Err':    (diagBlockErr ?? '').slice(0, 200),
      'Surrogate-Control':     'no-store',
      'CDN-Cache-Control':     'no-store',
      'Vercel-CDN-Cache-Control': 'no-store',
    },
  });
}
