// lib/sop-docx.ts
// PBS 2026-07-11 pm: shared HTML-as-.doc builder for SOP preview page + /api/sop/[code]/docx + /api/sop/send.
// Approach: emit Word-compatible HTML with a Word-friendly <style> block; return as application/msword.
// No npm docx dep needed — Word/Docs/Pages open well-formed HTML fine as a .doc.

import { sopDocStyleSheet } from './sop-docx-styles';

export interface SopDocRow {
  sop_code: string;
  title: string;
  dept_code: string | null;
  short_summary: string | null;
  body_md: string | null;
  version: string | null;
  status: string | null;
  author: string | null;
  sop_date: string | null;
  property_id: number | null;
  primary_audience?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface SopMetaRow {
  review_cadence_days: number | null;
  last_reviewed_at: string | null;
  next_review_at: string | null;
  sop_kind: string | null;
  notes: string | null;
}

function esc(s: string | null | undefined): string {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function propertyLabel(pid: number | null | undefined): string {
  if (pid === 0) return 'The Namkhan · Donna Portals';
  if (pid === 1) return 'The Namkhan Retreat';
  return 'The Namkhan';
}

export function reviewIntervalLabel(days: number | null | undefined): string {
  if (!days) return 'Annual';
  if (days <= 31) return 'Monthly';
  if (days <= 100) return 'Quarterly';
  if (days <= 200) return 'Semi-annual';
  if (days <= 400) return 'Annual';
  return `${days} days`;
}

export function effectiveDate(row: SopDocRow): string {
  if (row.sop_date) return String(row.sop_date).slice(0, 10);
  if (row.created_at) return String(row.created_at).slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

export function versionLabel(row: SopDocRow): string {
  const v = (row.version ?? '').trim();
  if (!v) return 'v1.0';
  return v.startsWith('v') ? v : `v${v}`;
}

// Naive markdown-to-HTML for the Procedure body.
// Handles: # / ## / ### headings, - / * bullets, "N. " numbered lines,
// **bold**, blank-line paragraph breaks. No external dependency.
export function renderBody(md: string | null | undefined): string {
  if (!md) return '<p style="color:#5A5A5A;">(no procedure body stored)</p>';
  const src = String(md).replace(/\r\n/g, '\n');
  const blocks = src.split(/\n\n+/);
  const out: string[] = [];
  for (const raw of blocks) {
    const block = raw.trim();
    if (!block) continue;
    const lines = block.split('\n');

    // heading
    const hm = /^(#{1,3})\s+(.*)$/.exec(lines[0]);
    if (hm && lines.length === 1) {
      const level = hm[1].length + 2; // # -> h3, ## -> h4, ### -> h5
      out.push(`<h${level} style="margin:16px 0 6px;font-size:${level === 3 ? 15 : level === 4 ? 14 : 13}px;font-weight:700;color:#1F3A2E;">${inline(hm[2])}</h${level}>`);
      continue;
    }

    // ordered list — every line matches N. or n)
    if (lines.every((l) => /^\s*\d+[\.\)]\s+/.test(l))) {
      const items = lines.map((l) => l.replace(/^\s*\d+[\.\)]\s+/, '')).map((t) => `<li style="margin-bottom:4px;">${inline(t)}</li>`).join('');
      out.push(`<ol style="margin:8px 0 8px 24px;padding:0;font-size:13px;line-height:1.55;color:#1B1B1B;">${items}</ol>`);
      continue;
    }

    // unordered list
    if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
      const items = lines.map((l) => l.replace(/^\s*[-*]\s+/, '')).map((t) => `<li style="margin-bottom:4px;">${inline(t)}</li>`).join('');
      out.push(`<ul style="margin:8px 0 8px 24px;padding:0;font-size:13px;line-height:1.55;color:#1B1B1B;">${items}</ul>`);
      continue;
    }

    // paragraph
    out.push(`<p style="margin:8px 0;font-size:13px;line-height:1.6;color:#1B1B1B;">${inline(block.replace(/\n/g, ' '))}</p>`);
  }
  return out.join('\n');
}

function inline(text: string): string {
  return esc(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
}

export interface BuildOpts {
  forDownload?: boolean; // adds Word xmlns hints
  forEmail?: boolean;    // simplifies (Resend attachment)
}

export function buildSopHtml(row: SopDocRow, meta: SopMetaRow | null, opts: BuildOpts = {}): string {
  const ver = versionLabel(row);
  const eff = effectiveDate(row);
  const reviewInterval = reviewIntervalLabel(meta?.review_cadence_days ?? null);
  const propLabel = propertyLabel(row.property_id ?? null);
  const owner = row.author || (row.dept_code ? `${row.dept_code} HoD` : 'Department HoD');
  const nextReview = meta?.next_review_at ? String(meta.next_review_at).slice(0, 10) : '—';

  // Word/Docs/Pages open HTML fine as .doc when served with application/msword +
  // the .doc extension. We deliberately DO NOT emit Office-specific XML meta blocks
  // here — plain UTF-8 meta suffices and keeps the source cleanly diffable.
  const wordHead = '<meta http-equiv="Content-Type" content="text/html; charset=utf-8">';
  // Prevent tsc unused-var warning while keeping BuildOpts.forDownload in the public shape.
  void opts.forDownload;

  const style = sopDocStyleSheet();

  const statusRaw = (row.status ?? 'draft').toLowerCase();
  const statusPill = `<span class="pill pill-${statusRaw === 'active' ? 'active' : statusRaw === 'archived' ? 'archived' : 'draft'}">${esc(row.status ?? 'draft')}</span>`;

  const cover = `
    <div class="cover">
      <div class="eyebrow">${esc(propLabel)} · Standard Operating Procedure</div>
      <div class="code">${esc(row.sop_code)}</div>
      <h1>${esc(row.title)}</h1>
      <div style="font-size:12px;color:#5A5A5A;">${esc(row.dept_code ?? '')}${row.primary_audience ? ' · ' + esc(row.primary_audience) : ''}</div>
      <div class="meta-grid">
        <div class="meta-cell"><div class="k">Version</div><div class="v">${esc(ver)}</div></div>
        <div class="meta-cell"><div class="k">Effective</div><div class="v">${esc(eff)}</div></div>
        <div class="meta-cell"><div class="k">Review interval</div><div class="v">${esc(reviewInterval)}</div></div>
        <div class="meta-cell"><div class="k">Next review</div><div class="v">${esc(nextReview)}</div></div>
        <div class="meta-cell"><div class="k">Owner</div><div class="v">${esc(owner)}</div></div>
        <div class="meta-cell"><div class="k">Department</div><div class="v">${esc(row.dept_code ?? '—')}</div></div>
        <div class="meta-cell"><div class="k">Property</div><div class="v">${esc(propLabel)}</div></div>
        <div class="meta-cell"><div class="k">Status</div><div class="v">${statusPill}</div></div>
      </div>
    </div>
  `;

  const toc = `
    <div class="toc">
      <h2>Contents</h2>
      <ol>
        <li><a href="#purpose">Purpose</a></li>
        <li><a href="#scope">Scope</a></li>
        <li><a href="#definitions">Definitions</a></li>
        <li><a href="#responsibilities">Responsibilities</a></li>
        <li><a href="#procedure">Procedure</a></li>
        <li><a href="#metrics">Metrics &amp; KPIs</a></li>
        <li><a href="#references">References</a></li>
        <li><a href="#revision-history">Revision history</a></li>
        <li><a href="#signatures">Signatures</a></li>
      </ol>
    </div>
  `;

  const purposeShort = row.short_summary ?? '';
  const purpose = `
    <section id="purpose">
      <h2 class="sec">1 · Purpose</h2>
      ${purposeShort ? `<p style="font-size:13px;line-height:1.6;">${esc(purposeShort)}</p>` : '<p class="empty">Purpose not yet documented.</p>'}
    </section>
  `;

  const scope = `
    <section id="scope">
      <h2 class="sec">2 · Scope</h2>
      <p style="font-size:13px;line-height:1.6;">Applies to all ${esc(row.dept_code ?? 'department')} staff at ${esc(propLabel)}.</p>
    </section>
  `;

  const definitions = `
    <section id="definitions">
      <h2 class="sec">3 · Definitions</h2>
      <p class="empty">None documented.</p>
    </section>
  `;

  const responsibilities = `
    <section id="responsibilities">
      <h2 class="sec">4 · Responsibilities</h2>
      <table class="tbl">
        <thead><tr><th style="width:30%;">Role</th><th>Duty</th></tr></thead>
        <tbody>
          <tr><td>${esc(row.dept_code ?? 'Department')} HoD</td><td>Owns this SOP, ensures training, signs off on revisions.</td></tr>
          <tr><td>Duty staff</td><td>Executes the procedure and reports deviations to the HoD.</td></tr>
          <tr><td>General Manager</td><td>Approves the SOP and reviews on the review cadence.</td></tr>
        </tbody>
      </table>
    </section>
  `;

  const procedure = `
    <section id="procedure">
      <h2 class="sec">5 · Procedure</h2>
      ${renderBody(row.body_md)}
    </section>
  `;

  const metrics = `
    <section id="metrics">
      <h2 class="sec">6 · Metrics &amp; KPIs</h2>
      <table class="tbl">
        <thead><tr><th>KPI</th><th>Target</th><th>Frequency</th></tr></thead>
        <tbody>
          <tr><td class="empty">To be defined</td><td class="empty">—</td><td class="empty">—</td></tr>
        </tbody>
      </table>
    </section>
  `;

  const references = `
    <section id="references">
      <h2 class="sec">7 · References</h2>
      <p class="empty">No related SOPs linked yet.</p>
    </section>
  `;

  const revision = `
    <section id="revision-history">
      <h2 class="sec">8 · Revision history</h2>
      <table class="tbl">
        <thead><tr><th>Version</th><th>Date</th><th>Author</th><th>Change note</th></tr></thead>
        <tbody>
          <tr>
            <td style="font-variant-numeric:tabular-nums;">${esc(ver)}</td>
            <td style="font-variant-numeric:tabular-nums;">${esc(eff)}</td>
            <td>${esc(row.author ?? '—')}</td>
            <td>Initial release.</td>
          </tr>
        </tbody>
      </table>
    </section>
  `;

  const signatures = `
    <section id="signatures">
      <h2 class="sec">9 · Signatures</h2>
      <div class="sig-grid">
        <div class="sig-box">
          <div><div class="role">Prepared by</div><div style="font-size:12px;">${esc(owner)}</div></div>
          <div class="name-line">Name &amp; date</div>
        </div>
        <div class="sig-box">
          <div><div class="role">Reviewed by</div><div style="font-size:12px;">Department HoD</div></div>
          <div class="name-line">Name &amp; date</div>
        </div>
        <div class="sig-box">
          <div><div class="role">Approved by</div><div style="font-size:12px;">General Manager</div></div>
          <div class="name-line">Name &amp; date</div>
        </div>
      </div>
    </section>
  `;

  return `<!doctype html>
<html lang="en">
<head>
  ${wordHead}
  <title>${esc(row.sop_code)} · ${esc(row.title)}</title>
  <style>${style}</style>
</head>
<body>
  <div class="WordSection1">
    <div class="doc-shell">
      ${cover}
      ${toc}
      ${purpose}
      ${scope}
      ${definitions}
      ${responsibilities}
      ${procedure}
      ${metrics}
      ${references}
      ${revision}
      ${signatures}
    </div>
  </div>
</body>
</html>`;
}

export function docFilename(row: SopDocRow): string {
  const safeCode = String(row.sop_code || 'SOP').replace(/[^A-Za-z0-9_\-]/g, '_');
  return `${safeCode}-${versionLabel(row)}.doc`;
}
