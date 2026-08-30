// app/operations/spa/_shared/SpaSubnav.tsx
// Spa module v1 — Overview · Schedule · Catalogue · Passes · Delivery strip.
// TenantLink keeps the /h/{property_id} prefix on Donna; Namkhan stays unprefixed.

import TenantLink from '@/components/nav/TenantLink';
import { TOKENS, MONO } from '@/components/cockpit/tokens';

const ITEMS = [
  { key: 'overview',  label: 'Overview',  href: '/operations/spa' },
  { key: 'schedule',  label: 'Schedule',  href: '/operations/spa/schedule' },
  { key: 'catalogue', label: 'Catalogue', href: '/operations/spa/catalogue' },
  { key: 'passes',    label: 'Passes',    href: '/operations/spa/passes' },
  { key: 'delivery',  label: 'Delivery',  href: '/operations/spa/delivery' },
  { key: 'ledger',    label: 'Ledger',    href: '/operations/spa/ledger' },
] as const;

export type SpaSubpage = (typeof ITEMS)[number]['key'];

export default function SpaSubnav({ active }: { active: SpaSubpage }) {
  return (
    <div style={{ display: 'flex', gap: 0, borderRadius: 6, border: `1px solid ${TOKENS.border}`, overflow: 'hidden', width: 'fit-content', background: TOKENS.bgRaised }}>
      {ITEMS.map((it) => {
        const isActive = it.key === active;
        return (
          <TenantLink
            key={it.key}
            href={it.href}
            style={{
              padding: '7px 14px', fontFamily: MONO, fontSize: 11,
              letterSpacing: '0.05em', textTransform: 'uppercase', textDecoration: 'none',
              color: isActive ? TOKENS.bgRaised : TOKENS.ink,
              background: isActive ? TOKENS.forest : 'transparent',
              fontWeight: isActive ? 600 : 500,
            }}
          >
            {it.label}
          </TenantLink>
        );
      })}
    </div>
  );
}
