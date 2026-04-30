// app/revenue/inventory/page.tsx
// D14 (staged): redirect deprecated /revenue/inventory → /revenue/pricing.
import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default function InventoryRedirect() { redirect('/revenue/pricing'); }
