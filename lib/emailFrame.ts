// lib/emailFrame.ts
// PBS 2026-07-21: unified email HTML frame shared between sequence preview,
// send-time renderer, and newsletter Composer live-preview.
//
// Design lock (matches CampaignEditor + sequence preview cream/gold brand band):
//   - Header:  cream #F5F0E1 · gold band 2px #C79A6B · logo image OR "THE NAMKHAN" serif
//   - Hero:    16:9 crop, max-width 600px, only rendered when heroImageUrl provided
//   - Body:    Georgia serif · 14px · line-height 1.6 · ink #1B1B1B on white
//   - Footer:  cream · address · website · email · social icons · disclaimer · unsubscribe
//
// PBS 2026-07-21 (v2): data-driven chrome — every header/footer string reads from
// the property_email_settings row (fetched by caller and passed via `chrome`).
// Inline SVG social icons (Gmail strips <img> to external unknowns).

export interface EmailChrome {
  header_logo_public_url?: string | null;
  header_tagline?: string | null;
  footer_address_lines?: string[] | null;
  footer_social_links?: Array<{ platform: string; url: string }> | null;
  footer_disclaimer_text?: string | null;
  footer_unsubscribe_wording?: string | null;
}

export interface EmailFrameOpts {
  heroImageUrl?: string | null;
  heroAlt?: string;
  bodyHtml: string;
  senderName?: string;
  senderRole?: string;
  propertyName?: string;
  propertyEmail?: string;
  propertyWebsite?: string;
  unsubscribeUrl?: string;
  chrome?: EmailChrome | null;
}

const CREAM = '#F5F0E1';
const GOLD = '#C79A6B';
const INK = '#1B1B1B';
const INK_M = '#5A5A5A';
const HAIR = '#E6DFCC';
const GREEN = '#084838';

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---------------- Inline SVG social icons (Gmail-safe) ----------------
// Each returns a 16x16 monochrome SVG as a data URI string usable in <img src=...>.
// We use inline <svg> in the actual footer so no external URL is fetched.
const SVG_COLOR = '#5A5A5A';

function svgFor(platform: string): string {
  const p = platform.toLowerCase();
  const stroke = SVG_COLOR;
  const fill = SVG_COLOR;
  switch (p) {
    case 'instagram':
      return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle"><rect x="3" y="3" width="18" height="18" rx="5" stroke="${stroke}" stroke-width="1.6"/><circle cx="12" cy="12" r="4" stroke="${stroke}" stroke-width="1.6"/><circle cx="17.5" cy="6.5" r="1" fill="${fill}"/></svg>`;
    case 'facebook':
      return `<svg width="14" height="14" viewBox="0 0 24 24" fill="${fill}" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle"><path d="M13.5 22v-8h2.7l.4-3.1h-3.1V8.9c0-.9.3-1.5 1.6-1.5h1.7V4.6c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.1H7.5V14h2.6v8h3.4z"/></svg>`;
    case 'youtube':
      return `<svg width="16" height="14" viewBox="0 0 24 24" fill="${fill}" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle"><path d="M23 6.7c-.3-1.1-1.1-1.9-2.2-2.2C18.9 4 12 4 12 4s-6.9 0-8.8.5C2.1 4.8 1.3 5.6 1 6.7.5 8.6.5 12 .5 12s0 3.4.5 5.3c.3 1.1 1.1 1.9 2.2 2.2 1.9.5 8.8.5 8.8.5s6.9 0 8.8-.5c1.1-.3 1.9-1.1 2.2-2.2.5-1.9.5-5.3.5-5.3s0-3.4-.5-5.3zM9.8 15.5V8.5l6 3.5-6 3.5z"/></svg>`;
    case 'linkedin':
      return `<svg width="14" height="14" viewBox="0 0 24 24" fill="${fill}" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle"><path d="M4.98 3.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM3 9.5h4V21H3V9.5zM9 9.5h3.8v1.6h.1c.5-1 1.9-2 3.9-2 4.2 0 5 2.7 5 6.3V21h-4v-5.3c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9V21h-4V9.5z"/></svg>`;
    case 'tripadvisor':
      return `<svg width="16" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle"><circle cx="7" cy="12" r="3.5" stroke="${stroke}" stroke-width="1.6"/><circle cx="17" cy="12" r="3.5" stroke="${stroke}" stroke-width="1.6"/><circle cx="7" cy="12" r="1" fill="${fill}"/><circle cx="17" cy="12" r="1" fill="${fill}"/><path d="M2 9c2-2 5-3 10-3s8 1 10 3" stroke="${stroke}" stroke-width="1.4" stroke-linecap="round"/></svg>`;
    case 'x':
    case 'twitter':
      return `<svg width="14" height="14" viewBox="0 0 24 24" fill="${fill}" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle"><path d="M18.244 2h3.308l-7.227 8.26L23 22h-6.828l-5.35-6.987L4.7 22H1.39l7.73-8.835L1 2h6.997l4.833 6.39L18.244 2zm-1.161 18h1.833L7.084 4H5.117L17.083 20z"/></svg>`;
    default:
      // Generic link glyph
      return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle"><path d="M10 14a5 5 0 007.07 0l3-3a5 5 0 10-7.07-7.07l-1.5 1.5" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round"/><path d="M14 10a5 5 0 00-7.07 0l-3 3a5 5 0 107.07 7.07l1.5-1.5" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round"/></svg>`;
  }
}

function renderSocialLinks(links: Array<{ platform: string; url: string }> | null | undefined): string {
  if (!links || links.length === 0) return '';
  const cells = links
    .filter((l) => l && l.url && l.platform)
    .map((l) => `<a href="${esc(l.url)}" style="display:inline-block;padding:0 6px;text-decoration:none;color:${INK_M};" aria-label="${esc(l.platform)}">${svgFor(l.platform)}</a>`)
    .join('');
  return `<div style="margin:8px 0 4px;">${cells}</div>`;
}

export function renderEmailFrame(opts: EmailFrameOpts): string {
  const chrome = opts.chrome ?? {};
  const propName = opts.propertyName ?? 'THE NAMKHAN';
  const propEmail = opts.propertyEmail ?? 'info@thenamkhan.com';
  const propWebsite = opts.propertyWebsite ?? 'thenamkhan.com';
  const unsub = opts.unsubscribeUrl ?? '#';
  const heroAlt = esc(opts.heroAlt ?? propName);
  const tagline = chrome.header_tagline ?? 'LUANG PRABANG · LAOS';
  const addressLines = Array.isArray(chrome.footer_address_lines) && chrome.footer_address_lines.length > 0
    ? chrome.footer_address_lines
    : ['Ban Xieng Lom, Luang Prabang, Laos'];
  const disclaimer = chrome.footer_disclaimer_text ?? '';
  const unsubWording = chrome.footer_unsubscribe_wording ?? 'Unsubscribe';

  // Header: logo image if provided, else the serif wordmark
  const headerInner = chrome.header_logo_public_url
    ? `<img src="${esc(chrome.header_logo_public_url)}" alt="${esc(propName)}" style="max-height:44px;width:auto;display:inline-block;" />`
    : `<div style="font-family:Georgia,serif;font-size:22px;letter-spacing:0.34em;color:${GREEN};">${esc(propName)}</div>`;

  // Hero slot is REQUIRED at send-time (enforced by fn_campaign_body_update /
  // fn_funnel_step_update RPCs). If missing here in preview, render a loud
  // placeholder so PBS immediately sees "this email will fail to save".
  const hero = opts.heroImageUrl
    ? `<tr><td style="padding:0;">
         <div style="max-width:600px;margin:0 auto;background:${CREAM};">
           <div style="position:relative;width:100%;padding-bottom:56.25%;overflow:hidden;">
             <img src="${esc(opts.heroImageUrl)}" alt="${heroAlt}" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;display:block;" />
           </div>
         </div>
       </td></tr>`
    : `<tr><td style="padding:0;">
         <div style="max-width:600px;margin:0 auto;background:#FFF3F0;border-top:1px solid #B03826;border-bottom:1px solid #B03826;padding:32px 24px;text-align:center;color:#B03826;font-family:Georgia,serif;">
           <div style="font-weight:700;font-size:14px;letter-spacing:0.06em;">NO HERO IMAGE</div>
           <div style="font-size:11px;margin-top:6px;color:${INK_M};">Every email must have a hero. This will be rejected at save. Pick a photo from the Media Library, or set a property default in Settings &gt; Audience &gt; Email Chrome.</div>
         </div>
       </td></tr>`;

  const signature = opts.senderName
    ? `<div style="margin-top:22px;padding-top:14px;border-top:1px solid ${HAIR};font-family:Georgia,serif;font-size:13px;color:${INK};">
         <div>${esc(opts.senderName)}${opts.senderRole ? ` <span style="color:${INK_M};font-style:italic">· ${esc(opts.senderRole)}</span>` : ''}</div>
       </div>`
    : '';

  const addressHtml = addressLines.map((l) => `<div>${esc(l)}</div>`).join('');
  const socialHtml = renderSocialLinks(chrome.footer_social_links);
  const disclaimerHtml = disclaimer
    ? `<div style="margin-top:8px;font-size:10px;color:${INK_M};max-width:520px;margin-left:auto;margin-right:auto;">${esc(disclaimer)}</div>`
    : '';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(propName)}</title></head>
<body style="margin:0;padding:0;background:#F0EBE1;font-family:Georgia,serif;color:${INK};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F0EBE1;padding:20px 0;">
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid ${HAIR};border-radius:4px;overflow:hidden;">
      <tr><td style="padding:20px 24px 14px;background:${CREAM};border-bottom:2px solid ${GOLD};text-align:center;">
        ${headerInner}
        <div style="font-size:9px;letter-spacing:0.22em;color:${INK_M};margin-top:4px;">${esc(tagline)}</div>
      </td></tr>
      ${hero}
      <tr><td style="padding:20px 28px 24px;font-family:Georgia,serif;font-size:14px;line-height:1.6;color:${INK};">
        ${opts.bodyHtml}
        ${signature}
      </td></tr>
      <tr><td style="padding:16px 20px;background:${CREAM};border-top:2px solid ${GOLD};font-size:10px;color:${INK_M};text-align:center;line-height:1.6;">
        <div style="font-weight:600;color:${INK};letter-spacing:0.08em;">${esc(propName)}</div>
        ${addressHtml}
        <div><a href="mailto:${esc(propEmail)}" style="color:${INK_M};text-decoration:none;">${esc(propEmail)}</a> · <a href="https://${esc(propWebsite)}" style="color:${INK_M};text-decoration:none;">${esc(propWebsite)}</a></div>
        ${socialHtml}
        ${disclaimerHtml}
        <div style="margin-top:8px;"><a href="${esc(unsub)}" style="color:${INK_M};text-decoration:underline;">${esc(unsubWording)}</a></div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

// Convenience: convert lightweight markdown to HTML (headings, bold, italic, links, paragraphs, hr, images).
// Kept in the same file so surfaces that already have body_md can render without a heavy dependency.
export function markdownToInlineHtml(md: string): string {
  const esc2 = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const html = esc2(md)
    .replace(/^# (.+)$/gm, `<h1 style="font-family:Georgia,serif;font-size:24px;color:${GREEN};margin:16px 0 8px;font-style:italic">$1</h1>`)
    .replace(/^## (.+)$/gm, `<h2 style="font-family:Georgia,serif;font-size:18px;color:${GREEN};margin:14px 0 6px">$1</h2>`)
    .replace(/^### (.+)$/gm, `<h3 style="font-family:Georgia,serif;font-size:15px;color:${INK};margin:12px 0 6px">$1</h3>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt: string, u: string) => `<img src="${u.replace(/"/g, '%22')}" alt="${alt}" style="max-width:100%;height:auto;display:block;margin:12px 0;border-radius:3px;" />`)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label: string, url: string) => `<a href="${url.replace(/"/g, '%22')}" style="color:${GREEN};text-decoration:underline">${label}</a>`)
    .replace(/^---$/gm, `<hr style="border:none;border-top:1px solid ${HAIR};margin:16px 0;" />`);
  return html.split(/\n\n+/).map(p => `<p style="margin:8px 0;font-family:Georgia,serif;font-size:14px;line-height:1.6;color:${INK};">${p}</p>`).join('\n');
}
