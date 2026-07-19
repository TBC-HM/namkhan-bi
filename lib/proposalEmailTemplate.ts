// lib/proposalEmailTemplate.ts
// PBS 2026-07-18 — Newsletter-frame outbound email for the Sales Proposal composer.
// Frame matches app/guest/newsletters/[campaign_id]/preview/page.tsx exactly:
//   HEADER: cream band · brass hairline · THE NAMKHAN wordmark · Luang Prabang · SLH tagline
//   BODY:   intro copy · block cards · offer cards · totals · outro · P.S. · CTA · factsheet · signature
//   FOOTER: cream band · brass hairline · SLH logo · address · IG/FB/TikTok · unsubscribe
//
// Palette locked:
//   #FFFFFF paper · #F7F0E1 cream · #E6DFCC hairline · #C79A6B brass · #084838 forest green
//   #1B1B1B ink · #5A5A5A ink-soft
//
// Email-safe: tables + inline styles. Same pattern as supabase/functions/render-revenue-report.

const PAPER = '#FFFFFF';
const CREAM = '#F7F0E1';
const HAIRLINE = '#E6DFCC';
const BRASS = '#C79A6B';
const INK = '#1B1B1B';
const INK_SOFT = '#5A5A5A';
const PRIMARY = '#084838';
const SANS = '-apple-system,"SF Pro Text",Helvetica,Arial,sans-serif';
const SERIF = 'Georgia,"Times New Roman",serif';

const SLH_BLACK = 'https://kpenyneooigsyuuomgct.supabase.co/storage/v1/object/public/branding/slh_black.png';

export interface ProposalBlockInput {
  id: string;
  block_type: string;
  label: string;
  note?: string | null;
  qty: number;
  nights: number;
  unit_price_lak: number;
  total_lak: number;
  hero_asset_id?: string | null;
  sort_order: number;
}

export interface ProposalRateOfferInput {
  id: string;
  rate_plan_id: string;
  position: number;
  label: string | null;
  payment_terms: string | null;
  cancellation_terms: string | null;
  unit_price_lak: number | null;
  total_lak: number | null;
}

export interface ProposalEmailContext {
  proposal_id: string;
  public_token: string | null;
  guest_name: string;
  date_in: string;   // YYYY-MM-DD
  date_out: string;
  nights: number;
  subject: string;
  intro_md: string;
  outro_md: string;
  ps_md: string | null;
  blocks: ProposalBlockInput[];
  rate_offers?: ProposalRateOfferInput[];
  total_lak: number;
  fx_lak_per_usd: number;
  property: {
    name: string;
    tagline?: string | null;
    logo_url?: string | null;
    hero_image_url?: string | null;
    address_lines: string[];
    website?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
    email?: string | null;
    socials: Array<{ platform: string; url: string }>;
  };
  base_url: string;
  factsheet?: { doc_id: string; title: string; url: string | null } | null;
  sender?: {
    name: string;
    role: string;
    email: string;
    phone?: string | null;
  } | null;
}

function esc(s: string): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

function fmtUsd(lak: number, fx: number): string {
  const usd = Number(lak) / (fx || 21800);
  return `$${usd.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function fmtDate(iso: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso + 'T00:00:00Z');
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  } catch { return iso; }
}

function mdToHtml(md: string): string {
  if (!md) return '';
  return md.split(/\n{2,}/)
    .map(p => `<p style="margin:0 0 12px 0;font-family:${SERIF};font-size:15px;line-height:1.75;color:${INK}">${esc(p).replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

function heroImgSrc(ctx: ProposalEmailContext, assetId: string | null | undefined): string | null {
  if (!assetId) return null;
  return `${ctx.base_url}/api/marketing/media/preview?asset_id=${assetId}`;
}

const BLOCK_TYPE_LABEL: Record<string, string> = {
  room: 'Accommodation',
  activity: 'Experience',
  fnb: 'Dining',
  spa: 'Spa',
  transfer: 'Transfer',
  note: 'Note',
};

// ---------- NEWSLETTER FRAME · HEADER ----------
// Mirrors app/guest/newsletters/[campaign_id]/preview/page.tsx lines 100-114
function newsletterHeader(): string {
  return `<tr><td style="padding:28px 24px 18px 24px;text-align:center;background:${CREAM};border-bottom:2px solid ${BRASS}">
    <div style="font-family:${SERIF};font-size:26px;font-weight:400;letter-spacing:0.34em;color:${PRIMARY};margin-bottom:6px">THE NAMKHAN</div>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto"><tr>
      <td style="padding:0 10px 4px 0"><div style="height:1px;width:36px;background:${BRASS};line-height:1px;font-size:0">&nbsp;</div></td>
      <td style="font-family:${SANS};font-size:9px;letter-spacing:0.22em;color:${INK_SOFT};text-transform:uppercase;padding-bottom:4px">Luang Prabang · Laos</td>
      <td style="padding:0 0 4px 10px"><div style="height:1px;width:36px;background:${BRASS};line-height:1px;font-size:0">&nbsp;</div></td>
    </tr></table>
    <div style="margin-top:10px;font-family:${SANS};font-size:8px;letter-spacing:0.30em;color:${INK_SOFT};text-transform:uppercase;font-style:italic">A Small Luxury Hotel of the World</div>
  </td></tr>`;
}

// Proposal-specific sub-header inside the frame (below hero photo, above intro copy)
function proposalTitleBlock(ctx: ProposalEmailContext): string {
  return `<tr><td style="padding:26px 32px 6px 32px;background:${PAPER};text-align:center">
    <div style="font-family:${SANS};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${INK_SOFT};margin-bottom:8px">Proposal for ${esc(ctx.guest_name)}</div>
    <div style="font-family:${SERIF};font-size:24px;color:${PRIMARY};line-height:1.2;margin-bottom:8px">${esc(fmtDate(ctx.date_in))} → ${esc(fmtDate(ctx.date_out))}</div>
    <div style="font-family:${SANS};font-size:12px;color:${INK_SOFT};letter-spacing:0.06em;text-transform:uppercase">${ctx.nights} ${ctx.nights === 1 ? 'night' : 'nights'} · ${ctx.blocks.reduce((s,b)=>s+Number(b.qty??1),0)} room${ctx.blocks.reduce((s,b)=>s+Number(b.qty??1),0)===1?'':'s'}</div>
  </td></tr>`;
}

// Optional hero image below newsletter header
function heroBlock(ctx: ProposalEmailContext): string {
  const hero = ctx.property.hero_image_url;
  if (!hero) return '';
  return `<tr><td style="padding:0;background:${PAPER}">
    <img src="${esc(hero)}" alt="${esc(ctx.property.name)}" style="width:100%;max-width:640px;height:auto;display:block;border:0"/>
  </td></tr>`;
}

function blockCard(ctx: ProposalEmailContext, b: ProposalBlockInput): string {
  const heroUrl = heroImgSrc(ctx, b.hero_asset_id);
  const totalUsd = fmtUsd(Number(b.total_lak), ctx.fx_lak_per_usd);
  // PBS 2026-07-20 · activities show "pax" not "nights". Rooms keep "N × M nights".
  const isActivity = b.block_type === 'activity' || b.block_type === 'fnb' || b.block_type === 'spa';
  const meta = isActivity
    ? `${b.qty} ${b.qty === 1 ? 'pax' : 'pax'}`
    : `${b.qty} × ${b.nights} ${b.nights === 1 ? 'night' : 'nights'}`;
  const kind = (BLOCK_TYPE_LABEL[b.block_type] ?? b.block_type).toUpperCase();
  const heroCell = heroUrl ? `<td style="width:200px;padding:0;vertical-align:top"><img src="${heroUrl}" alt="${esc(b.label)}" width="200" style="display:block;width:200px;height:150px;object-fit:cover;border-radius:4px 0 0 4px;border:0"/></td>` : '';
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0;border-collapse:separate;border:1px solid ${HAIRLINE};border-radius:6px;background:${PAPER};overflow:hidden">
      <tr>
        ${heroCell}
        <td style="padding:16px 18px;vertical-align:top">
          <div style="font-family:${SANS};font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${INK_SOFT};margin-bottom:4px">${esc(kind)}</div>
          <div style="font-family:${SERIF};font-size:17px;color:${INK};margin-bottom:6px">${esc(b.label)}</div>
          ${b.note ? `<div style="font-family:${SANS};font-size:13px;color:${INK_SOFT};line-height:1.5;margin-bottom:10px">${esc(b.note)}</div>` : ''}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="font-family:${SANS};font-size:12px;color:${INK_SOFT}">${esc(meta)}</td>
            <td align="right" style="font-family:${SANS};font-size:15px;font-weight:600;color:${PRIMARY}">${totalUsd}</td>
          </tr></table>
        </td>
      </tr>
    </table>`;
}

function rateOffersBlock(ctx: ProposalEmailContext): string {
  const offers = (ctx.rate_offers ?? []).slice(0, 3);
  if (offers.length === 0) return '';
  const publicUrl = ctx.public_token ? `${ctx.base_url}/p/${ctx.public_token}` : '';

  const cells = offers.map((o) => {
    const label = (o.label && o.label.trim()) || 'Rate offer';
    const nightlyUsd = o.unit_price_lak != null ? fmtUsd(Number(o.unit_price_lak), ctx.fx_lak_per_usd) : null;
    const totalUsd = o.total_lak != null ? fmtUsd(Number(o.total_lak), ctx.fx_lak_per_usd) : null;
    const bookUrl = publicUrl ? `${publicUrl}?rate=${encodeURIComponent(o.id)}` : '';
    const pay = (o.payment_terms && o.payment_terms.trim()) || 'Pay at property';
    const cancel = (o.cancellation_terms && o.cancellation_terms.trim()) || 'Free cancellation until 7 days before arrival';
    return `<td valign="top" style="padding:0 6px;vertical-align:top">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border:1px solid ${HAIRLINE};border-radius:6px;background:${PAPER};overflow:hidden">
        <tr><td style="padding:14px 14px 4px 14px">
          <div style="font-family:${SANS};font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${INK_SOFT};margin-bottom:4px">Offer ${o.position}</div>
          <div style="font-family:${SERIF};font-size:16px;color:${INK};line-height:1.25;margin-bottom:8px">${esc(label)}</div>
          ${nightlyUsd ? `<div style="font-family:${SANS};font-size:12px;color:${INK_SOFT};margin-bottom:2px">${nightlyUsd} / night</div>` : ''}
          ${totalUsd ? `<div style="font-family:${SANS};font-size:18px;font-weight:600;color:${PRIMARY};margin-bottom:10px;font-variant-numeric:tabular-nums">${totalUsd} <span style="font-size:11px;font-weight:400;color:${INK_SOFT};letter-spacing:0.08em;text-transform:uppercase">total</span></div>` : ''}
        </td></tr>
        <tr><td style="padding:0 14px 6px 14px">
          <div style="font-family:${SANS};font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:${INK_SOFT};margin-bottom:3px">Payment</div>
          <div style="font-family:${SANS};font-size:12px;color:${INK};line-height:1.45;margin-bottom:10px">${esc(pay)}</div>
          <div style="font-family:${SANS};font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:${INK_SOFT};margin-bottom:3px">Cancellation</div>
          <div style="font-family:${SANS};font-size:12px;color:${INK};line-height:1.45;margin-bottom:12px">${esc(cancel)}</div>
        </td></tr>
        ${bookUrl ? `<tr><td style="padding:0 14px 14px 14px">
          <a href="${esc(bookUrl)}" style="display:block;text-align:center;padding:10px 12px;background:${PRIMARY};color:#FFFFFF;font-family:${SANS};font-size:12px;font-weight:600;text-decoration:none;letter-spacing:0.02em;border-radius:4px">Book this rate →</a>
        </td></tr>` : ''}
      </table>
    </td>`;
  }).join('');

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;margin:6px 0;table-layout:fixed">
    <tr><td colspan="${offers.length}" style="padding:0 6px 8px 6px">
      <div style="font-family:${SANS};font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:${INK_SOFT}">Choose your rate</div>
    </td></tr>
    <tr>${cells}</tr>
    <tr><td colspan="${offers.length}" style="padding:6px 6px 0 6px;font-family:${SANS};font-size:11px;color:${INK_SOFT};line-height:1.5">
      Prices per room / night, include 10% Lao VAT and 10% service charge. Click a card to open the guest page and confirm your rate.
    </td></tr>
  </table>`;
}

function pricingTable(ctx: ProposalEmailContext): string {
  const totalUsd = fmtUsd(Number(ctx.total_lak), ctx.fx_lak_per_usd);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:14px 0 4px 0">
    <tr>
      <td style="padding:14px 10px;font-family:${SERIF};font-size:16px;color:${INK};border-top:2px solid ${PRIMARY}">Stay total · ${ctx.nights} ${ctx.nights === 1 ? 'night' : 'nights'}</td>
      <td align="right" style="padding:14px 10px;font-family:${SERIF};font-size:20px;font-weight:600;color:${PRIMARY};border-top:2px solid ${PRIMARY};font-variant-numeric:tabular-nums">${totalUsd}</td>
    </tr>
  </table>`;
}

function ctaBlock(ctx: ProposalEmailContext): string {
  if (!ctx.public_token) return '';
  const url = `${ctx.base_url}/p/${ctx.public_token}`;
  return `<tr><td style="padding:6px 32px 26px 32px;background:${PAPER}">
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:12px 0"><tr><td style="border-radius:5px;background:${PRIMARY}">
      <a href="${esc(url)}" style="display:inline-block;padding:14px 26px;font-family:${SANS};font-size:14px;font-weight:600;color:#FFFFFF;text-decoration:none;letter-spacing:0.02em">View + sign your proposal →</a>
    </td></tr></table>
    <div style="font-family:${SANS};font-size:11px;color:${INK_SOFT};margin-top:8px">Or paste this into your browser:<br/><a href="${esc(url)}" style="color:${PRIMARY};word-break:break-all;text-decoration:underline">${esc(url)}</a></div>
  </td></tr>`;
}

function factsheetChip(ctx: ProposalEmailContext): string {
  if (!ctx.factsheet) return '';
  const url = ctx.factsheet.url ?? '#';
  return `<tr><td style="padding:14px 32px 0 32px;background:${PAPER}">
    <a href="${esc(url)}" style="display:inline-block;padding:10px 14px;font-family:${SANS};font-size:12px;color:${INK};background:${CREAM};border:1px solid ${HAIRLINE};border-radius:4px;text-decoration:none">
      <span style="font-family:${SANS};font-size:10px;color:${INK_SOFT};letter-spacing:0.14em;text-transform:uppercase;margin-right:8px">Factsheet</span>${esc(ctx.factsheet.title)} <span style="color:${PRIMARY};margin-left:6px">↗</span>
    </a>
  </td></tr>`;
}

function signatureBlock(ctx: ProposalEmailContext): string {
  const s = ctx.sender ?? {
    name: 'Namkhan Reservations',
    role: 'Guest Services',
    email: 'book@thenamkhan.com',
    phone: null,
  };
  const phone = s.phone ?? ctx.property.phone ?? '';
  const website = (ctx.property.website ?? 'https://thenamkhan.com').replace(/^https?:\/\//, '');
  return `<tr><td style="padding:20px 32px 26px 32px;background:${PAPER};border-top:1px dashed ${HAIRLINE}">
    <div style="font-family:${SERIF};font-size:14px;color:${INK};margin-bottom:14px;font-style:italic">Warm regards,</div>
    <div style="font-family:${SANS};font-size:12px;color:${INK};line-height:1.6">
      <div style="font-weight:600;color:${INK}">${esc(s.name)}</div>
      <div style="color:${INK}">${esc(s.role)}</div>
      <div style="color:${INK}">The Namkhan · Luang Prabang</div>
      <div style="color:${INK}">
        <a href="mailto:${esc(s.email)}" style="color:${INK};text-decoration:none">${esc(s.email)}</a>
        ${phone ? `<span style="color:${INK_SOFT}"> · </span><a href="tel:${esc(phone.replace(/[^+0-9]/g,''))}" style="color:${INK};text-decoration:none">${esc(phone)}</a>` : ''}
      </div>
      <div><a href="https://${esc(website)}" style="color:${PRIMARY};text-decoration:none">${esc(website)}</a></div>
    </div>
  </td></tr>`;
}

// ---------- NEWSLETTER FRAME · FOOTER ----------
// Mirrors app/guest/newsletters/[campaign_id]/preview/page.tsx lines 125-160
function newsletterFooter(ctx: ProposalEmailContext): string {
  // Extract socials from property snapshot. Only show IG, FB, TikTok (same set as newsletter).
  const igUrl = ctx.property.socials.find(s => s.platform === 'instagram')?.url || 'https://www.instagram.com/the_namkhan_resort/';
  const fbUrl = ctx.property.socials.find(s => s.platform === 'facebook')?.url || 'https://www.facebook.com/Namkhanecolodge/';
  const ttUrl = ctx.property.socials.find(s => s.platform === 'tiktok')?.url || 'https://www.tiktok.com/@the.namkhan';
  const addr = ctx.property.address_lines.filter(Boolean).join(' · ') || 'Ban Xieng Lom · Luang Prabang · Laos';
  const infoEmail = ctx.property.email || 'info@thenamkhan.com';

  return `<tr><td style="background:${CREAM};border-top:2px solid ${BRASS};padding:20px 24px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td valign="middle" style="width:1%;padding-right:16px">
        <a href="https://www.slh.com/experiences/considerate-collection" target="_blank" style="text-decoration:none">
          <img src="${SLH_BLACK}" alt="SLH · Considerate Collection" style="height:44px;width:auto;display:block;border:0"/>
        </a>
      </td>
      <td valign="middle" align="center" style="font-family:${SANS};font-size:11px;color:${INK_SOFT};line-height:1.6">
        <div style="font-family:${SERIF};font-weight:600;color:${PRIMARY};letter-spacing:0.14em;font-size:12px">THE NAMKHAN</div>
        <div style="margin-top:3px">${esc(addr)}</div>
        <div><a href="mailto:${esc(infoEmail)}" style="color:${INK_SOFT};text-decoration:none">${esc(infoEmail)}</a></div>
      </td>
      <td valign="middle" align="right" style="width:1%;padding-left:16px;white-space:nowrap">
        <a href="${esc(igUrl)}" target="_blank" style="text-decoration:none;margin-right:10px">
          <img src="https://kpenyneooigsyuuomgct.supabase.co/storage/v1/object/public/branding/icon_instagram.png" alt="Instagram" width="22" height="22" style="display:inline-block;vertical-align:middle;border:0"/>
        </a>
        <a href="${esc(fbUrl)}" target="_blank" style="text-decoration:none;margin-right:10px">
          <img src="https://kpenyneooigsyuuomgct.supabase.co/storage/v1/object/public/branding/icon_facebook.png" alt="Facebook" width="22" height="22" style="display:inline-block;vertical-align:middle;border:0"/>
        </a>
        <a href="${esc(ttUrl)}" target="_blank" style="text-decoration:none">
          <img src="https://kpenyneooigsyuuomgct.supabase.co/storage/v1/object/public/branding/icon_tiktok.png" alt="TikTok" width="22" height="22" style="display:inline-block;vertical-align:middle;border:0"/>
        </a>
      </td>
    </tr></table>
    <div style="margin-top:14px;text-align:center;font-family:${SANS};font-size:10px;color:${INK_SOFT}">
      <a href="${esc(ctx.base_url)}/unsubscribe" style="color:${INK_SOFT};text-decoration:underline">Unsubscribe</a>
      <span style="margin:0 8px;opacity:0.4">·</span>
      <a href="https://thenamkhan.com" style="color:${INK_SOFT};text-decoration:underline">thenamkhan.com</a>
    </div>
    <div style="margin-top:8px;font-family:${SANS};font-size:10px;color:${INK_SOFT};font-style:italic;text-align:center">
      All prices include 10% Lao VAT and 10% service charge.
    </div>
  </td></tr>`;
}

export function renderProposalEmailHtml(ctx: ProposalEmailContext): string {
  const introHtml = mdToHtml(ctx.intro_md);
  const outroHtml = mdToHtml(ctx.outro_md);
  const psHtml = ctx.ps_md
    ? `<div style="margin-top:14px;font-family:${SERIF};font-style:italic;font-size:13px;color:${INK_SOFT};padding-top:10px;border-top:1px dashed ${HAIRLINE}">${esc(ctx.ps_md)}</div>`
    : '';
  const blocksHtml = ctx.blocks.map(b => blockCard(ctx, b)).join('');
  const pricing = pricingTable(ctx);
  const offersHtml = rateOffersBlock(ctx);

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(ctx.subject)}</title></head>
<body style="margin:0;padding:0;background:#FAF7EE;font-family:${SANS};color:${INK}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7EE;padding:24px 0">
  <tr><td align="center">
    <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:${PAPER};border:1px solid ${HAIRLINE};border-radius:4px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.06)">
      ${newsletterHeader()}
      ${heroBlock(ctx)}
      ${proposalTitleBlock(ctx)}
      <tr><td style="padding:8px 32px;background:${PAPER}">${introHtml}</td></tr>
      ${blocksHtml ? `<tr><td style="padding:6px 32px;background:${PAPER}">${blocksHtml}</td></tr>` : ''}
      <tr><td style="padding:14px 32px;background:${PAPER}">${pricing}</td></tr>
      ${offersHtml ? `<tr><td style="padding:6px 32px;background:${PAPER}">${offersHtml}</td></tr>` : ''}
      <tr><td style="padding:18px 32px 6px 32px;background:${PAPER}">${outroHtml}${psHtml}</td></tr>
      ${ctaBlock(ctx)}
      ${factsheetChip(ctx)}
      ${signatureBlock(ctx)}
      ${newsletterFooter(ctx)}
    </table>
  </td></tr>
</table>
</body></html>`;
}
