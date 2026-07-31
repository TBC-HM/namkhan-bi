// app/marketing/website/preview/_site/md.tsx
// Shared markdown renderer for The Namkhan website preview.
import type { ReactNode } from 'react';

// Lines the crawler added as structural metadata — skip in output.
const META_PREFIXES = [
  '**Logo:','**Navigation','**CTA Button','**Meta Description','**Meta description',
  '**Hero image','**hero image','**Page title','**Page Title','**Section label',
  '**Location label','**Subtitle:','**Header nav','**Open hours','**Nav:',
];
function isMeta(line: string): boolean {
  return META_PREFIXES.some(p => line.startsWith(p));
}

function ri(text: string, k: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  parts.forEach((c, i) => {
    if (/^\*\*[^*]+\*\*$/.test(c)) {
      nodes.push(<strong key={k + 'b' + i}>{c.slice(2, -2)}</strong>);
      return;
    }
    const ip = c.split(/(\*[^*]+\*)/g);
    ip.forEach((s, j) => {
      if (/^\*[^*]+\*$/.test(s) && s.length > 2) {
        nodes.push(<em key={k + 'i' + i + j}>{s.slice(1, -1)}</em>);
        return;
      }
      const up = s.split(/(https?:\/\/[^\s)"]+)/g);
      up.forEach((p, l) => {
        if (/^https?:\/\//.test(p)) {
          nodes.push(<a key={k + 'u' + i + j + l} href={p} target="_blank" rel="noopener noreferrer"
            style={{ color: '#2C4A3E', textDecoration: 'underline' }}>{p}</a>);
        } else if (p) {
          nodes.push(<span key={k + 't' + i + j + l}>{p}</span>);
        }
      });
    });
  });
  return nodes;
}

export function renderMd(md: string): ReactNode[] {
  if (!md) return [];
  const blocks: ReactNode[] = [];
  let listBuf: { t: 'ul' | 'ol'; items: string[] } | null = null;
  let key = 0;

  const flush = () => {
    if (!listBuf) return;
    const Tag = listBuf.t;
    blocks.push(
      <Tag key={'l' + key++} style={{ margin: '0.5rem 0 1rem 1.5rem', lineHeight: 1.8, color: '#3a342a' }}>
        {listBuf.items.map((x, i) => <li key={i}>{ri(x, 'li' + key + i)}</li>)}
      </Tag>
    );
    listBuf = null;
  };

  for (const raw of md.split('\n')) {
    const line = raw.trimEnd();
    if (!line.trim() || isMeta(line)) { flush(); continue; }
    if (line.trim() === '---') {
      flush();
      blocks.push(<hr key={'hr' + key++} style={{ border: 0, borderTop: '1px solid #D4C9B0', margin: '2.5rem 0' }} />);
      continue;
    }
    if (line.startsWith('### ')) {
      flush();
      blocks.push(<h3 key={'h3' + key++} style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '1.5rem', marginBottom: '0.3rem', color: '#1C1812', fontFamily: 'Georgia, serif' }}>
        {ri(line.slice(4), 'h3' + key)}</h3>);
      continue;
    }
    if (line.startsWith('## ')) {
      flush();
      blocks.push(<h2 key={'h2' + key++} style={{ fontSize: '1.6rem', fontWeight: 600, marginTop: '2.5rem', marginBottom: '0.5rem', color: '#1C1812', fontFamily: 'Georgia, serif' }}>
        {ri(line.slice(3), 'h2' + key)}</h2>);
      continue;
    }
    if (line.startsWith('# ')) {
      flush();
      blocks.push(<h1 key={'h1' + key++} style={{ fontSize: '2.4rem', fontWeight: 700, marginBottom: '1rem', color: '#1C1812', fontFamily: 'Georgia, serif', letterSpacing: '-0.02em' }}>
        {ri(line.slice(2), 'h1' + key)}</h1>);
      continue;
    }
    const bm = /^-\s+(.*)$/.exec(line);
    if (bm) {
      if (!listBuf || listBuf.t !== 'ul') { flush(); listBuf = { t: 'ul', items: [] }; }
      listBuf.items.push(bm[1]);
      continue;
    }
    const nm = /^\d+\.\s+(.*)$/.exec(line);
    if (nm) {
      if (!listBuf || listBuf.t !== 'ol') { flush(); listBuf = { t: 'ol', items: [] }; }
      listBuf.items.push(nm[1]);
      continue;
    }
    flush();
    blocks.push(<p key={'p' + key++} style={{ margin: '0.6rem 0', lineHeight: 1.85, color: '#3a342a' }}>
      {ri(line, 'p' + key)}</p>);
  }
  flush();
  return blocks;
}
