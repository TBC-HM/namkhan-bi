// app/operations/restaurant/_cockpit/FbSubnav.tsx
// PBS 2026-08-26 · F&B cockpit sub-strip.
//
// Same anatomy as SpaSubnav (the estate's existing per-module pattern) but
// driven by ?tab= rather than sub-routes, so the whole cockpit is one page
// while it is built alongside the live one. Swapping to real sub-routes later
// is a change to this file and the shell, not to any tab body.
//
// op_period is carried across tab changes — switching from Tonight to Guests
// must not silently reset the drill-down back to 30 days.

import TenantLink from '@/components/nav/TenantLink';
import { TOKENS, MONO } from '@/components/cockpit/tokens';

export const FB_TABS = [
  { key: 'tonight', label: 'Tonight', blurb: 'what is happening right now' },
  { key: 'feed',    label: 'Feed',    blurb: 'every posting, searchable' },
  { key: 'menu',    label: 'Menu',    blurb: 'what sells and what stalled' },
  { key: 'guests',  label: 'Guests',  blurb: 'who spends and who never did' },
  { key: 'cost',    label: 'Cost',    blurb: 'food cost, labour, stock' },
  { key: 'ledger',  label: 'Ledger',  blurb: 'USALI and the GL reconciliation' },
] as const;

export type FbTab = (typeof FB_TABS)[number]['key'];

export function isFbTab(v: unknown): v is FbTab {
  return typeof v === 'string' && FB_TABS.some((t) => t.key === v);
}

export default function FbSubnav({
  active, basePath, opPeriod,
}: {
  active: FbTab;
  basePath: string;
  opPeriod?: string;
}) {
  const suffix = opPeriod ? `&op_period=${encodeURIComponent(opPeriod)}` : '';
  return (
    <div style={{
      display: 'flex', gap: 0, borderRadius: 6,
      border: `1px solid ${TOKENS.border}`, overflow: 'hidden',
      width: 'fit-content', background: TOKENS.bgRaised, flexWrap: 'wrap',
    }}>
      {FB_TABS.map((t) => {
        const isActive = t.key === active;
        return (
          <TenantLink
            key={t.key}
            href={`${basePath}?tab=${t.key}${suffix}`}
            title={t.blurb}
            style={{
              padding: '7px 14px', fontFamily: MONO, fontSize: 11,
              letterSpacing: '0.05em', textTransform: 'uppercase', textDecoration: 'none',
              color: isActive ? TOKENS.bgRaised : TOKENS.ink,
              background: isActive ? TOKENS.forest : 'transparent',
              fontWeight: isActive ? 600 : 500,
            }}
          >
            {t.label}
          </TenantLink>
        );
      })}
    </div>
  );
}
