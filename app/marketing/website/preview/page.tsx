// app/marketing/website/preview/page.tsx
// website-module-v1 — P2 first slice (brief §0.C, 2026-07-30, PBS-directed
// "test page inside marketing"). Renders the crawled homepage content
// (website.pages/sections via public.fn_website_sitedata) so PBS can check
// structural/content parity against thenamkhan.com before the full 53-page
// rebuild. This is a PREVIEW, not the production site: images render from
// their original hotelierkit CDN src_url (media_manifest.downloaded is still
// false on every row — the storage-download pipeline is a separate,
// not-yet-built step, tracked on the same brief).
//
// Scope for this slice (deliberately small — see brief §0.C):
//   - homepage only (slug === '/')
//   - lightweight, dependency-free renderer for the crawl-agent's body_md
//     (no react-markdown/remark added — package.json has none today and
//     this file should not touch the shared dependency tree)
//   - local, page-scoped brand-warm palette (ink/paper/soft-neutral per the
//     marketing/media brand canon) — deliberately NOT the cockpit's dark
//     admin tokens in tailwind.config.js (Carla canon: brand-warm public
//     pages are a separate design track from the holding-dark cockpit chrome;
//     shared tailwind.config.js is left untouched to avoid any hot-file risk)
//
// NOT in this slice (tracked as next-round scope in the brief):
//   - the other 52 pages
//   - media download-to-storage
//   - the isolated public route group / eventual real domain hosting
//   - pixel-parity diffing

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';
import Link from 'next/link';
import type { ReactNode } from 'react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ---------------------------------------------------------------------------
// siteData shape (subset actually used here — matches website.fn_generate_sitedata)
// ---------------------------------------------------------------------------
type SiteImage = { alt?: string | null; src?: string | null; role?: string | null };
type SiteSection = { kind?: string | null; body_md?: string | null };
type SitePage = {
  slug: string;
  title?: string | null;
  images?: SiteImage[] | null;
  sections?: SiteSection[] | null;
};
type SiteData = {
  site?: { domain?: string; base_url?: string; platform_source?: string } | null;
  pages?: SitePage[] | null;
  generated_at?: string | null;
};

// ---------------------------------------------------------------------------
// Minimal, purpose-built renderer for the crawl-agent's body_md shape.
// Handles: # / ## / ### headings, **bold**, *italic*, --- dividers,
// "- " bullets, "N. " numbered lists, bare https:// auto-linking,
// blank-line-separated paragraphs. Not a general markdown engine —
// scoped to exactly what the crawler emits.
// ---------------------------------------------------------------------------
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  // Bold first (so *** / ** don't get eaten by the italic pass), then italic,
  // then auto-link bare URLs. Order matters; each pass walks the string once.
  const nodes: ReactNode[] = [];
  const boldSplit = text.split(/(\*\*[^*]+\*\*)/g);
  boldSplit.forEach((chunk, i) => {
    if (/^\*\*[^*]+\*\*$/.test(chunk)) {
      nodes.push(<strong key={`${keyPrefix}-b-${i}`}>{chunk.slice(2, -2)}</strong>);
      return;
    }
    const italicSplit = chunk.split(/(\*[^*]+\*)/g);
    italicSplit.forEach((sub, j) => {
      if (/^\*[^*]+\*$/.test(sub) && sub.length > 2) {
        nodes.push(<em key={`${keyPrefix}-i-${i}-${j}`}>{sub.slice(1, -1)}</em>);
        return;
      }
      const urlSplit = sub.split(/(https?:\/\/[^\s)]+)/g);
      urlSplit.forEach((piece, k) => {
        if (/^https?:\/\//.test(piece)) {
          nodes.push(
            <a
              key={`${keyPrefix}-u-${i}-${j}-${k}`}
              href={piece}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#8a6b3f', textDecoration: 'underline' }}
            >
              {piece}
            </a>
          );
        } else if (piece) {
          nodes.push(<span key={`${keyPrefix}-t-${i}-${j}-${k}`}>{piece}</span>);
        }
      });
    });
  });
  return nodes;
}

function renderBodyMd(md: string): ReactNode[] {
  const lines = md.split('\n');
  const blocks: ReactNode[] = [];
  let listBuffer: { type: 'ul' | 'ol'; items: string[] } | null = null;
  let key = 0;

  const flushList = () => {
    if (!listBuffer) return;
    const Tag = listBuffer.type;
    blocks.push(
      <Tag key={`list-${key++}`} style={{ margin: '0.5rem 0 1rem 1.25rem', lineHeight: 1.7 }}>
        {listBuffer.items.map((item, i) => (
          <li key={i}>{renderInline(item, `li-${key}-${i}`)}</li>
        ))}
      </Tag>
    );
    listBuffer = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.trim() === '') { flushList(); continue; }
    if (line.trim() === '---') {
      flushList();
      blocks.push(<hr key={`hr-${key++}`} style={{ border: 0, borderTop: '1px solid #d8cfb8', margin: '2rem 0' }} />);
      continue;
    }
    if (line.startsWith('### ')) {
      flushList();
      blocks.push(<h3 key={`h3-${key++}`} style={{ fontSize: '1.05rem', fontWeight: 600, marginTop: '1.25rem', marginBottom: '0.4rem', color: '#3a2f22' }}>{renderInline(line.slice(4), `h3-${key}`)}</h3>);
      continue;
    }
    if (line.startsWith('## ')) {
      flushList();
      blocks.push(<h2 key={`h2-${key++}`} style={{ fontSize: '1.5rem', fontWeight: 600, marginTop: '2rem', marginBottom: '0.6rem', color: '#241d14', fontFamily: 'Georgia, serif' }}>{renderInline(line.slice(3), `h2-${key}`)}</h2>);
      continue;
    }
    if (line.startsWith('# ')) {
      flushList();
      blocks.push(<h1 key={`h1-${key++}`} style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.75rem', color: '#1f1912', fontFamily: 'Georgia, serif' }}>{renderInline(line.slice(2), `h1-${key}`)}</h1>);
      continue;
    }
    const bullet = /^-\s+(.*)$/.exec(line);
    if (bullet) {
      if (!listBuffer || listBuffer.type !== 'ul') { flushList(); listBuffer = { type: 'ul', items: [] }; }
      listBuffer.items.push(bullet[1]);
      continue;
    }
    const numbered = /^\d+\.\s+(.*)$/.exec(line);
    if (numbered) {
      if (!listBuffer || listBuffer.type !== 'ol') { flushList(); listBuffer = { type: 'ol', items: [] }; }
      listBuffer.items.push(numbered[1]);
      continue;
    }
    flushList();
    blocks.push(<p key={`p-${key++}`} style={{ margin: '0.5rem 0', lineHeight: 1.75, color: '#4a3f30' }}>{renderInline(line, `p-${key}`)}</p>);
  }
  flushList();
  return blocks;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default async function WebsitePreviewPage() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_website_sitedata', { p_property_id: PROPERTY_ID });
  const siteData = data as SiteData | null;

  const home = siteData?.pages?.find((p) => p.slug === '/') ?? null;
  const logo = home?.images?.find((i) => i.role === 'logo') ?? home?.images?.[0] ?? null;
  // CMS-1: sections are typed blocks now — join them all (nav/footer blocks
  // are site chrome duplicated by the crawl; skip). Single legacy 'copy'
  // sections join to the identical blob, so behavior is unchanged pre/post
  // block migration.
  const bodyMd = (home?.sections ?? [])
    .filter((s) => s.kind !== 'nav' && s.kind !== 'footer')
    .map((s) => s.body_md ?? '')
    .join('\n');

  return (
    <div style={{ minHeight: '100vh', background: '#F5F0E0' }}>
      {/* App-chrome banner — deliberately NOT brand-styled, so it reads as
          cockpit UI framing a preview, not part of the site itself. */}
      <div
        style={{
          background: '#1a1a1a',
          color: '#e8e4dc',
          fontSize: '0.8rem',
          padding: '0.6rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <span>
          <strong>PREVIEW</strong> — content parity check, not the live design. Homepage only · images pending download pipeline.
          {siteData?.generated_at ? ` · siteData generated ${new Date(siteData.generated_at).toLocaleString()}` : ''}
        </span>
        <Link href="/marketing/website" style={{ color: '#d4c5a0', textDecoration: 'underline', whiteSpace: 'nowrap' }}>
          ← Back to Website editor
        </Link>
      </div>

      {!home || error ? (
        <div style={{ padding: '3rem', color: '#7a3b2e' }}>
          {error ? `Could not load siteData: ${error.message}` : 'Homepage row not found in website.pages (slug = "/").'}
        </div>
      ) : (
        <main style={{ maxWidth: '760px', margin: '0 auto', padding: '3rem 1.5rem 5rem' }}>
          {logo?.src ? (
            // eslint-disable-next-line @next/next/no-img-element -- external hotelierkit CDN, no next/image domain config for this yet
            <img
              src={logo.src}
              alt={logo.alt ?? home.title ?? 'Logo'}
              style={{ height: '48px', width: 'auto', marginBottom: '2rem' }}
            />
          ) : null}
          <div>{renderBodyMd(bodyMd)}</div>
        </main>
      )}
    </div>
  );
}