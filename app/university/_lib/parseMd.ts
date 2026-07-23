// app/university/_lib/parseMd.ts
// TBC University · markdown parser. Pure TypeScript, no React — returns a
// serializable block AST that Markdown.tsx renders. Kept pure so it can be
// unit-tested with plain node (scripts/test-university-md.ts).
//
// UNIVERSITY MARKDOWN CONVENTIONS (canonical list — mirrored in
// documentation.documents doc_type='design_system' § TBC University):
//
//   ## Heading            section heading
//   ### Heading           sub-heading
//   1. Step text          auto-numbered STEP blocks with big step circles
//   - bullet              unordered list
//   | a | b |             pipe table
//   **bold** `code`       inline
//   [text](url)           link; /university/... links render as article chips
//   :::tip [title]        green callout   (optional custom title)
//   :::warning [title]    amber callout
//   :::never [title]      red "Never do this" callout
//   :::                   closes a callout
//   ![shot:file.png|arrow:x,y|label:Click here]
//                         annotated screenshot from bucket 'university-shots';
//                         arrow/label pairs repeatable; x,y are percentages
//   Expected outcome: …   paragraph starting with this renders as outcome box
//
// The FIRST plain paragraph of an article renders as the lead paragraph.

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'bold'; v: string }
  | { t: 'code'; v: string }
  | { t: 'link'; v: string; href: string; university: boolean };

export type ShotArrow = { x: number; y: number; label: string };

export type Block =
  | { t: 'lead'; inline: Inline[] }
  | { t: 'p'; inline: Inline[] }
  | { t: 'h2'; inline: Inline[] }
  | { t: 'h3'; inline: Inline[] }
  | { t: 'steps'; items: Inline[][] }
  | { t: 'ul'; items: Inline[][] }
  | { t: 'table'; head: Inline[][]; rows: Inline[][][] }
  | { t: 'callout'; kind: 'tip' | 'warning' | 'never'; title: string | null; blocks: Block[] }
  | { t: 'shot'; file: string; arrows: ShotArrow[] }
  | { t: 'outcome'; inline: Inline[] };

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  const linkRe = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const pushPlain = (chunk: string) => {
    const parts = chunk.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    for (const p of parts) {
      if (!p) continue;
      if (p.startsWith('**') && p.endsWith('**') && p.length > 4) out.push({ t: 'bold', v: p.slice(2, -2) });
      else if (p.startsWith('`') && p.endsWith('`') && p.length > 2) out.push({ t: 'code', v: p.slice(1, -1) });
      else out.push({ t: 'text', v: p });
    }
  };
  while ((m = linkRe.exec(text)) !== null) {
    if (m.index > last) pushPlain(text.slice(last, m.index));
    const href = m[2];
    out.push({ t: 'link', v: m[1], href, university: href.startsWith('/university/') });
    last = m.index + m[0].length;
  }
  if (last < text.length) pushPlain(text.slice(last));
  return out;
}

const SHOT_RE = /^!\[shot:([^\]|]+)((?:\|[^\]|]+)*)\]\s*$/;

function parseShot(line: string): Block | null {
  const m = SHOT_RE.exec(line.trim());
  if (!m) return null;
  const file = m[1].trim();
  const arrows: ShotArrow[] = [];
  const segs = (m[2] || '').split('|').map((s) => s.trim()).filter(Boolean);
  let pending: { x: number; y: number } | null = null;
  for (const seg of segs) {
    if (seg.startsWith('arrow:')) {
      if (pending) arrows.push({ ...pending, label: '' }); // arrow without label
      const [xs, ys] = seg.slice(6).split(',');
      const x = Number(xs), y = Number(ys);
      pending = Number.isFinite(x) && Number.isFinite(y)
        ? { x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) }
        : null;
    } else if (seg.startsWith('label:')) {
      if (pending) { arrows.push({ ...pending, label: seg.slice(6).trim() }); pending = null; }
    }
  }
  if (pending) arrows.push({ ...pending, label: '' });
  return { t: 'shot', file, arrows };
}

const CALLOUT_OPEN = /^:::(tip|warning|never)(?:\s+(.*))?$/;

export function parseUniversityMd(md: string): Block[] {
  const lines = (md ?? '').replace(/\r\n/g, '\n').split('\n');
  return parseBlocks(lines, true);
}

function parseBlocks(lines: string[], topLevel: boolean): Block[] {
  const blocks: Block[] = [];
  let i = 0;
  let sawLead = false;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    // callout fence
    const co = CALLOUT_OPEN.exec(line.trim());
    if (co) {
      const inner: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== ':::') { inner.push(lines[i]); i++; }
      i++; // consume closing ::: (or EOF — unclosed fence tolerated)
      blocks.push({
        t: 'callout',
        kind: co[1] as 'tip' | 'warning' | 'never',
        title: co[2]?.trim() || null,
        blocks: parseBlocks(inner, false),
      });
      sawLead = true; // a leading callout suppresses lead styling on later paragraphs
      continue;
    }

    // annotated screenshot
    const shot = parseShot(line);
    if (shot) { blocks.push(shot); i++; sawLead = true; continue; }

    if (line.startsWith('### ')) { blocks.push({ t: 'h3', inline: parseInline(line.slice(4)) }); i++; sawLead = true; continue; }
    if (line.startsWith('## ')) { blocks.push({ t: 'h2', inline: parseInline(line.slice(3)) }); i++; sawLead = true; continue; }

    // pipe table
    if (line.trimStart().startsWith('|')) {
      const tbl: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith('|')) { tbl.push(lines[i]); i++; }
      const rows = tbl
        .map((r) => r.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim()))
        .filter((cells) => !cells.every((c) => /^:?-{2,}:?$/.test(c)));
      if (rows.length > 0) {
        const [head, ...body] = rows;
        blocks.push({ t: 'table', head: head.map(parseInline), rows: body.map((r) => r.map(parseInline)) });
      }
      sawLead = true;
      continue;
    }

    // ordered list → STEP block
    if (/^\d+\.\s/.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && (/^\d+\.\s/.test(lines[i].trim()) || /^\s{2,}\S/.test(lines[i]))) {
        if (/^\d+\.\s/.test(lines[i].trim())) items.push(lines[i].trim().replace(/^\d+\.\s/, ''));
        else if (items.length > 0) items[items.length - 1] += ' ' + lines[i].trim(); // hanging continuation
        i++;
      }
      blocks.push({ t: 'steps', items: items.map(parseInline) });
      sawLead = true;
      continue;
    }

    // unordered list
    if (/^\s*-\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*-\s/.test(lines[i])) { items.push(lines[i].replace(/^\s*-\s/, '')); i++; }
      blocks.push({ t: 'ul', items: items.map(parseInline) });
      sawLead = true;
      continue;
    }

    // paragraph — join consecutive plain lines
    const para: string[] = [line];
    i++;
    while (
      i < lines.length && lines[i].trim() &&
      !lines[i].startsWith('#') && !lines[i].trimStart().startsWith('|') &&
      !/^\s*-\s/.test(lines[i]) && !/^\d+\.\s/.test(lines[i].trim()) &&
      !CALLOUT_OPEN.test(lines[i].trim()) && lines[i].trim() !== ':::' && !SHOT_RE.test(lines[i].trim())
    ) { para.push(lines[i]); i++; }
    const text = para.join(' ');

    if (/^Expected outcome:/i.test(text.trim())) {
      blocks.push({ t: 'outcome', inline: parseInline(text.trim().replace(/^Expected outcome:\s*/i, '')) });
      continue;
    }
    if (topLevel && !sawLead) {
      blocks.push({ t: 'lead', inline: parseInline(text) });
      sawLead = true;
      continue;
    }
    blocks.push({ t: 'p', inline: parseInline(text) });
  }
  return blocks;
}
