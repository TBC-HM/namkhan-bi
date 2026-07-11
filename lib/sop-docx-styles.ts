// lib/sop-docx-styles.ts
// PBS 2026-07-11 pm: SOP doc stylesheet — printable + email-safe.
// Split out from sop-docx.ts so the main builder file stays small + WAF-friendly
// on the Supabase → GitHub bridge, and to keep design tokens visible in one place.

export function sopDocStyleSheet(): string {
  return `
    @page WordSection1 { size: A4; margin: 2cm 2cm 2cm 2cm; }
    div.WordSection1 { page: WordSection1; }
    body { font-family: 'Calibri', -apple-system, Helvetica, Arial, sans-serif; color: #1B1B1B; background: #FFFFFF; margin: 0; padding: 0; }
    .doc-shell { max-width: 820px; margin: 0 auto; padding: 24px; background: #FFFFFF; }
    .doc-toolbar { display: flex; gap: 8px; padding: 8px 0 16px; border-bottom: 1px solid #E6DFCC; margin-bottom: 20px; }
    .doc-toolbar a, .doc-toolbar button { padding: 6px 12px; font-size: 12px; border-radius: 4px; text-decoration: none; cursor: pointer; font-weight: 600; border: 1px solid #1F3A2E; background: #1F3A2E; color: #FFFFFF; }
    .doc-toolbar a.ghost, .doc-toolbar button.ghost { background: #FFFFFF; color: #1F3A2E; }
    .cover { border-top: 3px solid #1F3A2E; border-bottom: 1px solid #E6DFCC; padding: 18px 0 18px; margin-bottom: 24px; }
    .cover .eyebrow { font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; color: #5A5A5A; }
    .cover .code { font-family: 'SFMono-Regular', 'Consolas', 'Menlo', monospace; font-size: 11px; color: #5A5A5A; margin-top: 4px; }
    .cover h1 { margin: 6px 0 8px; font-size: 24px; font-weight: 700; letter-spacing: -0.01em; color: #1F3A2E; }
    .cover .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px 20px; margin-top: 14px; font-size: 11px; }
    .cover .meta-cell .k { font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: #5A5A5A; margin-bottom: 2px; }
    .cover .meta-cell .v { color: #1B1B1B; font-variant-numeric: tabular-nums; }
    .pill { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
    .pill-active { background: #EAF3EE; color: #1F3A2E; border: 1px solid #C6DDD0; }
    .pill-draft { background: #FFF6E4; color: #8A6612; border: 1px solid #F0DDA8; }
    .pill-archived { background: #F1EEE7; color: #5A5A5A; border: 1px solid #E6DFCC; }
    .toc { background: #FAFAF7; border: 1px solid #E6DFCC; border-radius: 6px; padding: 14px 18px; margin-bottom: 28px; }
    .toc h2 { margin: 0 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: #5A5A5A; font-weight: 700; }
    .toc ol { margin: 6px 0 0 20px; padding: 0; font-size: 12px; color: #1B1B1B; }
    .toc a { color: #1F3A2E; text-decoration: none; }
    section { margin-bottom: 28px; }
    section h2.sec { font-size: 14px; letter-spacing: 0.06em; text-transform: uppercase; color: #1F3A2E; border-bottom: 1px solid #E6DFCC; padding-bottom: 6px; margin: 0 0 12px; font-weight: 700; }
    table.tbl { width: 100%; border-collapse: collapse; font-size: 12px; margin: 6px 0; }
    table.tbl th, table.tbl td { border-bottom: 1px solid #E6DFCC; padding: 8px 10px; text-align: left; vertical-align: top; }
    table.tbl th { background: #FAFAF7; font-weight: 700; color: #5A5A5A; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; }
    .empty { color: #8A8A8A; font-style: italic; font-size: 12px; }
    .sig-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 12px; }
    .sig-box { border: 1px solid #E6DFCC; border-radius: 4px; padding: 12px; min-height: 110px; display: flex; flex-direction: column; justify-content: space-between; }
    .sig-box .role { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #5A5A5A; font-weight: 700; margin-bottom: 4px; }
    .sig-box .name-line { border-top: 1px solid #1B1B1B; margin-top: 40px; padding-top: 4px; font-size: 10px; color: #5A5A5A; }
    @media print {
      body { background: #FFFFFF !important; }
      .no-print { display: none !important; }
      .doc-shell { padding: 0; max-width: none; }
      section { page-break-inside: avoid; }
      section#procedure, section#signatures { page-break-before: always; }
      .cover, .toc, section { border-color: transparent !important; }
      body { font-size: 11pt; }
    }
  `;
}
