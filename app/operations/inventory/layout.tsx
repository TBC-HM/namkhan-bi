// app/operations/inventory/layout.tsx
//
// Wraps every /operations/inventory/* page with the InventorySubnav strip
// so users can hop between Snapshot · Stock · Par · Suppliers · Catalog
// without going back to the quick-links grid.

import InventorySubnav from './_components/InventorySubnav';

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <InventorySubnav />
      {children}
    </>
  );
}
