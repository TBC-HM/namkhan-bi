'use client';

// components/page/TopDeptStrip.tsx
// PBS 2026-05-14 (v2) — Canonical top-level dept menu, persistent on
// EVERY route except the explicit holding exception (/holding, /tbc, /,
// /login, /p/*). Mounted in app/layout.tsx so it survives even when a
// /h/[id]/<dept> page redirect()s to the legacy /<dept> route (Namkhan
// pattern). Property is derived from pathname first, cookie fallback.
//
// Active dept = current URL contains /<slug>(/) or /h/[id]/<slug>(/).
// Active dept lit in strong brass; the page-level SubPagesStrip uses
// brass-soft so both rows can be lit at once (breadcrumb).

import { usePathname } from 'next/navigation';

interface DeptLink { label: string; slug: string; href?: string; openInNewWindow?: boolean; color?: string }

const CANONICAL_DEPTS: DeptLink[] = [
  // PBS 2026-07-02: CEO entry in front of HoDs. Slug `''` targets the
  // property root (/h/[id]/), which is the CEO's landing. Active state is
  // special-cased below so it lights up when there's no dept in the URL.
  //
  // PBS 2026-07-06: Guest moved to right after Sales (guest lifecycle is a
  // commercial function, sits between Sales and Marketing operationally).
  // Finance renamed → Administration (URL stays /finance for bookmark safety).
  { label: 'CEO',            slug: ''           },
  { label: 'Revenue',        slug: 'revenue'    },
  { label: 'Sales',          slug: 'sales'      },
  { label: 'Guest',          slug: 'guest'      },
  { label: 'Marketing',      slug: 'marketing'  },
  { label: 'Operations',     slug: 'operations' },
  { label: 'Administration', slug: 'finance'    },
  // PBS #158/#159 (2026-05-24): IT removed from property menu — only in holding strip.
  // Per-property settings now reached via the gear button below (in IT's former slot).
];

const SLUG_SET = new Set(CANONICAL_DEPTS.map((d) => d.slug));

// Holding-mode strip (PBS 2026-05-14): when the user is on /holding the
// dept menu collapses to the holding-scoped depts. For now two links —
// Legal (Carla) and IT (Kit). More holding depts will be added later.
// PBS 2026-05-28: + Strategy (Fox) and Legal · Lao (John), both opening their
// chat in a new window (target=_blank) and lit in the holding brass colour.
const HOLDING_DEPTS: DeptLink[] = [
  { label: 'Legal',        slug: 'legal',     href: '/holding/legal'     },
  { label: 'Legal · Lao',  slug: 'legal-lao', href: '/holding/legal-lao', openInNewWindow: true, color: '#8B4513' },
  { label: 'Strategy',     slug: 'strategy',  href: '/holding/strategy', openInNewWindow: true, color: '#8B4513' },
  { label: 'IT',           slug: 'it',        href: '/holding/it'        },
];
const HOLDING_SLUG_SET = new Set(HOLDING_DEPTS.map((d) => d.slug));

// Paths where the strip should NOT render at all. We keep /holding OUT
// of this list now — it renders the holding-mode strip instead.
const HIDE_PREFIXES = ['/tbc', '/TBC', '/login', '/p/', '/_next'];
function isHiddenPath(pathname: string): boolean {
  if (pathname === '/') return true; // home page = Felix architect entry; no dept menu yet
  return HIDE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p));
}

function isHoldingPath(pathname: string): boolean {
  return pathname === '/holding' || pathname.startsWith('/holding/');
}

const NAMKHAN_PROPERTY_ID = 260955;
const HOLDING_PROPERTY_ID = 0;

function readActivePropertyFromCookie(): number {
  if (typeof document === 'undefined') return NAMKHAN_PROPERTY_ID;
  const match = document.cookie.match(/(?:^|; )tbc\.active_property=(\d+)/);
  const n = match ? Number(match[1]) : NaN;
  if (!Number.isFinite(n) || n === HOLDING_PROPERTY_ID) return NAMKHAN_PROPERTY_ID;
  return n;
}

function resolvePropertyAndDept(pathname: string): { propertyId: number; activeSlug: string | null } {
  // /h/[id]/<slug>(/...) — property explicit in URL.
  const m = pathname.match(/^\/h\/(\d+)(?:\/([^/]+))?/);
  if (m) {
    const propertyId = Number(m[1]);
    const slug = m[2] && SLUG_SET.has(m[2]) ? m[2] : null;
    return { propertyId, activeSlug: slug };
  }

  // Legacy: /<slug>(/...) — property comes from cookie.
  const m2 = pathname.match(/^\/([^/]+)/);
  const slug = m2 && SLUG_SET.has(m2[1]) ? m2[1] : null;
  return { propertyId: readActivePropertyFromCookie(), activeSlug: slug };
}


// PBS 2026-07-06: property-aware strip colors — the ONE visual differentiator
// between properties now the rest of the site is pure white.
function stripStyleFor(propertyId: number, holdingMode: boolean): { bg: string; textIdle: string; textActive: string; border: string; brass: string } {
  if (holdingMode) {
    // Beyond Circle = white strip with dark ink text
    return { bg: '#FFFFFF', textIdle: '#5A5A5A', textActive: '#1B1B1B', border: '#E6DFCC', brass: '#8B4513' };
  }
  if (propertyId === 1000001) {
    // Donna = beige strip
    return { bg: '#F5EAD9', textIdle: '#5A4A32', textActive: '#1B1B1B', border: '#E6D4B0', brass: '#8B5A1C' };
  }
  // Namkhan (or any other property) = black strip
  return { bg: '#0F0D0A', textIdle: '#B8A574', textActive: '#F0E5CB', border: 'rgba(212,168,102,0.28)', brass: '#D4A866' };
}

export default function TopDeptStrip() {
  const pathname = usePathname() ?? '';
  if (isHiddenPath(pathname)) return null;

  const holdingMode = isHoldingPath(pathname);

  // Holding mode — render the 2-link holding strip (Legal · IT) and skip
  // the property-id resolution + settings gear (no per-property scope here).
  if (holdingMode) {
    const activeHoldingSlug =
      pathname === '/holding' ? null :
      pathname.match(/^\/holding\/([^/]+)/)?.[1] ?? null;
    const s = stripStyleFor(HOLDING_PROPERTY_ID, true);
    return (
      <nav
        aria-label="Holding department menu"
        style={{
          display: 'flex',
          flexWrap: 'nowrap',
          gap: 18,
          overflowX: 'auto',
          padding: '14px 24px 8px',
          paddingLeft: 70,
          paddingRight: 24,
          borderBottom: '1px solid ' + s.border,
          background: s.bg,
          position: 'relative',
          zIndex: 60,
        }}
      >
        {HOLDING_DEPTS.map((d) => {
          const active = activeHoldingSlug === d.slug;
          return (
            <a
              key={d.slug}
              href={d.href ?? `/holding/${d.slug}`}
              aria-current={active ? 'page' : undefined}
              target={d.openInNewWindow ? '_blank' : undefined}
              rel={d.openInNewWindow ? 'noopener noreferrer' : undefined}
              style={{
                color: active ? s.brass : (d.color ?? s.textIdle),
                textDecoration: 'none',
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: 11,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                fontWeight: active ? 700 : 500,
                padding: '6px 0',
                borderBottom: active ? '2px solid ' + s.brass : '2px solid transparent',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'color 100ms ease, border-color 100ms ease',
              }}
            >
              {d.label}
            </a>
          );
        })}
        {/* No settings gear in holding mode — settings are per-property. */}
      </nav>
    );
  }

  void HOLDING_SLUG_SET; // reserved for future holding-route validation

  const { propertyId, activeSlug } = resolvePropertyAndDept(pathname);
  const base = `/h/${propertyId}`;

  const s = stripStyleFor(propertyId, false);
  return (
    <nav
      aria-label="Department menu"
      style={{
        display: 'flex',
        flexWrap: 'nowrap',
        gap: 18,
        overflowX: 'auto',
        padding: '14px 24px 8px',
        paddingLeft: 70,
        paddingRight: 24,
        borderBottom: '1px solid ' + s.border,
        background: s.bg,
        position: 'relative',
        zIndex: 60,
      }}
    >
      {CANONICAL_DEPTS.map((d) => {
        // CEO row: active when the URL has no dept segment (`activeSlug` is null).
        const active = d.slug === ''
          ? (activeSlug === null || activeSlug === '')
          : activeSlug === d.slug;
        const href = d.slug === '' ? `${base}` : `${base}/${d.slug}`;
        return (
          <a
            key={d.slug || '_ceo'}
            href={href}
            aria-current={active ? 'page' : undefined}
            style={{
              color: active ? s.brass : s.textIdle,
              textDecoration: 'none',
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: 11,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              fontWeight: active ? 700 : 500,
              padding: '6px 0',
              borderBottom: active ? '2px solid ' + s.brass : '2px solid transparent',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              transition: 'color 100ms ease, border-color 100ms ease',
            }}
          >
            {d.label}
          </a>
        );
      })}
      {/* PBS #158/#159 (2026-05-24): property settings gear sits where IT used to be —
          larger, brass on hover, lit with the same brass when on /settings/property. */}
      <a
        href={`${base}/settings/property`}
        title="Property settings"
        aria-label="Property settings"
        aria-current={activeSlug === 'settings' ? 'page' : undefined}
        style={{
          color: activeSlug === 'settings' ? s.brass : s.textIdle,
          textDecoration: 'none',
          fontSize: 22,
          lineHeight: 1,
          padding: '2px 6px',
          flexShrink: 0,
          transition: 'color 100ms ease',
        }}
      >
        ⚙
      </a>
    </nav>
  );
}
