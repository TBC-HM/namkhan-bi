// app/university/_components/Markdown.tsx
// TBC University · minimal, safe markdown renderer for article body_md.
// No dangerouslySetInnerHTML — everything is built as React nodes, so article
// content can never inject markup. Supports exactly what university articles
// use: ## / ### headings, paragraphs, ordered + unordered lists, pipe tables,
// **bold**, `code`, and [text](url) links (internal /university links stay
// same-tab; everything else opens new-tab).

import type { CSSProperties, ReactNode } from 'react';

const INK = '#1B1B1B';
const INK_SOFT = '#5A5A5A';
const HAIR = '#E6DFCC';
const GREEN = '#084838';

function renderInline(text: string, keyBase: string): ReactNode[] {
  // Tokenize: links → bold → code. Simple sequential scan per pattern.
  const out: ReactNode[] = [];
  // Split by link pattern first.
  const linkRe = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  const pushPlain = (chunk: string) => {
    // bold + code inside a plain chunk
    const parts = chunk.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    for (const p of parts) {
      if (!p) continue;
      if (p.startsWith('**') && p.endsWith('**')) {
        out.push(<strong key={`${keyBase}-b${i++}`}>{p.slice(2, -2)}</strong>);
      } else if (p.startsWith('`') && p.endsWith('`')) {
        out.push(
          <code key={`${keyBase}-c${i++}`} style={{ background: '#F4EFE2', border: `1px solid ${HAIR}`, borderRadius: 3, padding: '0 4px', fontSize: '0.92em' }}>
            {p.slice(1, -1)}
          </code>,
        );
      } else {
        out.push(p);
      }
    }
  };
  while ((m = linkRe.exec(text)) !== null) {
    if (m.index > last) pushPlain(text.slice(last, m.index));
    const href = m[2];
    const internal = href.startsWith('/');
    out.push(
      <a key={`${keyBase}-a${i++}`} href={href}
        target={internal ? undefined : '_blank'} rel={internal ? undefined : 'noreferrer'}
        style={{ color: GREEN, textDecoration: 'underline', textUnderlineOffset: 2 }}>
        {m[1]}
      </a>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) pushPlain(text.slice(last));
  return out;
}

export default function Markdown({ md }: { md: string }) {
  const lines = (md ?? '').replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let k = 0;
  let i = 0;

  const P: CSSProperties = { margin: '0 0 10px', fontSize: 13.5, lineHeight: 1.65, color: INK };

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    if (line.startsWith('### ')) {
      blocks.push(<h3 key={k++} style={{ margin: '18px 0 6px', fontSize: 13, fontWeight: 700, color: INK }}>{renderInline(line.slice(4), `h3-${k}`)}</h3>);
      i++; continue;
    }
    if (line.startsWith('## ')) {
      blocks.push(
        <h2 key={k++} style={{ margin: '22px 0 8px', fontSize: 15, fontWeight: 700, color: INK, borderBottom: `1px solid ${HAIR}`, paddingBottom: 4 }}>
          {renderInline(line.slice(3), `h2-${k}`)}
        </h2>,
      );
      i++; continue;
    }

    // pipe table
    if (line.trimStart().startsWith('|')) {
      const tbl: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith('|')) { tbl.push(lines[i]); i++; }
      const rows = tbl
        .map(r => r.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim()))
        .filter(cells => !cells.every(c => /^:?-{2,}:?$/.test(c)));
      if (rows.length > 0) {
        const [head, ...body] = rows;
        blocks.push(
          <table key={k++} style={{ borderCollapse: 'collapse', margin: '4px 0 12px', fontSize: 12.5 }}>
            <thead>
              <tr>{head.map((c, ci) => (
                <th key={ci} style={{ textAlign: 'left', padding: '5px 12px 5px 0', borderBottom: `1px solid ${INK}`, color: INK, fontWeight: 700 }}>{renderInline(c, `th${k}-${ci}`)}</th>
              ))}</tr>
            </thead>
            <tbody>
              {body.map((r, ri) => (
                <tr key={ri}>{r.map((c, ci) => (
                  <td key={ci} style={{ padding: '5px 12px 5px 0', borderBottom: `1px solid ${HAIR}`, color: INK }}>{renderInline(c, `td${k}-${ri}-${ci}`)}</td>
                ))}</tr>
              ))}
            </tbody>
          </table>,
        );
      }
      continue;
    }

    // ordered list
    if (/^\d+\.\s/.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) { items.push(lines[i].trim().replace(/^\d+\.\s/, '')); i++; }
      // absorb hanging indent continuation lines (e.g. "   - sub") into simple text
      blocks.push(
        <ol key={k++} style={{ margin: '0 0 10px', paddingLeft: 22 }}>
          {items.map((it, ii) => <li key={ii} style={{ ...P, margin: '0 0 4px' }}>{renderInline(it, `ol${k}-${ii}`)}</li>)}
        </ol>,
      );
      continue;
    }

    // unordered list (also captures indented sub-bullets as flat items)
    if (/^\s*-\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*-\s/.test(lines[i])) { items.push(lines[i].replace(/^\s*-\s/, '')); i++; }
      blocks.push(
        <ul key={k++} style={{ margin: '0 0 10px', paddingLeft: 20 }}>
          {items.map((it, ii) => <li key={ii} style={{ ...P, margin: '0 0 4px' }}>{renderInline(it, `ul${k}-${ii}`)}</li>)}
        </ul>,
      );
      continue;
    }

    // paragraph — join consecutive plain lines
    const para: string[] = [line];
    i++;
    while (
      i < lines.length && lines[i].trim() &&
      !lines[i].startsWith('#') && !lines[i].trimStart().startsWith('|') &&
      !/^\s*-\s/.test(lines[i]) && !/^\d+\.\s/.test(lines[i].trim())
    ) { para.push(lines[i]); i++; }
    blocks.push(<p key={k++} style={P}>{renderInline(para.join(' '), `p-${k}`)}</p>);
  }

  return <div style={{ color: INK_SOFT }}>{blocks}</div>;
}
