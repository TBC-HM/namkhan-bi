// app/cockpit-v2/_components/Markdown.tsx
// Server-safe minimal markdown renderer for the cockpit-v2 docs tab.
//
// XSS NOTE: this renders documentation.documents.content_md which is a
// trusted, PBS-authored markdown corpus (CLAUDE.md, ARCHITECTURE.md,
// factorial integration spec). Anon writes are forbidden by RLS — only the
// service role and Felix can write rows. The renderer ALSO escapes <, >, &
// in the body before applying any markdown transforms, so even if an
// untrusted body were ever inserted, no raw HTML could pass through.
// dangerouslySetInnerHTML is therefore acceptable here.

import { TOKENS, SERIF, MONO } from './tokens';

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderTable(block: string): string {
  const lines = block.split('\n').filter(Boolean);
  if (lines.length < 2) return '';
  const header = lines[0].split('|').slice(1, -1).map((c) => c.trim());
  const rows = lines.slice(2).map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
  const th = header
    .map(
      (h) =>
        `<th style="text-align:left;border-bottom:1px solid ${TOKENS.border};padding:6px 10px;font-family:${MONO};font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${TOKENS.text3}">${escape(h)}</th>`,
    )
    .join('');
  const trs = rows
    .map(
      (r) =>
        `<tr>${r.map((c) => `<td style="border-bottom:1px solid ${TOKENS.borderSoft};padding:6px 10px;font-size:13px;color:${TOKENS.text};vertical-align:top">${escape(c)}</td>`).join('')}</tr>`,
    )
    .join('');
  return `<table style="border-collapse:collapse;width:100%;margin:12px 0">${th ? `<thead><tr>${th}</tr></thead>` : ''}<tbody>${trs}</tbody></table>`;
}

export function renderMarkdown(input: string): string {
  // Pull out code fences first so their contents are not re-parsed.
  const fences: string[] = [];
  let s = input.replace(/```([\s\S]*?)```/g, (_, body) => {
    fences.push(body);
    return ` FENCE${fences.length - 1} `;
  });

  // Extract pipe tables
  const tableRegex = /(?:^\|[^\n]+\|\s*\n\|[\s\-:|]+\|\s*\n(?:\|[^\n]+\|\s*\n?)+)/gm;
  const tables: string[] = [];
  s = s.replace(tableRegex, (m) => {
    tables.push(renderTable(m));
    return ` TABLE${tables.length - 1} `;
  });

  // Critical XSS guard: escape the entire body BEFORE transforms.
  // All markdown patterns below match on escaped text, so no raw < or > can
  // ever survive into the output. See file header for trust-model rationale.
  s = escape(s);

  s = s
    .replace(/^### (.+)$/gm, `<h3 style="font-family:${SERIF};font-size:18px;margin:14px 0 6px;color:${TOKENS.ink};font-weight:500">$1</h3>`)
    .replace(/^## (.+)$/gm, `<h2 style="font-family:${SERIF};font-size:22px;margin:18px 0 8px;color:${TOKENS.ink};font-weight:500">$1</h2>`)
    .replace(/^# (.+)$/gm, `<h1 style="font-family:${SERIF};font-size:28px;margin:22px 0 10px;color:${TOKENS.ink};font-weight:500">$1</h1>`)
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/\*([^*\n]+)\*/g, '<i>$1</i>')
    .replace(/`([^`]+)`/g, `<code style="background:${TOKENS.bgDeep};padding:2px 5px;border-radius:3px;font-size:13px;font-family:${MONO}">$1</code>`)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, `<a href="$2" target="_blank" rel="noreferrer" style="color:${TOKENS.brass};text-decoration:underline">$1</a>`)
    .replace(/^- (.+)$/gm, '<li style="margin-left:20px;list-style:disc">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li style="margin-left:20px;list-style:decimal">$2</li>');

  // Wrap consecutive <li> in <ul>
  s = s.replace(/(<li[^>]*>[\s\S]*?<\/li>(?:\s*<li[^>]*>[\s\S]*?<\/li>)*)/g, '<ul style="margin:8px 0">$1</ul>');

  // Paragraphs
  s = s
    .split(/\n\n+/)
    .map((p) => (p.trim().startsWith('<') || !p.trim() ? p : `<p style="margin:8px 0;line-height:1.6;color:${TOKENS.text}">${p.replace(/\n/g, '<br/>')}</p>`))
    .join('\n');

  // Restore tables
  s = s.replace(/ TABLE(\d+) /g, (_, n) => tables[Number(n)] || '');
  // Restore code fences
  s = s.replace(/ FENCE(\d+) /g, (_, n) => {
    const body = escape(fences[Number(n)] || '');
    return `<pre style="background:${TOKENS.bgDeep};border:1px solid ${TOKENS.borderSoft};border-radius:4px;padding:12px;overflow:auto;font-size:12px;line-height:1.55;font-family:${MONO};color:${TOKENS.text}"><code>${body}</code></pre>`;
  });

  return s;
}

export function Markdown({ source }: { source: string }) {
  // eslint-disable-next-line react/no-danger
  return <div dangerouslySetInnerHTML={{ __html: renderMarkdown(source) }} />;
}
