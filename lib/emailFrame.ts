// lib/emailFrame.ts
// PBS 2026-07-21: unified email HTML frame shared between sequence preview,
// send-time renderer, and newsletter Composer live-preview.
//
// Design lock (matches CampaignEditor + sequence preview cream/gold brand band):
//   - Header:  cream #F5F0E1 · gold band 2px #C79A6B · "THE NAMKHAN" serif
//   - Hero:    16:9 crop, max-width 600px, only rendered when heroImageUrl provided
//   - Body:    Georgia serif · 14px · line-height 1.6 · ink #1B1B1B on white
//   - Footer:  cream · address · website · email · unsubscribe pipe-separated

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

export function renderEmailFrame(opts: EmailFrameOpts): string {
  const propName = opts.propertyName ?? 'THE NAMKHAN';
  const propEmail = opts.propertyEmail ?? 'info@thenamkhan.com';
  const propWebsite = opts.propertyWebsite ?? 'thenamkhan.com';
  const unsub = opts.unsubscribeUrl ?? '#';
  const heroAlt = esc(opts.heroAlt ?? propName);
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

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(propName)}</title></head>
<body style="margin:0;padding:0;background:#F0EBE1;font-family:Georgia,serif;color:${INK};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F0EBE1;padding:20px 0;">
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid ${HAIR};border-radius:4px;overflow:hidden;">
      <tr><td style="padding:20px 24px 14px;background:${CREAM};border-bottom:2px solid ${GOLD};text-align:center;">
        <div style="font-family:Georgia,serif;font-size:22px;letter-spacing:0.34em;color:${GREEN};">${esc(propName)}</div>
        <div style="font-size:9px;letter-spacing:0.22em;color:${INK_M};margin-top:4px;">LUANG PRABANG · LAOS</div>
      </td></tr>
      ${hero}
      <tr><td style="padding:20px 28px 24px;font-family:Georgia,serif;font-size:14px;line-height:1.6;color:${INK};">
        ${opts.bodyHtml}
        ${signature}
      </td></tr>
      <tr><td style="padding:16px 20px;background:${CREAM};border-top:2px solid ${GOLD};font-size:10px;color:${INK_M};text-align:center;line-height:1.6;">
        <div style="font-weight:600;color:${INK};letter-spacing:0.08em;">${esc(propName)}</div>
        <div>Ban Xieng Lom, Luang Prabang, Laos</div>
        <div><a href="mailto:${esc(propEmail)}" style="color:${INK_M};text-decoration:none;">${esc(propEmail)}</a> · <a href="https://${esc(propWebsite)}" style="color:${INK_M};text-decoration:none;">${esc(propWebsite)}</a></div>
        <div style="margin-top:8px;"><a href="${esc(unsub)}" style="color:${INK_M};text-decoration:underline;">Unsubscribe</a></div>
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
