// components/page/Page.tsx
// THE shell every route renders inside. PBS design manifesto 2026-05-09:
// pages do NOT reinvent header / footer / chrome. They take this shell.
//
// Slots:
//   eyebrow        small mono caps (e.g. "Canvas · the hotel")
//   title          italic Fraunces (e.g. "What does the hotel need?")
//   subPages?      horizontal strip rendered top-left, beside the global N
//   children       page body
//
// Always rendered (unless explicitly disabled):
//   • global N dropdown (top-left, fixed) — provided by app/layout.tsx
//   • SLH affiliation footer + standard internal-BI line
//
// What we deliberately DO NOT put in here:
//   • date+weather+user pill cluster — those belong to dept-entry-style
//     pages and are already in <DeptEntry/>. Adding them here would put
//     them on /sample/* and /design-system, which is wrong.
//
// Hard rule: no inline `style={{ fontSize / color: '#…' }}` literals
// outside this shell. Use CSS variables in styles/globals.css :root.

import type { ReactNode } from 'react';

interface SubPageLink { label: string; href: string }
interface PageProps {
  eyebrow: string;
  title?: ReactNode;
  /** Optional dept sub-pages strip rendered top-left, offset to clear the global N */
  subPages?: SubPageLink[];
  /** Optional content rendered top-right (e.g. weather chips, user pill) */
  topRight?: ReactNode;
  /** Show standard footer (default true) */
  footer?: boolean;
  children: ReactNode;
}

export default function Page({ eyebrow, title, subPages, topRight, footer = true, children }: PageProps) {
  return (
    <div style={S.page}>
      {/* TOP BAR — eyebrow / title on the left, top-right slot on the right.
          When subPages is present we render the horizontal strip in place
          of the eyebrow line so dept entries stay the way they are. */}
      <div style={S.topRow}>
        <div style={{ flex: 1, marginLeft: subPages ? 56 : 0 }}>
          {subPages
            ? <SubPagesStrip items={subPages} />
            : <div style={S.eyebrow}>{eyebrow}</div>
          }
          {title && <h1 style={S.title}>{title}</h1>}
          {!subPages && eyebrow && title && (
            // when both are present, eyebrow already rendered above title
            null
          )}
        </div>
        {topRight && <div style={S.topRight}>{topRight}</div>}
      </div>

      {/* BODY */}
      <div style={S.body}>{children}</div>

      {/* FOOTER */}
      {footer && <PageFooter />}
    </div>
  );
}

// ─── footer (SLH + version + © ──────────────────────────────────────────

function PageFooter() {
  const SLH = 'https://kpenyneooigsyuuomgct.supabase.co/storage/v1/object/public/documents-public/marketing/2026/marketing/slh-considerate-white-logo-moqc2u81.svg';
  const year = new Date().getFullYear();
  return (
    <footer style={S.footer}>
      <div style={S.footerLeft}>
        <a href="https://slh.com/hotels/the-namkhan/" target="_blank" rel="noreferrer" title="Member of Small Luxury Hotels of the World">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={SLH} alt="Member · Small Luxury Hotels" style={{ height: 28, opacity: 0.85 }} />
        </a>
        <span style={S.footerKick}>Member · Small Luxury Hotels</span>
      </div>
      <div style={S.footerRight}>
        <a href="/cockpit"               style={S.footerLink}>Cockpit</a>
        <a href="/knowledge"             style={S.footerLink}>Knowledge</a>
        <a href="https://github.com/TBC-HM/namkhan-bi" target="_blank" rel="noreferrer" style={S.footerLink}>Repo ↗</a>
        <a href="https://namkhan-bi.vercel.app" style={S.footerLink}>Status</a>
        <span style={S.footerSep}>·</span>
        <span>v{(process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? 'dev').slice(0, 7)}</span>
        <span>{process.env.NEXT_PUBLIC_VERCEL_ENV ?? 'local'}</span>
        <span>© {year} The Namkhan</span>
      </div>
    </footer>
  );
}

function SubPagesStrip({ items }: { items: SubPageLink[] }) {
  return (
    <div style={S.subPagesStrip}>
      {items.map((d) => (
        <a key={d.href} href={d.href} style={S.subPageLink}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#d8cca8'; e.currentTarget.style.borderBottomColor = '#3a3327'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#9b907a'; e.currentTarget.style.borderBottomColor = 'transparent'; }}
        >
          {d.label}
        </a>
      ))}
    </div>
  );
}

// ─── styles ────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight:    '100vh',
    background:   '#0a0a0a',
    color:        '#e9e1ce',
    fontFamily:   "'Inter Tight', system-ui, sans-serif",
    padding:      '32px 32px 64px',
    maxWidth:     1280,
    margin:       '0 auto',
    display:      'flex',
    flexDirection: 'column',
  },
  topRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 16, flexWrap: 'wrap' },
  topRight: { display: 'flex', alignItems: 'center', gap: 14 },
  eyebrow: {
    fontFamily:    "'JetBrains Mono', ui-monospace, monospace",
    fontSize:      10,
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
    color:         '#a8854a',
    marginBottom:  6,
    marginLeft:    56, // clear the global N
  },
  title: {
    fontFamily:    "'Fraunces', Georgia, serif",
    fontStyle:     'italic',
    fontWeight:    300,
    fontSize:      'clamp(28px, 3.5vw, 40px)',
    color:         '#e9e1ce',
    margin:        0,
    marginLeft:    56,
  },
  body: { flex: 1 },
  subPagesStrip: { display: 'flex', flexWrap: 'wrap', gap: 14 },
  subPageLink: {
    color:          '#9b907a',
    textDecoration: 'none',
    fontFamily:     "'JetBrains Mono', ui-monospace, monospace",
    fontSize:       10,
    letterSpacing:  '0.18em',
    textTransform:  'uppercase',
    padding:        '4px 0',
    borderBottom:   '1px solid transparent',
    transition:     'color 100ms ease, border-color 100ms ease',
  },
  footer: {
    marginTop:      56,
    paddingTop:     18,
    borderTop:      '1px solid #1f1c15',
    display:        'flex',
    flexWrap:       'wrap',
    gap:            16,
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  footerLeft:  { display: 'flex', alignItems: 'center', gap: 12 },
  footerRight: {
    display: 'flex', flexWrap: 'wrap', gap: 18,
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7d7565',
  },
  footerLink: { color: '#9b907a', textDecoration: 'none', transition: 'color 100ms ease' },
  footerSep:  { color: '#3d3a32' },
  footerKick: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#5a5448',
  },
};
