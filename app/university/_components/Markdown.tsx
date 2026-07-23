// app/university/_components/Markdown.tsx
// TBC University · markdown renderer. Parsing lives in _lib/parseMd.ts (pure,
// unit-tested); this file only maps the block AST to React nodes. No
// dangerouslySetInnerHTML — content can never inject markup.
//
// Human-and-leading reader design: 15px/1.75 body, a larger lead paragraph,
// numbered STEP blocks with big step circles, tinted callouts
// (tip / warning / never-do), an outcome box, distinct article-to-article
// link chips, and annotated screenshots. Conventions are canonical in
// documentation.documents doc_type='design_system' § TBC University.

import type { CSSProperties, ReactNode } from 'react';
import { parseUniversityMd, type Block, type Inline } from '../_lib/parseMd';
import {
  INK, INK_SOFT, HAIR, GREEN, GOLD, RED, BODY_SIZE, BODY_LEADING, LEAD_SIZE,
  TIP_BG, TIP_BORDER, WARN_BG, WARN_BORDER, NEVER_BG, NEVER_BORDER,
} from '../_lib/theme';
import Screenshot from './Screenshot';

function renderInline(nodes: Inline[], keyBase: string): ReactNode[] {
  return nodes.map((n, i) => {
    const key = `${keyBase}-${i}`;
    switch (n.t) {
      case 'bold': return <strong key={key} style={{ color: INK }}>{n.v}</strong>;
      case 'code': return (
        <code key={key} style={{ background: '#F4EFE2', border: `1px solid ${HAIR}`, borderRadius: 3, padding: '0 4px', fontSize: '0.92em' }}>
          {n.v}
        </code>
      );
      case 'link': {
        if (n.university) {
          // Article-to-article link: distinct chip so staff see "this opens
          // another guide page", not an external site.
          return (
            <a key={key} href={n.href} style={{
              display: 'inline-block', color: GREEN, fontWeight: 600, textDecoration: 'none',
              background: '#EEF4EF', border: `1px solid ${TIP_BORDER}`, borderRadius: 4,
              padding: '0 6px', margin: '0 1px', lineHeight: 1.5, whiteSpace: 'normal',
            }}>
              <span aria-hidden style={{ marginRight: 4, fontSize: '0.85em' }}>→</span>{n.v}
            </a>
          );
        }
        const internal = n.href.startsWith('/');
        return (
          <a key={key} href={n.href}
            target={internal ? undefined : '_blank'} rel={internal ? undefined : 'noreferrer'}
            style={{ color: GREEN, textDecoration: 'underline', textUnderlineOffset: 2 }}>
            {n.v}
          </a>
        );
      }
      default: return n.v;
    }
  });
}

const P: CSSProperties = { margin: '0 0 12px', fontSize: BODY_SIZE, lineHeight: BODY_LEADING, color: INK };

const CALLOUT_STYLE = {
  tip: { bg: TIP_BG, border: TIP_BORDER, accent: GREEN, icon: '💡', label: 'Tip' },
  warning: { bg: WARN_BG, border: WARN_BORDER, accent: GOLD, icon: '⚠️', label: 'Careful' },
  never: { bg: NEVER_BG, border: NEVER_BORDER, accent: RED, icon: '🚫', label: 'Never do this' },
} as const;

function renderBlocks(blocks: Block[], keyBase: string): ReactNode[] {
  return blocks.map((b, bi) => {
    const key = `${keyBase}-${bi}`;
    switch (b.t) {
      case 'lead':
        return (
          <p key={key} style={{ margin: '0 0 16px', fontSize: LEAD_SIZE, lineHeight: 1.7, color: INK, fontWeight: 500 }}>
            {renderInline(b.inline, key)}
          </p>
        );
      case 'p':
        return <p key={key} style={P}>{renderInline(b.inline, key)}</p>;
      case 'h2':
        return (
          <h2 key={key} style={{ margin: '26px 0 10px', fontSize: 17, fontWeight: 700, color: INK, borderBottom: `1px solid ${HAIR}`, paddingBottom: 5 }}>
            {renderInline(b.inline, key)}
          </h2>
        );
      case 'h3':
        return <h3 key={key} style={{ margin: '20px 0 8px', fontSize: 15, fontWeight: 700, color: INK }}>{renderInline(b.inline, key)}</h3>;
      case 'steps':
        return (
          <ol key={key} style={{ margin: '4px 0 16px', padding: 0, listStyle: 'none' }}>
            {b.items.map((it, ii) => (
              <li key={ii} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
                <span aria-hidden style={{
                  flex: 'none', width: 28, height: 28, borderRadius: '50%', background: GREEN, color: '#FFFFFF',
                  fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginTop: 1,
                }}>
                  {ii + 1}
                </span>
                <span style={{ fontSize: BODY_SIZE, lineHeight: 1.65, color: INK, paddingTop: 3 }}>
                  {renderInline(it, `${key}-${ii}`)}
                </span>
              </li>
            ))}
          </ol>
        );
      case 'ul':
        return (
          <ul key={key} style={{ margin: '0 0 14px', paddingLeft: 22 }}>
            {b.items.map((it, ii) => (
              <li key={ii} style={{ ...P, margin: '0 0 6px' }}>{renderInline(it, `${key}-${ii}`)}</li>
            ))}
          </ul>
        );
      case 'table':
        return (
          <table key={key} style={{ borderCollapse: 'collapse', margin: '6px 0 16px', fontSize: BODY_SIZE - 1 }}>
            <thead>
              <tr>{b.head.map((c, ci) => (
                <th key={ci} style={{ textAlign: 'left', padding: '6px 14px 6px 0', borderBottom: `1px solid ${INK}`, color: INK, fontWeight: 700 }}>
                  {renderInline(c, `${key}-h${ci}`)}
                </th>
              ))}</tr>
            </thead>
            <tbody>
              {b.rows.map((r, ri) => (
                <tr key={ri}>{r.map((c, ci) => (
                  <td key={ci} style={{ padding: '6px 14px 6px 0', borderBottom: `1px solid ${HAIR}`, color: INK, lineHeight: 1.55 }}>
                    {renderInline(c, `${key}-${ri}-${ci}`)}
                  </td>
                ))}</tr>
              ))}
            </tbody>
          </table>
        );
      case 'callout': {
        const s = CALLOUT_STYLE[b.kind];
        return (
          <div key={key} style={{
            margin: '14px 0 16px', background: s.bg, border: `1px solid ${s.border}`,
            borderLeft: `4px solid ${s.accent}`, borderRadius: 6, padding: '12px 16px',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: s.accent, marginBottom: 6 }}>
              <span aria-hidden style={{ marginRight: 6 }}>{s.icon}</span>{b.title ?? s.label}
            </div>
            {renderBlocks(b.blocks, key)}
          </div>
        );
      }
      case 'shot':
        return <Screenshot key={key} file={b.file} arrows={b.arrows} />;
      case 'outcome':
        return (
          <div key={key} style={{
            margin: '18px 0 4px', background: TIP_BG, border: `1px solid ${TIP_BORDER}`,
            borderRadius: 6, padding: '12px 16px',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: GREEN, marginBottom: 5 }}>
              <span aria-hidden style={{ marginRight: 6 }}>✓</span>You&rsquo;re done when
            </div>
            <div style={{ fontSize: BODY_SIZE, lineHeight: 1.65, color: INK }}>{renderInline(b.inline, key)}</div>
          </div>
        );
      default:
        return null;
    }
  });
}

export default function Markdown({ md }: { md: string }) {
  const blocks = parseUniversityMd(md);
  return <div style={{ color: INK_SOFT }}>{renderBlocks(blocks, 'b')}</div>;
}
