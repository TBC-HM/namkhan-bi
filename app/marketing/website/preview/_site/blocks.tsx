// app/marketing/website/preview/_site/blocks.tsx
// CMS-1 block renderers (website-module-v1, CMS v1 approved 2026-08-04).
// website.sections rows are typed blocks (block catalog in sections_kind_check);
// this module renders a page's ordered block list with kind-specific treatment.
// 'nav' and 'footer' blocks are site chrome — SiteNav/SiteFooter already render
// the real chrome, so those blocks are skipped here (fixes the old duplicate-
// footer-text parity wart). Unknown/legacy kinds ('copy') fall back to renderMd,
// so an unmigrated single-blob section renders exactly as before.
/* eslint-disable @next/next/no-img-element */
import type { ReactNode } from 'react';
import { renderMd } from './md';

export type BlockRow = {
  id: number;
  kind: string | null;
  heading: string | null;
  body_md: string | null;
  sort_order: number | null;
  data: { label?: string; images?: string[]; ctas?: { label: string; url: string }[] } | null;
};

const HAIR = '#D4C9B0';
const INK = '#1C1812';
const CREAM = '#F0EAE0';
const SERIF = 'Georgia, serif';

const IMG_MD = /!\[[^\]]*\]\(([^)\s]+)[^)]*\)/g;

function stripLeadH1(md: string): string {
  return md.replace(/^#\s+[^\n]+\n*/, '');
}

// Remove the crawler's "## Label" line — kind-specific renderers that show
// their own chrome (cta box, gallery) render the label themselves.
function stripH2(md: string): string {
  return md.replace(/^##\s+[^\n]+\n*/, '');
}

function ctaBox(b: BlockRow, key: string): ReactNode {
  const cta = b.data?.ctas?.[0];
  const body = stripH2(b.body_md ?? '');
  return (
    <div key={key} style={{ margin: '2.2rem 0', padding: '30px 32px', background: CREAM, borderRadius: 6, textAlign: 'center' }}>
      {b.data?.label && (
        <div style={{ fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#8B7355', marginBottom: 12 }}>
          {b.data.label}
        </div>
      )}
      <div style={{ textAlign: 'left', marginBottom: cta ? 18 : 0 }}>{renderMd(body)}</div>
      {cta && (
        <a href={cta.url} target="_blank" rel="noopener noreferrer"
          style={{ display: 'inline-block', padding: '13px 36px', background: INK, color: '#FFF', textDecoration: 'none', fontWeight: 700, fontSize: 13, borderRadius: 2, letterSpacing: '0.05em' }}>
          {cta.label || 'Book now'}
        </a>
      )}
    </div>
  );
}

function galleryGrid(b: BlockRow, key: string): ReactNode {
  const body = b.body_md ?? '';
  const urls: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(IMG_MD.source, 'g');
  while ((m = re.exec(body)) !== null) urls.push(m[1]);
  const rest = stripH2(body).replace(new RegExp(IMG_MD.source, 'g'), '').replace(/^[-*\d.\s]+$/gm, '');
  return (
    <div key={key} style={{ margin: '2.2rem 0' }}>
      {b.data?.label && (
        <div style={{ fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#8B7355', marginBottom: 14 }}>
          {b.data.label}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
        {urls.map((u, i) => (
          <img key={i} src={u} alt="" loading="lazy" style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', borderRadius: 3 }} />
        ))}
      </div>
      {rest.trim() && <div style={{ marginTop: 14 }}>{renderMd(rest)}</div>}
    </div>
  );
}

function faqBlock(b: BlockRow, key: string): ReactNode {
  return (
    <div key={key} style={{ margin: '2rem 0', padding: '22px 26px', border: '1px solid ' + HAIR, borderRadius: 6, background: '#FFFDF8' }}>
      {renderMd(b.body_md ?? '')}
    </div>
  );
}

function cardsBlock(b: BlockRow, key: string): ReactNode {
  return (
    <div key={key} style={{ margin: '2.2rem 0', padding: '26px 30px', background: CREAM, borderRadius: 6 }}>
      {renderMd(b.body_md ?? '')}
    </div>
  );
}

function heroBlock(b: BlockRow, key: string): ReactNode {
  return (
    <div key={key} style={{ margin: '0 0 2rem', paddingBottom: '1.6rem', borderBottom: '1px solid ' + HAIR }}>
      {renderMd(stripLeadH1(b.body_md ?? ''))}
    </div>
  );
}

function quoteBlock(b: BlockRow, key: string): ReactNode {
  return (
    <blockquote key={key} style={{ margin: '2.2rem 0', padding: '10px 0 10px 26px', borderLeft: '3px solid ' + HAIR, fontFamily: SERIF, fontStyle: 'italic', color: '#4a4136' }}>
      {renderMd(b.body_md ?? '')}
    </blockquote>
  );
}

// Renders an ordered list of typed section blocks. stripFirstH1: page templates
// render page.title themselves, so the leading crawled H1 is removed from the
// first rendered block whatever its kind.
export function renderBlocks(blocks: BlockRow[], opts?: { stripFirstH1?: boolean }): ReactNode[] {
  const out: ReactNode[] = [];
  let first = true;
  for (const b of blocks) {
    const kind = b.kind ?? 'copy';
    if (kind === 'nav' || kind === 'footer') continue;
    let body = b.body_md ?? '';
    if (first) {
      if (opts?.stripFirstH1) body = stripLeadH1(body);
      first = false;
    }
    if (!body.trim()) continue;
    const bb: BlockRow = { ...b, body_md: body };
    const key = 'blk' + b.id;
    switch (kind) {
      case 'hero':    out.push(heroBlock(bb, key)); break;
      case 'cta':     out.push(ctaBox(bb, key)); break;
      case 'gallery': out.push(galleryGrid(bb, key)); break;
      case 'faq':     out.push(faqBlock(bb, key)); break;
      case 'cards':   out.push(cardsBlock(bb, key)); break;
      case 'quote':   out.push(quoteBlock(bb, key)); break;
      default:        out.push(<div key={key}>{renderMd(body)}</div>);
    }
  }
  return out;
}
