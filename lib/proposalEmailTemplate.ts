// lib/proposalEmailTemplate.ts
// PBS 2026-07-16 — Newsletter-quality outbound email for the Sales Proposal composer.
// Palette (locked): #FFFFFF paper · #1B1B1B ink · #084838 brand green ·
//                   #E6DFCC hairline · #F5F0E1 warm paper card.
// Uses the same pattern as supabase/functions/render-revenue-report (tables + inline styles,
// email-safe. No CSS variables. No dark tokens.)
//
// Consumers:
//   - GET /api/sales/proposals/[id]/email/preview → returns rendered HTML for iframe.
//   - POST /api/sales/proposals/[id]/send → included in Make webhook payload.

const PAPER = '#FFFFFF';
const PAPER_WARM = '#F5F0E1';
const INK = '#1B1B1B';
const INK_SOFT = '#5A5A5A';
const HAIRLINE = '#E6DFCC';
const PRIMARY = '#084838';
const SANS = '-apple-system,"SF Pro Text",Helvetica,Arial,sans-serif';
const SERIF = 'Georgia,"Times New Roman",serif';

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

// PBS 2026-07-16 (Feature A) — side-by-side rate offer cards.
// 0 or 1 offer  → renders as before (single card / no offers section).
// 2 or 3 offers → side-by-side table, one CTA per card linking to
//                 /p/{token}?rate={offer_id}.
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
  // PBS 2026-07-16 (Feature A) — optional. Empty or length 1 falls back to the
  // single-card / no-offers layout. Length 2 or 3 renders side-by-side.
  rate_offers?: ProposalRateOfferInput[];
  total_lak: number;
  fx_lak_per_usd: number;
  // Property snapshot
  property: {
    name: string;                 // e.g. "The Namkhan Luang Prabang"
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
  base_url: string;               // e.g. https://namkhan-bi.vercel.app
  // PBS 2026-07-16 (item 5) — optional factsheet chip in footer.
  factsheet?: { doc_id: string; title: string; url: string | null } | null;
  // PBS 2026-07-16 (item 10) — sender signature block above the disclosure line.
  // Falls back to "Namkhan Reservations · Guest Services · book@thenamkhan.com"
  // when the proposal has no assigned owner.
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
  // Minimalist md → html: paragraphs on blank line, escape everything else.
  if (!md) return '';
  return md.split(/\n{2,}/).map(p => `<p style="margin:0 0 12px 0;font-family:${SERIF};font-size:15px;line-height:1.7;color:${INK}">${esc(p).replace(/\n/g, '<br/>')}</p>`).join('');
}

function heroImgSrc(ctx: ProposalEmailContext, assetId: string | null | undefined): string | null {
  if (!assetId) return null;
  // Absolute URL so it renders in email clients.
  return `${ctx.base_url}/api/marketing/media/preview?asset_id=${assetId}`;
}

// PBS 2026-07-16 (items 7 + 8):
//   item 7 → drop "ROOM " prefix in the block header; use "Accommodation" eyebrow instead.
//   item 8 → "activity" block_type surfaces as "Experience" (server-side block_type stays 'activity').
// Anything else falls back to a title-cased version of the block_type.
const BLOCK_TYPE_LABEL: Record<string, string> = {
  room: 'Accommodation',
  activity: 'Experience',
  fnb: 'Dining',
  spa: 'Spa',
  transfer: 'Transfer',
  note: 'Note',
};

function blockCard(ctx: ProposalEmailContext, b: ProposalBlockInput): string {
  const heroUrl = heroImgSrc(ctx, b.hero_asset_id);
  const totalUsd = fmtUsd(Number(b.total_lak), ctx.fx_lak_per_usd);
  const meta = `${b.qty} × ${b.nights} ${b.nights === 1 ? 'night' : 'nights'}`;
  // PBS 2026-07-16 item 7 — never emit the raw block_type; use the friendly map so
  // "ROOM EXPLORER TENT" becomes eyebrow "ACCOMMODATION" + title "Explorer Tent".
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

// PBS 2026-07-16 (Feature A) — side-by-side rate offer cards.
// 2 offers → two 280px columns. 3 offers → three 180px columns. Email frame
// is 640px minus 32px+32px padding = 576px content width, comfortably fits both.
// Cards stack under 500px viewport thanks to width=100% + display:block on the
// mobile media query (email clients strip <style>, so we rely on Gmail/iOS Mail
// stacking behaviour for narrow widths — same pattern as newsletter machine).
function rateOffersBlock(ctx: ProposalEmailContext): string {
  const offers = (ctx.rate_offers ?? []).slice(0, 3);
  if (offers.length < 2) return '';
  const colWidth = offers.length === 2 ? 280 : 180;
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

  // Wrap in a fixed layout table for consistent widths in Outlook.
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;margin:6px 0;table-layout:fixed">
    <tr><td colspan="${offers.length}" style="padding:0 6px 8px 6px">
      <div style="font-family:${SANS};font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:${INK_SOFT}">Choose your rate</div>
    </td></tr>
    <tr>${cells}</tr>
    <tr><td colspan="${offers.length}" style="padding:8px 6px 0 6px;font-family:${SANS};font-size:11px;color:${INK_SOFT};line-height:1.5">
      Prices per room / night, includes 10% VAT + 10% service. Click a card to open the guest page and confirm your rate.
    </td></tr>
  </table>`;
  // colWidth kept in scope for future explicit per-cell width injection.
  void colWidth;
}

// PBS 2026-07-16 — DEPRECATED itemized table (killed per "dont duble list the costs").
// Kept only as a fallback for legacy templates; the new default is a single grand-total line.
function pricingTable(ctx: ProposalEmailContext): string {
  const totalUsd = fmtUsd(Number(ctx.total_lak), ctx.fx_lak_per_usd);
  const rowsHidden: string[] = ctx.blocks.map(b => {
    const t = fmtUsd(Number(b.total_lak), ctx.fx_lak_per_usd);
    return `<!-- ${esc(b.label)} ${b.qty} × ${b.nights} = ${t} -->`;
  });
  return `${rowsHidden.join('')}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:14px 0 4px 0">
    <tr>
      <td style="padding:14px 10px;font-family:${SERIF};font-size:16px;color:${INK};border-top:2px solid ${PRIMARY}">Stay total · ${ctx.nights} ${ctx.nights === 1 ? 'night' : 'nights'}</td>
      <td align="right" style="padding:14px 10px;font-family:${SERIF};font-size:20px;font-weight:600;color:${PRIMARY};border-top:2px solid ${PRIMARY};font-variant-numeric:tabular-nums">${totalUsd}</td>
    </tr>
  </table>`;
}

// PBS 2026-07-16 — old itemized table body left inline for historical diff, never called.
function pricingTable_legacy(ctx: ProposalEmailContext): string {
  const rows = ctx.blocks.map(b => {
    const totalUsd = fmtUsd(Number(b.total_lak), ctx.fx_lak_per_usd);
    return `<tr>
      <td style="padding:8px 10px;border-bottom:1px solid ${HAIRLINE};font-family:${SANS};font-size:13px;color:${INK}">${esc(b.label)}<div style="font-size:11px;color:${INK_SOFT}">${b.qty} × ${b.nights} ${b.nights === 1 ? 'night' : 'nights'}</div></td>
      <td align="right" style="padding:8px 10px;border-bottom:1px solid ${HAIRLINE};font-family:${SANS};font-size:13px;color:${INK};white-space:nowrap;font-variant-numeric:tabular-nums">${totalUsd}</td>
    </tr>`;
  }).join('');
  const totalUsd = fmtUsd(Number(ctx.total_lak), ctx.fx_lak_per_usd);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid ${HAIRLINE};background:${PAPER_WARM};border-radius:6px;overflow:hidden">
    <thead><tr><th align="left" style="padding:10px;font-family:${SANS};font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${INK_SOFT};background:${PAPER_WARM};border-bottom:1px solid ${HAIRLINE}">Item</th><th align="right" style="padding:10px;font-family:${SANS};font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${INK_SOFT};background:${PAPER_WARM};border-bottom:1px solid ${HAIRLINE}">Total</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr>
      <td style="padding:14px 10px;font-family:${SERIF};font-size:16px;color:${INK};border-top:2px solid ${PRIMARY};background:${PAPER}">Stay total</td>
      <td align="right" style="padding:14px 10px;font-family:${SERIF};font-size:20px;font-weight:600;color:${PRIMARY};border-top:2px solid ${PRIMARY};background:${PAPER};font-variant-numeric:tabular-nums">${totalUsd}</td>
    </tr></tfoot>
  </table>`;
}

function headerBlock(ctx: ProposalEmailContext): string {
  const logo = ctx.property.logo_url && !ctx.property.logo_url.startsWith('[') ? ctx.property.logo_url : null;
  return `<tr><td style="padding:32px 32px 20px 32px;background:${PAPER};border-bottom:1px solid ${HAIRLINE}">
    ${logo ? `<img src="${esc(logo)}" alt="${esc(ctx.property.name)}" height="42" style="display:block;height:42px;margin-bottom:14px;border:0"/>` : ''}
    <div style="font-family:${SANS};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${INK_SOFT};margin-bottom:6px">Proposal for ${esc(ctx.guest_name)}</div>
    <div style="font-family:${SERIF};font-size:28px;color:${PRIMARY};line-height:1.15;margin-bottom:8px">${esc(ctx.property.name)}</div>
    <div style="font-family:${SANS};font-size:13px;color:${INK_SOFT}">${esc(fmtDate(ctx.date_in))} → ${esc(fmtDate(ctx.date_out))} · ${ctx.nights} ${ctx.nights === 1 ? 'night' : 'nights'}</div>
    ${ctx.property.tagline ? `<div style="font-family:${SERIF};font-style:italic;font-size:14px;color:${INK_SOFT};margin-top:10px">${esc(ctx.property.tagline)}</div>` : ''}
  </td></tr>`;
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
  // PBS 2026-07-16 (item 5) — footer chip if a marketing factsheet is attached.
  if (!ctx.factsheet) return '';
  const url = ctx.factsheet.url ?? '#';
  return `<tr><td style="padding:14px 32px 0 32px;background:${PAPER}">
    <a href="${esc(url)}" style="display:inline-block;padding:10px 14px;font-family:${SANS};font-size:12px;color:${INK};background:${PAPER_WARM};border:1px solid ${HAIRLINE};border-radius:4px;text-decoration:none">
      <span style="font-family:${SANS};font-size:10px;color:${INK_SOFT};letter-spacing:0.14em;text-transform:uppercase;margin-right:8px">Factsheet</span>${esc(ctx.factsheet.title)} <span style="color:${PRIMARY};margin-left:6px">↗</span>
    </a>
  </td></tr>`;
}

// PBS 2026-07-16 item 10 — sender signature block sits at the very end of the
// body, above the disclosure footer. Resolved server-side from the proposal's
// created_by user, or falls back to the property Reservations desk.
function signatureBlock(ctx: ProposalEmailContext): string {
  const s = ctx.sender ?? {
    name: 'Namkhan Reservations',
    role: 'Guest Services',
    email: 'book@thenamkhan.com',
    phone: null,
  };
  const phone = s.phone ?? ctx.property.phone ?? '+856 20 5 555 5555';
  const website = (ctx.property.website ?? 'https://thenamkhan.com').replace(/^https?:\/\//, '');
  return `<tr><td style="padding:20px 32px 26px 32px;background:${PAPER};border-top:1px dashed ${HAIRLINE}">
    <div style="font-family:${SERIF};font-size:14px;color:${INK};margin-bottom:14px;font-style:italic">Warm regards,</div>
    <div style="font-family:${SANS};font-size:12px;color:${INK};line-height:1.6">
      <div style="font-weight:600;color:${INK}">${esc(s.name)}</div>
      <div style="color:${INK}">${esc(s.role)}</div>
      <div style="color:${INK}">The Namkhan · Luang Prabang</div>
      <div style="color:${INK}">
        <a href="mailto:${esc(s.email)}" style="color:${INK};text-decoration:none">${esc(s.email)}</a>
        <span style="color:${INK_SOFT}"> · </span>
        <a href="tel:${esc(phone.replace(/[^+0-9]/g,''))}" style="color:${INK};text-decoration:none">${esc(phone)}</a>
      </div>
      <div><a href="https://${esc(website)}" style="color:${PRIMARY};text-decoration:none">${esc(website)}</a></div>
    </div>
  </td></tr>`;
}

function footerBlock(ctx: ProposalEmailContext): string {
  const addr = ctx.property.address_lines.filter(Boolean).join(' · ');
  const socials = ctx.property.socials.slice(0, 6).map(s => `<a href="${esc(s.url)}" style="color:${PRIMARY};text-decoration:none;margin-right:10px;font-family:${SANS};font-size:11px;letter-spacing:0.08em;text-transform:uppercase">${esc(s.platform)}</a>`).join('');
  return `<tr><td style="padding:22px 32px;background:${PAPER_WARM};border-top:1px solid ${HAIRLINE}">
    <div style="font-family:${SERIF};font-size:14px;color:${INK};margin-bottom:6px">${esc(ctx.property.name)}</div>
    ${addr ? `<div style="font-family:${SANS};font-size:12px;color:${INK_SOFT};margin-bottom:4px">${esc(addr)}</div>` : ''}
    <div style="font-family:${SANS};font-size:12px;color:${INK_SOFT};margin-bottom:8px">
      ${ctx.property.phone ? `Tel <a href="tel:${esc(ctx.property.phone)}" style="color:${INK};text-decoration:none">${esc(ctx.property.phone)}</a> · ` : ''}
      ${ctx.property.whatsapp ? `WhatsApp <a href="https://wa.me/${esc(ctx.property.whatsapp.replace(/[^0-9]/g,''))}" style="color:${INK};text-decoration:none">${esc(ctx.property.whatsapp)}</a> · ` : ''}
      ${ctx.property.email ? `<a href="mailto:${esc(ctx.property.email)}" style="color:${INK};text-decoration:none">${esc(ctx.property.email)}</a>` : ''}
      ${ctx.property.website ? ` · <a href="${esc(ctx.property.website)}" style="color:${INK};text-decoration:none">${esc(ctx.property.website.replace(/^https?:\/\//,''))}</a>` : ''}
    </div>
    ${socials ? `<div style="margin-top:8px;margin-bottom:14px">${socials}</div>` : ''}
    <!-- PBS 2026-07-16 item 9 — VAT + service disclosure on every proposal. -->
    <div style="font-family:${SANS};font-size:11px;color:${INK_SOFT};font-style:italic;margin-bottom:10px">
      All our prices include 10% Lao VAT and 10% service charge.
    </div>
    <div style="font-family:${SANS};font-size:10px;color:${INK_SOFT};line-height:1.5;border-top:1px dashed ${HAIRLINE};padding-top:10px">
      Rates in USD (converted from LAK at internal FX). Cancellation follows the terms shown on your proposal page. Reply to this email to adjust anything.
    </div>
  </td></tr>`;
}

export function renderProposalEmailHtml(ctx: ProposalEmailContext): string {
  const introHtml = mdToHtml(ctx.intro_md);
  const outroHtml = mdToHtml(ctx.outro_md);
  const psHtml    = ctx.ps_md ? `<div style="margin-top:14px;font-family:${SERIF};font-style:italic;font-size:13px;color:${INK_SOFT};padding-top:10px;border-top:1px dashed ${HAIRLINE}">${esc(ctx.ps_md)}</div>` : '';
  const blocksHtml = ctx.blocks.map(b => blockCard(ctx, b)).join('');
  const pricing = pricingTable(ctx);
  const offersHtml = rateOffersBlock(ctx);

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(ctx.subject)}</title></head>
<body style="margin:0;padding:0;background:${PAPER_WARM};font-family:${SANS};color:${INK}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER_WARM};padding:24px 0">
  <tr><td align="center">
    <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:${PAPER};border:1px solid ${HAIRLINE};border-radius:8px;overflow:hidden">
      ${headerBlock(ctx)}
      <tr><td style="padding:26px 32px 8px 32px;background:${PAPER}">${introHtml}</td></tr>
      ${blocksHtml ? `<tr><td style="padding:6px 32px;background:${PAPER}">${blocksHtml}</td></tr>` : ''}
      ${offersHtml ? `<tr><td style="padding:6px 32px;background:${PAPER}">${offersHtml}</td></tr>` : ''}
      <tr><td style="padding:14px 32px;background:${PAPER}">${pricing}</td></tr>
      <tr><td style="padding:18px 32px 6px 32px;background:${PAPER}">${outroHtml}${psHtml}</td></tr>
      ${ctaBlock(ctx)}
      ${factsheetChip(ctx)}
      ${signatureBlock(ctx)}
      ${footerBlock(ctx)}
    </table>
    <div style="font-family:${SANS};font-size:10px;color:${INK_SOFT};max-width:640px;padding:12px 24px">You are receiving this because you enquired with ${esc(ctx.property.name)}. To stop receiving proposals, reply "unsubscribe" and we will remove you.</div>
  </td></tr>
</table>
</body></html>`;
}
