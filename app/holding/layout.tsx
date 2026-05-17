// app/holding/layout.tsx
// PBS Apple note #31 (2026-05-13): Beyond Circle / Holding scope.
//
// The third brand in the PropertySwitcher: Felix's holding-level surface.
// Distinct from /h/[property_id]/* — there is no single property_id here
// because the holding view is cross-property by definition. Multi-tenant
// boundary preserved: this layout NEVER blends Namkhan + Donna data into
// one query — it shows them as side-by-side tiles + per-property nav.
//
// Theming: we attach data-property="holding" on <html> via a tiny inline
// script so the :root[data-property='holding'] block in globals.css takes
// effect. (CSS-only approach; no JS hydration cost beyond a 1-line write.)
// We also wrap the tree in a PropertyProvider with property_id=0 so the
// existing PropertySwitcher + useCurrentProperty() hook keep working
// without conditional branches on every consumer.

import { PropertyProvider, type ModuleStatus } from '@/lib/property-context';
import type { ReactNode } from 'react';
// PBS 2026-05-15: data-property attribute is now set by app/layout.tsx +
// PropertyThemeWatcher based on pathname. Removed the holding-only Script
// so we have a single source of truth and no FOUC when leaving /holding.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const HOLDING_PROPERTY_ID = 0;

// Holding modules are limited to platform-level surfaces. No PMS, FB, ops,
// etc — those only make sense per-property. Felix shells out to per-
// property routes for that data.
const HOLDING_MODULES: Record<string, ModuleStatus> = {
  platform_required: 'active',
  holding_overview:  'active',
};

export default function HoldingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PropertyProvider
        value={{
          propertyId: HOLDING_PROPERTY_ID,
          propertyName: 'Beyond Circle · Holding',
          modules: HOLDING_MODULES,
          logoUrl: null,
        }}
      >
        {children}
      </PropertyProvider>
    </>
  );
}
