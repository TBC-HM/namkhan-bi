// app/finance/inventory/page.tsx
// PBS 2026-06-09 #194 — Inventory moved from Operations to Finance arm.
// Thin re-export of the existing /operations/inventory page so /finance/inventory
// renders the same component. Old route stays alive for deep links.
export const revalidate = 60;
export const dynamic = 'force-dynamic';
import InventoryPage from '@/app/operations/inventory/page';
export default InventoryPage;
