// components/page/Page.tsx
// THE shell every route renders inside. PBS design manifesto 2026-05-09:
// pages do NOT reinvent header / footer / chrome. They take this shell.
//
// Slots:
//   eyebrow        small mono caps (e.g. "Canvas · the hotel")
//   title          italic Fraunces (e.g. "What does the hotel need?")
//   subPages?      horizontal strip rendered top-left, beside the global N
//   topRight?      EXTRA top-right content (e.g. ⚙ Channel Settings) —
//                  rendered LEFT of the always-on header pills.
//   kpiTiles?      passed to <HeaderPills> for the date-hover popover.
//   showHeaderPills (default true) — disable for chrome-less surfaces.
//   children       page body
//
// Always rendered (unless explicitly disabled):
//   • global N dropdown (top-left, fixed) — provided by app/layout.tsx
//   • temp / air / date / user pills (consistent across every page —
//     PBS 2026-05-09: "the air symbol, temperature, who is logged in
//     is not on every page — header must be consistent throughout")
//   • SLH affiliation footer + standard internal-BI line

import type { ReactNode } from 'react';
import SubPagesStrip from './SubPagesStrip';
import HeaderPills from './HeaderPills';

interface SubPageLink { label: string; href: string }
interface PageProps {
  /** Optional small mono caps line above the title. */
  eyebrow?: string;
  title?: ReactNode;
  /** Optional dept sub-pages strip rendered top-left, offset to clear the global N */
  subPages?: SubPageLink[];
  /** Extra top-right content. Rendered LEFT of the always-on header pills. */
  topRight?: ReactNode;
  /** KPI tiles shown in the date-hover popover (per-dept). */
  kpiTiles?: Array<{ k: string; v: string; d: string }>;
  /** Hide the temp/air/date/user pills (e.g. on /sample candidates). Default true. */
  showHeaderPills?: boolean;
  /** Show standard footer (default true) */
  footer?: boolean;
  children: ReactNode;
}

export default function Page({
  eyebrow, title, subPages, topRight, kpiTiles,
  showHeaderPills = true, footer = true, children,
}: PageProps) {
  return (
    <div style={S.page}>
      {/* TOP BAR — two layers stacked inside one sticky container.
          Intake (2026-05-12): HeaderPills used to sit alongside subPages +
          title + page topRight controls. On dense pages (e.g. /revenue/pricing
          where topRight has 9-tab TimeframeSelector + 5-tab CompareSelector)
          the row flex-wrapped and the pills dropped BELOW the title on the
          left. Fix: HeaderPills now always renders in its own row at the
          very top, right-aligned, with flex-shrink:0 so it can never be
          pushed below. Page-specific topRight controls sit on the second
          row alongside the title. */}
      <div style={S.topBar}>
        {/* Row 1 — HeaderPills (always-on, always top-right). Rendered only
            when showHeaderPills=true; pages can opt-out (e.g. /sample). */}
        {showHeaderPills && (
          <div style={S.topRowPills}>
            <HeaderPills kpiTiles={kpiTiles} />
          </div>
        )}

        {/* Row 2 — eyebrow/subPages + title (left), page-specific topRight (right) */}
        <div style={S.topRowTitle}>
          <div style={{ flex: 1, marginLeft: subPages ? 56 : 0, minWidth: 0 }}>
            {subPages && <SubPagesStrip items={subPages} />}
            {!subPages && eyebrow && <div style={S.eyebrow}>{eyebrow}</div>}
            {title && <h1 style={S.title}>{title}</h1>}
          </div>
          {topRight && (
            <div style={S.topRight}>
              {topRight}
            </div>
          )}
        </div>
      </div>

      {/* BODY */}
      <div style={S.body}>{children}</div>

      {/* FOOTER */}
      {footer && <PageFooter />}
    </div>
  );
}

// ─── footer (SLH + version + © ──────────────────────────────────────────

function HealthBarometer() {
  // PBS 2026-05-09: replace static "Status" link with a small dot + label
  // reflecting deployment env. green = live (production), amber = preview,
  // grey = local. Glow via box-shadow.
  const env = process.env.NEXT_PUBLIC_VERCEL_ENV ?? 'local';
  const map: Record<string, { color: string; label: string }> = {
    production: { color: '#3a8e5b', label: 'live' },
    preview:    { color: 'var(--accent-2, #c4a06b)', label: 'preview' },
    local:      { color: 'var(--text-dim, #7d7565)', label: 'local' },
  };
  const { color, label } = map[env] ?? map.local;
  return (
    <span style={S.healthWrap} title={`Deployment: ${env}`}>
      <span
        aria-hidden
        style={{
          display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
          background: color, boxShadow: `0 0 6px ${color}`,
        }}
      />
      <span>{label}</span>
    </span>
  );
}

function PageFooter() {
  const SLH = 'https://kpenyneooigsyuuomgct.supabase.co/storage/v1/object/public/documents-public/marketing/2026/marketing/slh-considerate-white-logo-moqc2u81.svg';
  const year = new Date().getFullYear();
  return (
    <footer style={S.footer}>
      <div style={S.footerLeft}>
        {/* Intake #11 (2026-05-12): drop title + visible alt text — logo speaks for itself.
            alt left empty (decorative) and title removed; href + rel preserved for SEO/a11y. */}
        <a href="https://slh.com/hotels/the-namkhan/" target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={SLH} alt="" style={{ height: 32, opacity: 1 }} />
        </a>
        <span style={S.footerKick}>A Beyond Circle Product</span>
      </div>
      <div style={S.footerRight}>
        <HealthBarometer />
        <span style={S.footerSep}>·</span>
        <span>v{(process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? 'dev').slice(0, 7)}</span>
        <span>{process.env.NEXT_PUBLIC_VERCEL_ENV ?? 'local'}</span>
        <a
          href="mailto:book@thenamkhan.com?subject=Namkhan%20BI%20—%20contact"
          style={S.footerLink}
        >© {year} The Namkhan</a>
      </div>
    </footer>
  );
}

// SubPagesStrip lives in its own file as a client component because its
// onMouseEnter/Leave handlers can't be serialized through the RSC boundary.

// ─── styles ────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight:    '100vh',
    // 2026-05-12: CSS vars driven by ThemeInjector so non-Namkhan properties
    // (Donna, future tenants) get their own page background. Fallbacks
    // preserve Namkhan's existing dark theme for legacy /<dept> routes that
    // sit outside /h/[id]/ and never hit ThemeInjector.
    background:   'var(--page-bg, #0a0a0a)',
    color:        'var(--page-fg, #e9e1ce)',
    fontFamily:   "'Inter Tight', system-ui, sans-serif",
    padding:      '32px 32px 64px',
    maxWidth:     1280,
    margin:       '0 auto',
    display:      'flex',
    flexDirection: 'column',
  },
  // 2026-05-12: replaced single topRow with topBar (sticky container) +
  // topRowPills (HeaderPills, always-on top) + topRowTitle (subPages/title
  // + page-specific topRight controls). Locks HeaderPills into the top-right
  // position regardless of how wide the page-specific controls get.
  topBar: {
    position: 'sticky', top: 0, zIndex: 50,
    background: 'var(--topbar-bg, rgba(10, 10, 10, 0.82))',
    backdropFilter: 'saturate(140%) blur(10px)',
    WebkitBackdropFilter: 'saturate(140%) blur(10px)',
    borderBottom: '1px solid var(--topbar-border, rgba(31, 28, 21, 0.6))',
    margin: '-32px -32px 24px',
    padding: '12px 32px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  topRowPills: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  topRowTitle: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    flexWrap: 'wrap',
  },
  topRight: { display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', justifyContent: 'flex-end' },
  eyebrow: {
    fontFamily:    "'JetBrains Mono', ui-monospace, monospace",
    fontSize:      10,
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
    color:         'var(--accent, #a8854a)',
    marginBottom:  6,
    marginLeft:    56, // clear the global N
  },
  title: {
    fontFamily:    "'Fraunces', Georgia, serif",
    fontStyle:     'italic',
    fontWeight:    300,
    fontSize:      'clamp(28px, 3.5vw, 40px)',
    color:         'var(--text-0, #e9e1ce)',
    margin:        0,
    marginLeft:    56,
  },
  body: { flex: 1 },
  footer: {
    marginTop:      56,
    paddingTop:     18,
    borderTop:      '1px solid var(--border-1, #1f1c15)',
    display:        'flex',
    flexWrap:       'wrap',
    gap:            16,
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  footerLeft:  { display: 'flex', alignItems: 'center', gap: 12 },
  footerRight: {
    // PBS 2026-05-09 #22: stronger footer contrast (not bigger).
    display: 'flex', flexWrap: 'wrap', gap: 18,
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase',
    color: 'var(--text-soft, #b8a98a)', fontWeight: 500,
  },
  footerLink: { color: 'var(--text-2, #d8cca8)', textDecoration: 'none', fontWeight: 600, transition: 'color 100ms ease' },
  footerSep:  { color: 'var(--text-place, #5a5448)' },
  footerKick: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-mute, #9b907a)', fontWeight: 500,
  },
  healthWrap: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    color: 'var(--text-2, #d8cca8)', fontWeight: 600,
  },
};
