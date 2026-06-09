// app/finance/suppliers/page.tsx
// PBS 2026-06-09 #194 — Suppliers moved from Operations to Finance arm.
// Thin re-export of the existing /operations/suppliers page.
export const revalidate = 60;
export const dynamic = 'force-dynamic';
import SuppliersPage from '@/app/operations/suppliers/page';
export default SuppliersPage;
