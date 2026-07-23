// lib/emailRenderer.ts
// PBS 2026-07-23 · THE canonical Namkhan newsletter email renderer (v1.0.0).
// ONE renderer for every preview AND every real send. Design spec v1.0
// (editorial serif, paper-white canvas, cream bands, green #084838 accents,
// fluid-hybrid 600px, square corners, Georgia everywhere).
//
// PURE TypeScript — zero imports, zero Node/Deno APIs — so this exact source is
// vendored verbatim into the send-newsletter-test / send-newsletter-batch edge
// functions. Keep the copies in sync (marker: VENDORED lib/emailRenderer.ts v1.0.0).
//
// ── MARKDOWN CONVENTIONS the renderer maps ──────────────────────────────────
//  · first `![alt](url)` standalone in the FIRST 3 blocks → HERO (full-bleed
//    600px, explicit width attr, linked to the first [[CTA]] url if present)
//  · `# Heading`   → H1 display 32/42 (Georgia normal weight, never bold)
//  · `## Heading`  → H2 24/32 with 40px green hairline above
//  · `### Heading` → H3 card title 19/26
//  · `^^EYEBROW TEXT^^` on its own line → eyebrow/kicker 12/18 ls3 UPPER green
//  · `> text`      → pull-quote 22/34 italic green + 40px centered hairline
//  · `- item` rows → real <ul> 16/26
//  · `[label](url)` inline → underlined UPPERCASE text link 13px ls2 green
//    (NEVER a button)
//  · `[[CTA]] [label](url)` on its own line → THE one primary bulletproof
//    button (VML + padded <a>). Only the FIRST [[CTA]] becomes a button;
//    any later [[CTA]] lines downgrade to text links.
//  · product card: an image block immediately followed by a
//    `**[anchor](url)** — blurb` line → full-width feature card (image 536px
//    inset, centered title 19/26, muted blurb 14/22, DISCOVER → text link)
//  · `---` → 1px hairline divider
//  · `{{var}}` substituted from opts.vars; unknown vars are REMOVED when
//    opts.stripUnknownVars (real sends) and kept visible in previews
//  · mode 'plain' (OTA policy force_plain_text/block_links): no images, no
//    hrefs (labels only), minimal frame, body text + signature only.
// ────────────────────────────────────────────────────────────────────────────

export const EMAIL_DESIGN_TOKENS = {
  paper: '#FFFFFF',
  cream: '#F5F0E1',
  hairline: '#E6DFCC',
  ink: '#1B1B1B',
  muted: '#5A5A5A',
  green: '#084838',
  font: "Georgia,'Times New Roman',Times,serif",
  type: {
    eyebrow:  { size: 12, lh: 18, ls: '3px' },
    h1:       { size: 32, lh: 42, ls: '0.5px' },
    h2:       { size: 24, lh: 32, ls: '0.5px' },
    h3:       { size: 19, lh: 26, ls: '0.3px' },
    body:     { size: 16, lh: 26 },
    quote:    { size: 22, lh: 34, ls: '0.3px' },
    caption:  { size: 14, lh: 22 },
    textlink: { size: 13, lh: 20, ls: '2px' },
    legal:    { size: 12, lh: 20, ls: '0.5px' },
  },
} as const;

export interface EmailChrome {
  property_name?: string | null;          // wordmark text (live text, never image)
  header_tagline?: string | null;         // e.g. LUANG PRABANG · LAOS
  header_affiliation?: string | null;     // e.g. A SMALL LUXURY HOTEL OF THE WORLD
  footer_address_lines?: string[] | null;
  footer_social_links?: Array<{ platform: string; url: string }> | null;
  footer_disclaimer_text?: string | null;
  footer_unsubscribe_wording?: string | null;
  footer_email?: string | null;
  footer_website?: string | null;
  unsubscribe_url?: string | null;
  slh_logo_url?: string | null;           // footer affiliation logo (72px)
}

export interface RenderTracking {
  openPixelUrl?: string | null;
  wrapLink?: ((url: string) => string) | null;
  unsubscribeUrl?: string | null;         // overrides chrome.unsubscribe_url
}

export interface RenderOpts {
  subjectForTitle?: string;
  bodyMd: string;
  chrome?: EmailChrome | null;
  vars?: Record<string, string>;
  mode: 'full' | 'plain';
  stripUnknownVars?: boolean;             // true on real sends
  tracking?: RenderTracking | null;
  bannerHtml?: string | null;             // e.g. TEST-send banner, injected above content
}

// Map a public.v_marketing_property_email_settings row → EmailChrome.
// Pure + tolerant: any missing field falls back to the Namkhan defaults inside
// renderNewsletterEmail. NOTE: header_logo_public_url is intentionally NOT used
// — the header is a live-text wordmark by design (never an image).
export function chromeFromSettingsRow(row: Record<string, unknown> | null | undefined): EmailChrome | null {
  if (!row) return null;
  const r = row as {
    from_name?: string | null; header_tagline?: string | null;
    footer_address_lines?: string[] | null;
    footer_social_links?: Array<{ platform: string; url: string }> | null;
    footer_disclaimer_text?: string | null; footer_unsubscribe_wording?: string | null;
    unsubscribe_url?: string | null; reply_to?: string | null; from_email?: string | null;
  };
  return {
    property_name: r.from_name || null,
    header_tagline: r.header_tagline || null,
    footer_address_lines: Array.isArray(r.footer_address_lines) ? r.footer_address_lines : null,
    footer_social_links: Array.isArray(r.footer_social_links) ? r.footer_social_links : null,
    footer_disclaimer_text: r.footer_disclaimer_text || null,
    footer_unsubscribe_wording: r.footer_unsubscribe_wording || null,
    unsubscribe_url: r.unsubscribe_url || null,
    footer_email: r.reply_to || r.from_email || null,
  };
}

const T = EMAIL_DESIGN_TOKENS;
const FONT = T.font;
const SLH_BLACK_DEFAULT = 'https://kpenyneooigsyuuomgct.supabase.co/storage/v1/object/public/branding/slh_black.png';

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escUrl(u: string): string {
  return String(u).replace(/"/g, '%22').replace(/</g, '%3C').replace(/>/g, '%3E');
}

function substituteVars(md: string, vars: Record<string, string> | undefined, stripUnknown: boolean): string {
  let out = md || '';
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{{${k}}}`).join(v);
  if (stripUnknown) out = out.replace(/\{\{[a-zA-Z0-9_]+\}\}/g, '');
  return out.replace(/[ \t]{2,}/g, ' ');
}

// ── block model ─────────────────────────────────────────────────────────────
type Block =
  | { kind: 'hero'; url: string; alt: string }
  | { kind: 'eyebrow'; text: string }
  | { kind: 'h1' | 'h2' | 'h3'; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'hr' }
  | { kind: 'cta'; label: string; url: string; primary: boolean }
  | { kind: 'card'; img: { url: string; alt: string } | null; anchor: string; url: string; blurb: string }
  | { kind: 'image'; url: string; alt: string }
  | { kind: 'para'; text: string };

const IMG_ONLY_RE = /^!\[([^\]]*)\]\(([^)]+)\)\s*$/;
const CTA_LINE_RE = /^\[\[CTA\]\]\s*\[([^\]]+)\]\(([^)]+)\)\s*$/;
const CARD_LINE_RE = /^\*\*\[([^\]]+)\]\(([^)]+)\)\*\*\s*(?:[—–-]\s*(.*))?$/s;

function parseBlocks(md: string): Block[] {
  const raw = (md || '').replace(/\r\n/g, '\n').split(/\n\s*\n+/).map(b => b.trim()).filter(Boolean);
  const blocks: Block[] = [];
  let heroTaken = false;
  let ctaTaken = false;

  for (let i = 0; i < raw.length; i++) {
    let b = raw[i];

    // image + card line fused in one block → split
    const lines = b.split('\n');
    if (lines.length >= 2 && IMG_ONLY_RE.test(lines[0]) && CARD_LINE_RE.test(lines.slice(1).join('\n'))) {
      const im = IMG_ONLY_RE.exec(lines[0])!;
      const cm = CARD_LINE_RE.exec(lines.slice(1).join('\n'))!;
      blocks.push({ kind: 'card', img: { url: im[2], alt: im[1] }, anchor: cm[1], url: cm[2], blurb: (cm[3] || '').trim() });
      continue;
    }

    const img = IMG_ONLY_RE.exec(b);
    if (img) {
      // look ahead: product-card pattern (image block then **[anchor](url)** — blurb)
      const next = raw[i + 1];
      const cm = next ? CARD_LINE_RE.exec(next) : null;
      if (cm) {
        blocks.push({ kind: 'card', img: { url: img[2], alt: img[1] }, anchor: cm[1], url: cm[2], blurb: (cm[3] || '').trim() });
        i++; continue;
      }
      if (!heroTaken && blocks.length < 3) {
        blocks.push({ kind: 'hero', url: img[2], alt: img[1] });
        heroTaken = true; continue;
      }
      blocks.push({ kind: 'image', url: img[2], alt: img[1] });
      continue;
    }

    const cardOnly = CARD_LINE_RE.exec(b);
    if (cardOnly && b.startsWith('**[')) {
      blocks.push({ kind: 'card', img: null, anchor: cardOnly[1], url: cardOnly[2], blurb: (cardOnly[3] || '').trim() });
      continue;
    }

    const cta = CTA_LINE_RE.exec(b);
    if (cta) {
      blocks.push({ kind: 'cta', label: cta[1], url: cta[2], primary: !ctaTaken });
      ctaTaken = true; continue;
    }

    const eyebrow = /^\^\^(.+)\^\^$/.exec(b);
    if (eyebrow) { blocks.push({ kind: 'eyebrow', text: eyebrow[1].trim() }); continue; }

    if (/^### /.test(b)) { blocks.push({ kind: 'h3', text: b.replace(/^### /, '') }); continue; }
    if (/^## /.test(b))  { blocks.push({ kind: 'h2', text: b.replace(/^## /, '') }); continue; }
    if (/^# /.test(b))   { blocks.push({ kind: 'h1', text: b.replace(/^# /, '') }); continue; }

    if (/^>\s?/.test(b)) { blocks.push({ kind: 'quote', text: b.split('\n').map(l => l.replace(/^>\s?/, '')).join(' ').trim() }); continue; }

    if (/^---+$/.test(b)) { blocks.push({ kind: 'hr' }); continue; }

    if (lines.length > 0 && lines.every(l => /^-\s+/.test(l))) {
      blocks.push({ kind: 'list', items: lines.map(l => l.replace(/^-\s+/, '')) });
      continue;
    }

    blocks.push({ kind: 'para', text: b });
  }
  return blocks;
}

// ── inline rendering ────────────────────────────────────────────────────────
function inline(text: string, mode: 'full' | 'plain', wrap: (u: string) => string): string {
  let s = esc(text);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong style="font-weight:bold;">$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  if (mode === 'plain') {
    // links → label only, no href
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
  } else {
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label: string, url: string) =>
      `<a href="${escUrl(wrap(url))}" style="color:${T.green};font-family:${FONT};font-size:${T.type.textlink.size}px;line-height:${T.type.textlink.lh}px;letter-spacing:${T.type.textlink.ls};text-transform:uppercase;text-decoration:underline;" class="dm-grn">${label}</a>`);
  }
  return s.replace(/\n/g, '<br />');
}

const greenHairline = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;"><tr><td width="40" height="1" style="font-size:0;line-height:0;background-color:${T.green};" class="dm-grnbg">&nbsp;</td></tr></table>`;

function bulletproofButton(label: string, url: string): string {
  const lbl = esc(label).toUpperCase();
  const u = escUrl(url);
  return `<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${u}" style="height:48px;v-text-anchor:middle;width:280px;" arcsize="0%" strokecolor="${T.green}" fillcolor="${T.green}"><w:anchorlock/><center style="color:#FFFFFF;font-family:Georgia,serif;font-size:13px;letter-spacing:2.5px;">${lbl}</center></v:roundrect>
<![endif]--><a href="${u}" class="dm-btn" style="background-color:${T.green};border:1px solid ${T.green};color:#FFFFFF;display:inline-block;font-family:${FONT};font-size:13px;line-height:16px;letter-spacing:2.5px;text-transform:uppercase;text-align:center;text-decoration:none;padding:16px 36px;mso-hide:all;">${lbl}</a>`;
}

// top padding by (block, previous block) — spec vertical rhythm, td padding only
function topPad(kind: string, prev: string | null): number {
  if (prev === null) return kind === 'eyebrow' ? 48 : 40;
  if (prev === 'eyebrow') return 12;                       // eyebrow → H1
  if (kind === 'eyebrow') return 56;                        // new section
  if ((kind === 'h1' || kind === 'h2')) return 56;          // major section
  if (kind === 'h3') return 32;
  if (prev === 'h1') return 16;                             // H1 → intro
  if (prev === 'h2' || prev === 'h3') return 16;
  if (kind === 'cta') return 28;                            // body → CTA
  if (kind === 'quote' || prev === 'quote') return 48;
  if (kind === 'card' || prev === 'card') return 40;
  if (kind === 'image' || prev === 'image') return 24;      // image ↔ text
  if (kind === 'hr' || prev === 'hr') return 40;
  return 18;                                                // paragraph rhythm
}

// ── main ────────────────────────────────────────────────────────────────────
export function renderNewsletterEmail(opts: RenderOpts): string {
  const chrome = opts.chrome ?? {};
  const mode = opts.mode;
  const wrap = (mode === 'full' && opts.tracking?.wrapLink) ? opts.tracking.wrapLink : (u: string) => u;
  const md = substituteVars(opts.bodyMd, opts.vars, !!opts.stripUnknownVars);
  const blocks = parseBlocks(md);

  const propName = (chrome.property_name || 'THE NAMKHAN').toUpperCase();
  const tagline = (chrome.header_tagline || 'LUANG PRABANG · LAOS').toUpperCase();
  const affiliation = (chrome.header_affiliation || 'A SMALL LUXURY HOTEL OF THE WORLD').toUpperCase();
  const addressLines = (chrome.footer_address_lines && chrome.footer_address_lines.length > 0)
    ? chrome.footer_address_lines : ['Ban Xieng Lom', 'Luang Prabang, Laos'];
  const footEmail = chrome.footer_email || 'info@thenamkhan.com';
  const footSite = (chrome.footer_website || 'thenamkhan.com').replace(/^https?:\/\//, '');
  const disclaimer = chrome.footer_disclaimer_text || '';
  const unsubWording = chrome.footer_unsubscribe_wording || 'Unsubscribe';
  const unsubUrl = opts.tracking?.unsubscribeUrl || chrome.unsubscribe_url || 'https://www.thenamkhan.com/unsubscribe';
  const slhLogo = chrome.slh_logo_url || SLH_BLACK_DEFAULT;
  const socials = (chrome.footer_social_links || [
    { platform: 'instagram', url: 'https://www.instagram.com/the_namkhan_resort' },
    { platform: 'facebook', url: 'https://www.facebook.com/Namkhanecolodge' },
    { platform: 'youtube', url: 'https://www.youtube.com/@the_namkhan' },
  ]).filter(s => s && s.url && s.platform);
  const title = esc(opts.subjectForTitle || propName);

  // hero link target: first [[CTA]] url (primary), if any
  const primaryCta = blocks.find(b => b.kind === 'cta' && (b as { primary: boolean }).primary) as { url: string } | undefined;

  // ── PLAIN MODE (OTA: force_plain_text + block_links) ──────────────────────
  if (mode === 'plain') {
    const rows: string[] = [];
    for (const b of blocks) {
      if (b.kind === 'hero' || b.kind === 'image') continue;
      if (b.kind === 'cta') { rows.push(`<p style="margin:18px 0 0;font-family:${FONT};font-size:16px;line-height:26px;color:${T.ink};">${esc(b.label)}</p>`); continue; }
      if (b.kind === 'card') { rows.push(`<p style="margin:18px 0 0;font-family:${FONT};font-size:16px;line-height:26px;color:${T.ink};">${esc(b.anchor)}${b.blurb ? ' — ' + inline(b.blurb, 'plain', wrap) : ''}</p>`); continue; }
      if (b.kind === 'eyebrow') { rows.push(`<p style="margin:24px 0 0;font-family:${FONT};font-size:12px;line-height:18px;letter-spacing:2px;text-transform:uppercase;color:${T.muted};">${esc(b.text)}</p>`); continue; }
      if (b.kind === 'h1' || b.kind === 'h2' || b.kind === 'h3') { rows.push(`<p style="margin:26px 0 0;font-family:${FONT};font-size:19px;line-height:26px;color:${T.ink};">${inline(b.text, 'plain', wrap)}</p>`); continue; }
      if (b.kind === 'quote') { rows.push(`<p style="margin:22px 0 0;font-family:${FONT};font-size:16px;line-height:26px;font-style:italic;color:${T.ink};">${inline(b.text, 'plain', wrap)}</p>`); continue; }
      if (b.kind === 'list') { rows.push(`<ul style="margin:16px 0 0;padding:0 0 0 22px;">${b.items.map(it => `<li style="margin:6px 0;font-family:${FONT};font-size:16px;line-height:26px;color:${T.ink};">${inline(it, 'plain', wrap)}</li>`).join('')}</ul>`); continue; }
      if (b.kind === 'hr') { rows.push(`<div style="margin:24px 0 0;border-top:1px solid ${T.hairline};font-size:0;line-height:0;">&nbsp;</div>`); continue; }
      rows.push(`<p style="margin:18px 0 0;font-family:${FONT};font-size:16px;line-height:26px;color:${T.ink};">${inline(b.text, 'plain', wrap)}</p>`);
    }
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${title}</title></head>
<body style="margin:0;padding:0;background-color:${T.paper};">
${opts.bannerHtml || ''}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center" style="padding:24px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;"><tr><td style="font-family:${FONT};">
<p style="margin:0;font-family:${FONT};font-size:14px;line-height:20px;letter-spacing:3px;text-transform:uppercase;color:${T.ink};">${esc(propName)}</p>
${rows.join('\n')}
<p style="margin:28px 0 0;font-family:${FONT};font-size:12px;line-height:20px;color:${T.muted};">${addressLines.map(esc).join(' · ')}</p>
</td></tr></table>
</td></tr></table>
${opts.tracking?.openPixelUrl ? `<img src="${escUrl(opts.tracking.openPixelUrl)}" alt="" width="1" height="1" style="display:block;width:1px;height:1px;border:0;" />` : ''}
</body></html>`;
  }

  // ── FULL MODE ─────────────────────────────────────────────────────────────
  const contentRows: string[] = [];
  let prev: string | null = null;
  for (const b of blocks) {
    const pad = topPad(b.kind, prev);
    const open = `<tr><td class="px" style="padding:${pad}px 32px 0 32px;" align="center">`;
    const close = `</td></tr>`;

    switch (b.kind) {
      case 'hero': {
        // full-bleed row — no side padding, flush to frame
        const imgTag = `<img src="${escUrl(b.url)}" alt="${esc(b.alt || propName)}" width="600" border="0" style="display:block;width:100%;max-width:600px;height:auto;background-color:${T.cream};font-family:${FONT};font-size:14px;color:${T.muted};" />`;
        const inner = primaryCta ? `<a href="${escUrl(wrap(primaryCta.url))}" style="text-decoration:none;border:0;">${imgTag}</a>` : imgTag;
        contentRows.push(`<tr><td style="padding:0;" align="center">${inner}</td></tr>`);
        prev = 'hero';
        continue;
      }
      case 'eyebrow':
        contentRows.push(`${open}<div style="font-family:${FONT};font-size:12px;line-height:18px;letter-spacing:3px;text-transform:uppercase;color:${T.green};" class="dm-grn">${esc(b.text)}</div>${close}`);
        break;
      case 'h1':
        contentRows.push(`${open}<h1 style="margin:0;font-family:${FONT};font-size:32px;line-height:42px;font-weight:normal;letter-spacing:0.5px;color:${T.ink};" class="dm-ink">${inline(b.text, mode, wrap)}</h1>${close}`);
        break;
      case 'h2':
        contentRows.push(`${open}${greenHairline}<h2 style="margin:16px 0 0;font-family:${FONT};font-size:24px;line-height:32px;font-weight:normal;letter-spacing:0.5px;color:${T.ink};" class="dm-ink">${inline(b.text, mode, wrap)}</h2>${close}`);
        break;
      case 'h3':
        contentRows.push(`${open}<h3 style="margin:0;font-family:${FONT};font-size:19px;line-height:26px;font-weight:normal;letter-spacing:0.3px;color:${T.ink};" class="dm-ink">${inline(b.text, mode, wrap)}</h3>${close}`);
        break;
      case 'quote':
        contentRows.push(`${open}${greenHairline}<div style="margin-top:20px;font-family:${FONT};font-size:22px;line-height:34px;letter-spacing:0.3px;font-style:italic;color:${T.green};" class="dm-grn">${inline(b.text, mode, wrap)}</div>${close}`);
        break;
      case 'list':
        contentRows.push(`${open}<ul style="margin:0;padding:0 0 0 22px;text-align:left;">${b.items.map(it => `<li style="margin:8px 0;font-family:${FONT};font-size:16px;line-height:26px;color:${T.ink};" class="dm-ink">${inline(it, mode, wrap)}</li>`).join('')}</ul>${close}`);
        break;
      case 'hr':
        contentRows.push(`${open}<div style="border-top:1px solid ${T.hairline};font-size:0;line-height:0;">&nbsp;</div>${close}`);
        break;
      case 'cta': {
        if (b.primary) {
          contentRows.push(`${open}${bulletproofButton(b.label, wrap(b.url))}${close}`);
        } else {
          contentRows.push(`${open}<a href="${escUrl(wrap(b.url))}" style="color:${T.green};font-family:${FONT};font-size:13px;line-height:20px;letter-spacing:2px;text-transform:uppercase;text-decoration:underline;" class="dm-grn">${esc(b.label)}</a>${close}`);
        }
        break;
      }
      case 'card': {
        const cardImg = b.img
          ? `<a href="${escUrl(wrap(b.url))}" style="text-decoration:none;border:0;"><img src="${escUrl(b.img.url)}" alt="${esc(b.img.alt || b.anchor)}" width="536" border="0" style="display:block;width:100%;max-width:536px;height:auto;background-color:${T.cream};" /></a>`
          : '';
        contentRows.push(`${open}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center" style="padding:0;">
${cardImg}
<div style="padding-top:24px;font-family:${FONT};font-size:19px;line-height:26px;letter-spacing:0.3px;color:${T.ink};" class="dm-ink">${esc(b.anchor)}</div>
${b.blurb ? `<div style="padding-top:8px;font-family:${FONT};font-size:14px;line-height:22px;color:${T.muted};" class="dm-mut">${inline(b.blurb, mode, wrap)}</div>` : ''}
<div style="padding-top:14px;"><a href="${escUrl(wrap(b.url))}" style="display:inline-block;padding:10px 0;color:${T.green};font-family:${FONT};font-size:13px;line-height:20px;letter-spacing:2px;text-transform:uppercase;text-decoration:underline;" class="dm-grn">Discover &rarr;</a></div>
</td></tr></table>${close}`);
        break;
      }
      case 'image':
        contentRows.push(`${open}<img src="${escUrl(b.url)}" alt="${esc(b.alt)}" width="536" border="0" style="display:block;width:100%;max-width:536px;height:auto;background-color:${T.cream};" />${close}`);
        break;
      default: { // para
        const isSignoff = /^warm regards[,.]?$/i.test(b.text.trim());
        const looksSignature = /·/.test(b.text) && /@/.test(b.text) && b.text.includes('\n');
        if (looksSignature || isSignoff) {
          contentRows.push(`<tr><td class="px" style="padding:${isSignoff ? 40 : 8}px 32px 0 32px;" align="center"><div style="font-family:${FONT};font-size:14px;line-height:22px;color:${T.muted};" class="dm-mut">${inline(b.text, mode, wrap)}</div></td></tr>`);
          prev = 'sig';
          continue;
        }
        contentRows.push(`${open}<div style="font-family:${FONT};font-size:16px;line-height:26px;color:${T.ink};text-align:${b.text.length > 240 ? 'left' : 'center'};" class="dm-ink">${inline(b.text, mode, wrap)}</div>${close}`);
      }
    }
    prev = b.kind;
  }

  const socialHtml = socials.length > 0
    ? `<div style="padding-top:18px;">${socials.map((s, i) =>
        `${i > 0 ? `<span style="color:${T.muted};font-family:${FONT};font-size:11px;">&nbsp;&middot;&nbsp;</span>` : ''}<a href="${escUrl(s.url)}" style="color:${T.ink};font-family:${FONT};font-size:11px;line-height:20px;letter-spacing:2px;text-transform:uppercase;text-decoration:none;" class="dm-ink">${esc(s.platform)}</a>`).join('')}</div>`
    : '';

  const openPixel = opts.tracking?.openPixelUrl
    ? `<img src="${escUrl(opts.tracking.openPixelUrl)}" alt="" width="1" height="1" style="display:block;width:1px;height:1px;border:0;" />`
    : '';

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>${title}</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
<style>
  body{margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
  table{border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0;}
  img{-ms-interpolation-mode:bicubic;}
  a[x-apple-data-detectors]{color:inherit !important;text-decoration:none !important;}
  @media (prefers-color-scheme: dark){
    .dm-bg{background-color:#141414 !important;}
    .dm-band{background-color:#1E1C16 !important;}
    .dm-ink{color:#F5F0E1 !important;}
    .dm-mut{color:#B9B4A6 !important;}
    .dm-grn{color:#7FB8A4 !important;}
    .dm-grnbg{background-color:#7FB8A4 !important;}
    .dm-btn{background-color:#0B5A46 !important;border-color:#0B5A46 !important;color:#FFFFFF !important;}
  }
  @media only screen and (max-width:480px){
    .container{width:100% !important;max-width:100% !important;}
    .px{padding-left:20px !important;padding-right:20px !important;}
    h1{font-size:26px !important;line-height:34px !important;}
    h2{font-size:21px !important;line-height:28px !important;}
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${T.paper};" class="dm-bg">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">&nbsp;</div>
<center role="article" aria-roledescription="email" lang="en" style="width:100%;background-color:${T.paper};" class="dm-bg">
<!--[if mso]><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" align="center"><tr><td><![endif]-->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" class="container dm-bg" style="width:100%;max-width:600px;margin:0 auto;background-color:${T.paper};">
${opts.bannerHtml ? `<tr><td style="padding:12px 20px 0;">${opts.bannerHtml}</td></tr>` : ''}
<!-- HEADER · live-text wordmark on cream -->
<tr><td align="center" style="background-color:${T.cream};padding:28px 32px;" class="dm-band">
  <div style="font-family:${FONT};font-size:22px;line-height:28px;letter-spacing:6px;color:${T.ink};" class="dm-ink">${esc(propName)}</div>
  <div style="padding-top:6px;font-family:${FONT};font-size:11px;line-height:18px;letter-spacing:3px;color:${T.muted};" class="dm-mut">${esc(tagline)}</div>
  <div style="padding-top:4px;font-family:${FONT};font-size:10px;line-height:16px;letter-spacing:2px;color:${T.muted};" class="dm-mut">${esc(affiliation)}</div>
</td></tr>
${contentRows.join('\n')}
<!-- FOOTER · cream band -->
<tr><td style="padding-top:64px;"></td></tr>
<tr><td align="center" style="background-color:${T.cream};padding:36px 32px 28px;" class="dm-band">
  <div style="font-family:${FONT};font-size:14px;line-height:20px;letter-spacing:4px;text-transform:uppercase;color:${T.ink};" class="dm-ink">${esc(propName)}</div>
  <div style="padding-top:6px;font-family:${FONT};font-size:10px;line-height:16px;letter-spacing:2px;text-transform:uppercase;color:${T.muted};" class="dm-mut">${esc(affiliation)}</div>
  <div style="padding-top:16px;"><a href="https://www.slh.com/experiences/considerate-collection" style="text-decoration:none;border:0;"><img src="${escUrl(slhLogo)}" alt="Small Luxury Hotels of the World" width="72" border="0" style="display:inline-block;width:72px;height:auto;" /></a></div>
  <div style="padding-top:14px;font-family:${FONT};font-size:12px;line-height:20px;color:${T.muted};" class="dm-mut">${addressLines.map(esc).join('<br />')}</div>
  <div style="padding-top:6px;font-family:${FONT};font-size:12px;line-height:20px;color:${T.muted};" class="dm-mut"><a href="mailto:${esc(footEmail)}" style="color:${T.muted};text-decoration:none;" class="dm-mut">${esc(footEmail)}</a> &middot; <a href="https://${esc(footSite)}" style="color:${T.muted};text-decoration:none;" class="dm-mut">${esc(footSite)}</a></div>
  ${socialHtml}
  ${disclaimer ? `<div style="padding-top:18px;font-family:${FONT};font-size:12px;line-height:20px;letter-spacing:0.5px;color:${T.muted};max-width:440px;margin:0 auto;" class="dm-mut">${esc(disclaimer)}</div>` : ''}
  <div style="padding-top:14px;"><a href="${escUrl(unsubUrl)}" style="display:inline-block;padding:8px;font-family:${FONT};font-size:12px;line-height:20px;letter-spacing:0.5px;color:${T.muted};text-decoration:underline;" class="dm-mut">${esc(unsubWording)}</a></div>
  ${openPixel}
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</center>
</body></html>`;
}
